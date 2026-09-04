// ── Page Layout ───────────────────────────────────────────────────────────────
// Renders a PageLayout: an ordered list of sections, each with a column
// arrangement (full, two_column, three_column, sidebar, feature).
// Each section contains an ordered list of blocks.
//
// In edit mode, blocks are wrapped in SortableBlock with move/remove controls
// and drag-and-drop reordering.

import { memo, useCallback, useState } from "react";
import { ChevronDown, Copy, Eye, EyeOff, LayoutGrid, MoreVertical, Trash2 } from "lucide-react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { SortableBlock } from "@/components/tethyr/page/sortable-block";
import { InlineInspector } from "@/components/tethyr/studio/inline-inspector";
import { StudioSectionGrid } from "@/components/tethyr/page/studio-section-grid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PageLayout as PageLayoutType,
  BlockContext,
  LayoutBlockInstance,
  LayoutSection,
  SectionLayoutType,
} from "@/lib/page-blocks";
import { getBlock } from "@/lib/block-registry";
import { shouldRenderSectionInView } from "@/lib/studio-visibility";

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  /** Called when the layout changes (edit mode only). */
  onLayoutChange?: (layout: PageLayoutType) => void;
  /** Called when a block's config changes. */
  onBlockConfigChange?: (blockId: string, config: Record<string, unknown>) => void;
  profileMedia?: { avatarUrl: string | null; bannerUrl: string | null };
  onProfileMediaSaved?: () => void;
  profileCompleteness?: number;
  onCompleteProfile?: () => void;
}

/** Tailwind grid classes for each section layout type. */
const SECTION_GRID: Record<SectionLayoutType, string> = {
  full: "",
  two_column: "grid grid-cols-1 gap-8 md:grid-cols-2",
  three_column: "grid grid-cols-1 gap-6 md:grid-cols-3",
  sidebar_left: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(180px,280px)_minmax(0,1fr)]",
  sidebar_right: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(180px,280px)]",
  feature: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]",
  side_by_side: "grid grid-cols-1 gap-8 md:grid-cols-2",
  // Whitespace-led compositions for the Studio personality presets. Their
  // rhythm comes from intentional asymmetry, so they skip the divider border.
  featured_work: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]",
  asymmetric: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]",
  split: "grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  image_lead: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
  compact_list: "",
};

/** Section layouts whose rhythm is length/whitespace-driven instead of boxy. */
const BLOCK_LABELS: Record<string, string> = {
  "profile-header": "Header",
  "profile-projects": "Your work",
  "profile-direction": "What I’m looking for",
  "profile-bio": "About",
  "profile-links": "Links",
  "profile-skills": "Skills",
  "profile-experience": "Experience",
  "profile-gallery": "Gallery",
  "profile-tools": "Tools",
  "profile-achievements": "Achievements",
};

function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? type.replace(/^profile-/, "").replace(/-/g, " ");
}

const WHITESPACE_LED_LAYOUTS = new Set<SectionLayoutType>([
  "featured_work",
  "asymmetric",
  "split",
  "image_lead",
  "compact_list",
]);

/**
 * Renders the full page composition: sections → blocks.
 * Memoised at the layout level so only changed sections re-render.
 * In edit mode, each block gets move/remove/configure controls.
 */
export const PageLayoutRenderer = memo(function PageLayoutRenderer({
  layout,
  context,
  onLayoutChange,
  onBlockConfigChange,
  profileMedia,
  onProfileMediaSaved,
  profileCompleteness,
  onCompleteProfile,
}: PageLayoutRendererProps) {
  const sections = [...layout.sections]
    .sort((a, b) => a.position - b.position)
    // Hidden blocks remain visible to the owner as editor targets, but public
    // rendering should not reserve space for sections with no visible content.
    .filter(
      (section) => context.isEditing || section.blocks.some((block) => block.visible !== false),
    );

  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);
  const [configuringBlockId, setConfiguringBlockId] = useState<string | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [configuringSectionId, setConfiguringSectionId] = useState<string | null>(null);
  const [removingSectionId, setRemovingSectionId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sectionIdx: number; blockIdx: number } | null>(
    null,
  );
  // Blocks that report (in view mode) they rendered no public content. Used to
  // fully collapse sections whose visible blocks are all empty, so the public
  // Studio doesn't leave blank bands + dividers behind.
  const [emptyBlockIds, setEmptyBlockIds] = useState<Set<string>>(new Set());

  // The block currently being configured (inspector target).
  const configuredBlock: LayoutBlockInstance | undefined = configuringBlockId
    ? sections.flatMap((s) => s.blocks).find((b) => b.id === configuringBlockId)
    : undefined;
  const configuredDefinition = configuredBlock ? getBlock(configuredBlock.type) : undefined;
  const resizingBlock = resizingBlockId
    ? sections.flatMap((s) => s.blocks).find((b) => b.id === resizingBlockId)
    : undefined;

  // Track which blocks rendered no public content (view mode only). Memoised so
  // unrelated layout renders don't reset the set.
  const reportBlockEmpty = useCallback((blockId: string, isEmpty: boolean) => {
    setEmptyBlockIds((prev) => {
      const next = new Set(prev);
      if (isEmpty) next.add(blockId);
      else next.delete(blockId);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, []);

  // In view mode, drop sections whose visible blocks are all empty so the
  // public Studio renders only real content. Editing always shows every section
  // (empty blocks get their inline "add content" affordance).
  const sectionsToRender = context.isEditing
    ? sections
    : sections.filter((section) => shouldRenderSectionInView(section, emptyBlockIds));

  // ── Block actions ──────────────────────────────────────────────────────
  const handleMoveUp = useCallback(
    (sectionIdx: number, blockIdx: number) => {
      if (!onLayoutChange || blockIdx === 0) return;
      const newSections = cloneSections(layout);
      const blocks = newSections[sectionIdx].blocks;
      const temp = blocks[blockIdx];
      blocks[blockIdx] = { ...blocks[blockIdx - 1], position: blocks[blockIdx].position };
      blocks[blockIdx - 1] = { ...temp, position: blocks[blockIdx - 1].position };
      reindex(blocks);
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange],
  );

  const handleMoveDown = useCallback(
    (sectionIdx: number, blockIdx: number) => {
      if (!onLayoutChange) return;
      const newSections = cloneSections(layout);
      const blocks = newSections[sectionIdx].blocks;
      if (blockIdx >= blocks.length - 1) return;
      const temp = blocks[blockIdx];
      blocks[blockIdx] = { ...blocks[blockIdx + 1], position: blocks[blockIdx].position };
      blocks[blockIdx + 1] = { ...temp, position: blocks[blockIdx + 1].position };
      reindex(blocks);
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange],
  );

  const handleDuplicateSection = useCallback(
    (sectionIdx: number) => {
      if (!onLayoutChange) return;
      const nextSections = cloneSections(layout);
      const source = nextSections[sectionIdx];
      if (!source) return;
      const duplicate: LayoutSection = {
        ...source,
        id: `${source.id}-copy-${Date.now()}`,
        position: sectionIdx + 1,
        blocks: source.blocks.map((block) => ({
          ...block,
          id: `${block.id}-copy-${Date.now()}`,
          config: { ...block.config },
        })),
      };
      nextSections.splice(sectionIdx + 1, 0, duplicate);
      nextSections.forEach((section, index) => {
        section.position = index;
      });
      onLayoutChange({ sections: nextSections });
    },
    [layout, onLayoutChange],
  );

  const handleMoveSection = useCallback(
    (sectionIdx: number, direction: -1 | 1) => {
      if (!onLayoutChange) return;
      const targetIdx = sectionIdx + direction;
      if (targetIdx < 0 || targetIdx >= layout.sections.length) return;
      const nextSections = cloneSections(layout);
      [nextSections[sectionIdx], nextSections[targetIdx]] = [
        nextSections[targetIdx],
        nextSections[sectionIdx],
      ];
      nextSections.forEach((section, index) => {
        section.position = index;
      });
      onLayoutChange({ sections: nextSections });
    },
    [layout, onLayoutChange],
  );

  const handleToggleSectionVisibility = useCallback(
    (sectionIdx: number) => {
      if (!onLayoutChange) return;
      const nextSections = cloneSections(layout);
      const section = nextSections[sectionIdx];
      if (!section) return;
      const shouldHide = section.blocks.some((item) => item.visible !== false);
      section.blocks.forEach((block) => {
        block.visible = !shouldHide;
      });
      onLayoutChange({ sections: nextSections });
    },
    [layout, onLayoutChange],
  );

  const handleRemoveSection = useCallback(
    (sectionIdx: number) => {
      if (!onLayoutChange) return;
      const nextSections = cloneSections(layout);
      nextSections.splice(sectionIdx, 1);
      nextSections.forEach((section, index) => {
        section.position = index;
      });
      onLayoutChange({ sections: nextSections });
      setRemovingSectionId(null);
    },
    [layout, onLayoutChange],
  );

  const handleRemove = useCallback(
    (sectionIdx: number, blockIdx: number) => {
      if (!onLayoutChange) return;
      const newSections = cloneSections(layout);
      newSections[sectionIdx].blocks.splice(blockIdx, 1);
      if (newSections[sectionIdx].blocks.length === 0) {
        // Remove empty sections.
        newSections.splice(sectionIdx, 1);
      } else {
        reindex(newSections[sectionIdx].blocks);
      }
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange],
  );

  const handleBlockDrop = useCallback(
    (sectionIdx: number, blockIdx: number, e: React.DragEvent) => {
      if (!onLayoutChange) return;
      e.preventDefault();
      const blockId = e.dataTransfer.getData("text/plain");
      if (!blockId) return;
      const newSections = cloneSections(layout);
      let sourceSectionIdx = -1;
      let sourceBlockIdx = -1;
      for (let si = 0; si < newSections.length; si++) {
        const index = newSections[si].blocks.findIndex((block) => block.id === blockId);
        if (index >= 0) {
          sourceSectionIdx = si;
          sourceBlockIdx = index;
          break;
        }
      }
      if (sourceSectionIdx < 0) return;
      const [moved] = newSections[sourceSectionIdx].blocks.splice(sourceBlockIdx, 1);
      if (sourceSectionIdx === sectionIdx && sourceBlockIdx < blockIdx) blockIdx--;
      const targetSection = newSections[sectionIdx];
      if (!targetSection) return;
      targetSection.blocks.splice(blockIdx, 0, moved);
      reindex(targetSection.blocks);
      if (newSections[sourceSectionIdx].blocks.length === 0 && sourceSectionIdx !== sectionIdx) {
        newSections.splice(sourceSectionIdx, 1);
      }
      newSections.forEach((section, index) => {
        section.position = index;
      });
      setDropTarget(null);
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange],
  );

  const handleDrop = useCallback(
    (sectionIdx: number, e: React.DragEvent) => {
      if (!onLayoutChange) return;
      e.preventDefault();
      const blockId = e.dataTransfer.getData("text/plain");
      if (!blockId) return;

      // Find source block and section in the persisted layout order.
      let srcSectionIdx = -1;
      let srcBlockIdx = -1;
      for (let si = 0; si < layout.sections.length; si++) {
        const bi = layout.sections[si].blocks.findIndex((b) => b.id === blockId);
        if (bi !== -1) {
          srcSectionIdx = si;
          srcBlockIdx = bi;
          break;
        }
      }
      if (srcBlockIdx === -1) return;

      const newSections = cloneSections(layout);
      const [moved] = newSections[srcSectionIdx].blocks.splice(srcBlockIdx, 1);
      const targetSection = newSections[sectionIdx];
      if (!targetSection) return;
      targetSection.blocks.push(moved);
      if (newSections[srcSectionIdx].blocks.length === 0) {
        newSections.splice(srcSectionIdx, 1);
        if (sectionIdx > srcSectionIdx) sectionIdx--;
      }
      const target =
        newSections[sectionIdx >= newSections.length ? newSections.length - 1 : sectionIdx];
      if (!target) return;
      reindex(target.blocks);
      newSections.forEach((section, index) => {
        section.position = index;
      });
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" data-page-layout>
      {sectionsToRender.map((section) => {
        const sectionIndex = sections.findIndex((candidate) => candidate.id === section.id);
        const layoutSectionIndex = layout.sections.findIndex(
          (candidate) => candidate.id === section.id,
        );
        const gridClass = SECTION_GRID[section.layout] ?? "";
        /** Grid-based (builder) sections render from their persisted 12-col
         *  grid; template sections fall back to SECTION_GRID + block.span. */
        const hasGrid = !context.isEditing && (section.grid?.length ?? 0) > 0;
        const gridByBlock = new Map((section.grid ?? []).map((item) => [item.i, item]));
        const blocks = section.blocks
          .filter((b) => context.isEditing || b.visible !== false)
          .sort((a, b) => a.position - b.position);
        const persistedBlocks = layout.sections[layoutSectionIndex]?.blocks ?? [];

        const isWhitespaceLed = WHITESPACE_LED_LAYOUTS.has(section.layout);

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            className={[
              context.isEditing ? "py-8 first:pt-0" : "py-[var(--spacing-section)] first:pt-0",
              isWhitespaceLed ? "" : "border-b border-border/35 last:border-b-0 last:pb-0",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(layoutSectionIndex, e)}
          >
            {context.isEditing && (
              <div className="studio-section-editor-bar mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/35 pb-2">
                <p className="text-xs text-muted-foreground">
                  Section {sectionIndex + 1}
                  <span className="ml-2 text-foreground">
                    · {section.blocks.map((block) => blockLabel(block.type)).join(" + ")}
                  </span>
                </p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={`Section ${sectionIndex + 1} actions`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="studio-editor-chrome w-48">
                    <DropdownMenuItem onClick={() => setConfiguringSectionId(section.id)}>
                      <LayoutGrid className="mr-2 h-3.5 w-3.5" /> Change layout
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateSection(layoutSectionIndex)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate section
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={sectionIndex === 0}
                      onClick={() => handleMoveSection(layoutSectionIndex, -1)}
                    >
                      <ChevronDown className="mr-2 h-3.5 w-3.5 rotate-180" /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={sectionIndex === sections.length - 1}
                      onClick={() => handleMoveSection(layoutSectionIndex, 1)}
                    >
                      <ChevronDown className="mr-2 h-3.5 w-3.5" /> Move down
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleSectionVisibility(layoutSectionIndex)}
                    >
                      {blocks.some((block) => block.visible !== false) ? (
                        <EyeOff className="mr-2 h-3.5 w-3.5" />
                      ) : (
                        <Eye className="mr-2 h-3.5 w-3.5" />
                      )}
                      {blocks.some((block) => block.visible !== false)
                        ? "Hide section"
                        : "Show section"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setRemovingSectionId(section.id)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete section
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {context.isEditing ? (
              <div
                className="studio-edit-canvas rounded-lg border border-dashed border-[var(--user-accent-border,var(--border))] bg-[var(--user-accent-subtle,var(--surface))]/10 p-2 sm:p-3"
                data-studio-edit-canvas
              >
                <StudioSectionGrid
                  section={section}
                  blocks={blocks}
                  onChange={(nextBlocks) => {
                    const nextSections = cloneSections(layout);
                    const targetSection = nextSections.find(
                      (candidate) => candidate.id === section.id,
                    );
                    if (!targetSection) return;
                    targetSection.blocks = nextBlocks;
                    onLayoutChange?.({ sections: nextSections });
                  }}
                  renderBlock={(block, bi) => (
                    <SortableBlock
                      block={block}
                      context={context}
                      isFirst={bi === 0}
                      isLast={bi === blocks.length - 1}
                      onMoveUp={() =>
                        handleMoveUp(
                          layoutSectionIndex,
                          persistedBlocks.findIndex((candidate) => candidate.id === block.id),
                        )
                      }
                      onMoveDown={() =>
                        handleMoveDown(
                          layoutSectionIndex,
                          persistedBlocks.findIndex((candidate) => candidate.id === block.id),
                        )
                      }
                      onRemove={() => {
                        setSelectedBlockId(null);
                        setRemovingBlockId(block.id);
                      }}
                      onConfigure={() => {
                        setSelectedBlockId(block.id);
                        setConfiguringBlockId(block.id);
                      }}
                      onResize={() => setResizingBlockId(block.id)}
                      gridManaged
                      isSelected={selectedBlockId === block.id}
                      isHidden={block.visible === false}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onConfigChange={(config) => onBlockConfigChange?.(block.id, config)}
                    />
                  )}
                />
              </div>
            ) : (
              <>
                {!context.isEditing && section.title && !/^area\s+\d+$/i.test(section.title) && (
                  <header className="mb-4 flex items-center gap-2">
                    <span
                      className="h-3 w-0.5 shrink-0"
                      style={{ backgroundColor: "var(--user-accent, var(--trust))" }}
                    />
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      {section.title}
                    </h2>
                  </header>
                )}
                <div
                  className={`${
                    hasGrid
                      ? "grid grid-cols-1 gap-8 md:grid-cols-12 content-safe"
                      : `${gridClass} content-safe ${context.isEditing ? "transition-colors" : ""}`
                  }`}
                  style={
                    hasGrid
                      ? { gridAutoFlow: "row dense", alignItems: "start" }
                      : gridClass
                        ? { gridAutoFlow: "row", alignItems: "start" }
                        : undefined
                  }
                  data-section-canvas={context.isEditing ? "true" : undefined}
                  data-section-grid={hasGrid ? "true" : undefined}
                >
                  {blocks.map((block, bi) => {
                    const persistedBlockIndex = persistedBlocks.findIndex(
                      (candidate) => candidate.id === block.id,
                    );
                    const gridItem = hasGrid ? gridByBlock.get(block.id) : undefined;
                    return (
                      <div
                        key={`drop-${block.id}`}
                        className={[
                          context.isEditing
                            ? "relative rounded-md border border-transparent p-1 transition-colors hover:border-card-border hover:bg-surface/20"
                            : hasGrid
                              ? gridItem
                                ? `relative min-w-0 ${colStartClass(gridItem.x + 1)} ${spanClass(gridItem.w)}`
                                : "relative min-w-0"
                              : "contents",
                          gridClass && !hasGrid && typeof block.span === "number"
                            ? spanClass(block.span)
                            : "",
                          dropTarget?.sectionIdx === layoutSectionIndex &&
                          dropTarget.blockIdx === bi
                            ? "border-t-2 border-[var(--user-accent,var(--trust))]"
                            : "",
                        ].join(" ")}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDropTarget({ sectionIdx: layoutSectionIndex, blockIdx: bi });
                        }}
                        onDrop={(event) =>
                          handleBlockDrop(layoutSectionIndex, persistedBlockIndex, event)
                        }
                      >
                        {context.isEditing ? (
                          <SortableBlock
                            block={block}
                            context={context}
                            isFirst={bi === 0}
                            isLast={bi === blocks.length - 1}
                            onMoveUp={() => handleMoveUp(layoutSectionIndex, persistedBlockIndex)}
                            onMoveDown={() =>
                              handleMoveDown(layoutSectionIndex, persistedBlockIndex)
                            }
                            onRemove={() => {
                              setSelectedBlockId(null);
                              setRemovingBlockId(block.id);
                            }}
                            onConfigure={() => {
                              setSelectedBlockId(block.id);
                              setConfiguringBlockId(block.id);
                            }}
                            onResize={() => {
                              setSelectedBlockId(block.id);
                              setResizingBlockId(block.id);
                            }}
                            isSelected={selectedBlockId === block.id}
                            isHidden={block.visible === false}
                            onSelect={() => setSelectedBlockId(block.id)}
                            onConfigChange={(config) => onBlockConfigChange?.(block.id, config)}
                          />
                        ) : (
                          <BlockRenderer
                            type={block.type}
                            config={block.config}
                            context={{
                              ...context,
                              blockId: block.id,
                              profileCompleteness:
                                block.type === "profile-header" ? profileCompleteness : undefined,
                              onCompleteProfile:
                                block.type === "profile-header" ? onCompleteProfile : undefined,
                              onBlockEmptyChange: context.isEditing ? undefined : reportBlockEmpty,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  {context.isEditing && blocks.length > 0 && (
                    <div
                      className={[
                        "col-span-full min-h-4 border-t border-dashed border-border/45 text-center text-[10px] text-muted-foreground/60 transition-colors",
                        dropTarget?.sectionIdx === layoutSectionIndex &&
                        dropTarget.blockIdx === persistedBlocks.length
                          ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent-subtle,var(--learning-subtle))]"
                          : "",
                      ].join(" ")}
                      aria-label={`Drop at end of section ${sectionIndex + 1}`}
                      role="button"
                      tabIndex={0}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget({
                          sectionIdx: layoutSectionIndex,
                          blockIdx: persistedBlocks.length,
                        });
                      }}
                      onDrop={(event) =>
                        handleBlockDrop(layoutSectionIndex, persistedBlocks.length, event)
                      }
                    >
                      <span className="sr-only">Drop section content here</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}

      {/* Remove section confirmation dialog */}
      <Dialog
        open={!!removingSectionId}
        onOpenChange={(open) => {
          if (!open) setRemovingSectionId(null);
        }}
      >
        <DialogContent className="studio-editor-chrome sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete section?</DialogTitle>
            <DialogDescription>
              This removes the section and all of its blocks from your Studio.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!removingSectionId) return;
                const sectionIdx = layout.sections.findIndex(
                  (section) => section.id === removingSectionId,
                );
                if (sectionIdx >= 0) handleRemoveSection(sectionIdx);
              }}
            >
              Delete section
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemovingSectionId(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removingBlockId}
        onOpenChange={(open) => {
          if (!open) setRemovingBlockId(null);
        }}
      >
        <DialogContent className="studio-editor-chrome sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove block?</DialogTitle>
            <DialogDescription>
              This removes the block from your page. Its content will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!removingBlockId) return;
                for (let si = 0; si < layout.sections.length; si++) {
                  const bi = layout.sections[si].blocks.findIndex((b) => b.id === removingBlockId);
                  if (bi !== -1) {
                    handleRemove(si, bi);
                    break;
                  }
                }
                setSelectedBlockId(null);
                setRemovingBlockId(null);
              }}
            >
              Remove
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRemovingBlockId(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {configuringSectionId && onLayoutChange && (
        <SectionLayoutPanel
          section={sections.find((candidate) => candidate.id === configuringSectionId)}
          onClose={() => setConfiguringSectionId(null)}
          onChange={(layoutType) => {
            const next = cloneSections(layout);
            const section = next.find((candidate) => candidate.id === configuringSectionId);
            if (!section) return;
            section.layout = layoutType;
            onLayoutChange({ sections: next });
            setConfiguringSectionId(null);
          }}
        />
      )}

      {resizingBlock && onLayoutChange && (
        <div className="studio-editor-chrome fixed inset-x-3 bottom-3 z-50 rounded-xl border border-card-border bg-surface-elevated p-4 shadow-xl sm:inset-x-auto sm:right-3 sm:top-24 sm:bottom-auto sm:w-72">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resize block
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Set how much of the section grid it occupies.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setResizingBlockId(null)}
              aria-label="Close resize panel"
            >
              ×
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 6, 12].map((span) => (
              <Button
                key={span}
                type="button"
                variant={resizingBlock.span === span ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const next = cloneSections(layout);
                  const target = next
                    .flatMap((section) => section.blocks)
                    .find((block) => block.id === resizingBlock.id);
                  if (!target) return;
                  target.span = span;
                  onLayoutChange({ sections: next });
                  setResizingBlockId(null);
                }}
              >
                {span}/12
              </Button>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Choose a width to change the block size. On single-column sections, blocks remain full
            width.
          </p>
        </div>
      )}

      {/* Inline block settings */}
      {configuredBlock && configuredDefinition && (
        <InlineInspector
          block={configuredBlock}
          definition={configuredDefinition}
          ownerId={context.ownerId}
          profileMedia={configuredBlock.type === "profile-header" ? profileMedia : undefined}
          onProfileMediaSaved={onProfileMediaSaved}
          onBlockLayoutChange={(layoutChange) => {
            if (!onLayoutChange) return;
            const next = cloneSections(layout);
            const section = next.find((candidate) =>
              candidate.blocks.some((item) => item.id === configuredBlock.id),
            );
            const target = section?.blocks.find((item) => item.id === configuredBlock.id);
            if (!target) return;
            Object.assign(target, layoutChange);
            onLayoutChange({ sections: next });
          }}
          onChange={(config) => onBlockConfigChange?.(configuredBlock.id, config)}
          onRemove={() => {
            setConfiguringBlockId(null);
            setSelectedBlockId(null);
            setRemovingBlockId(configuredBlock.id);
          }}
          onClose={() => setConfiguringBlockId(null)}
        />
      )}
    </div>
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function cloneSections(layout: PageLayoutType): LayoutSection[] {
  return layout.sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => ({ ...b, config: { ...b.config } })),
  }));
}

function reindex(blocks: { position: number }[]) {
  blocks.forEach((b, i) => {
    b.position = i;
  });
}

function SectionLayoutPanel({
  section,
  onClose,
  onChange,
}: {
  section: LayoutSection | undefined;
  onClose: () => void;
  onChange: (layout: SectionLayoutType) => void;
}) {
  if (!section) return null;
  const options: Array<[SectionLayoutType, string]> = [
    ["full", "Full width"],
    ["two_column", "Two columns"],
    ["three_column", "Three columns"],
    ["sidebar_left", "Sidebar left"],
    ["sidebar_right", "Sidebar right"],
    ["feature", "Feature + support"],
    ["side_by_side", "Side by side"],
  ];
  return (
    <div className="studio-editor-chrome fixed inset-x-3 bottom-3 z-50 rounded-xl border border-card-border bg-surface-elevated p-4 shadow-xl sm:inset-x-auto sm:right-3 sm:top-24 sm:bottom-auto sm:w-72">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Change section layout</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose how the blocks in this section should be arranged.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
          aria-label="Close section layout"
        >
          ×
        </Button>
      </div>
      <div className="grid gap-1.5">
        {options.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={section.layout === value ? "default" : "outline"}
            size="sm"
            className="justify-between text-xs"
            onClick={() => onChange(value)}
          >
            <span>{label}</span>
            {section.layout === value && <span className="text-[10px] opacity-75">Current</span>}
          </Button>
        ))}
      </div>
    </div>
  );
}

function spanClass(span: number): string {
  const classes = [
    "md:col-span-1",
    "md:col-span-2",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-5",
    "md:col-span-6",
    "md:col-span-7",
    "md:col-span-8",
    "md:col-span-9",
    "md:col-span-10",
    "md:col-span-11",
    "md:col-span-12",
  ];
  return classes[Math.min(classes.length, Math.max(1, Math.round(span))) - 1];
}

function colStartClass(column: number): string {
  const classes = [
    "md:col-start-1",
    "md:col-start-2",
    "md:col-start-3",
    "md:col-start-4",
    "md:col-start-5",
    "md:col-start-6",
    "md:col-start-7",
    "md:col-start-8",
    "md:col-start-9",
    "md:col-start-10",
    "md:col-start-11",
    "md:col-start-12",
  ];
  return classes[Math.min(classes.length, Math.max(1, Math.round(column))) - 1];
}
