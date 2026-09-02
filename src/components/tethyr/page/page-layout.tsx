// ── Page Layout ───────────────────────────────────────────────────────────────
// Renders a PageLayout: an ordered list of sections, each with a column
// arrangement (full, two_column, three_column, sidebar, feature).
// Each section contains an ordered list of blocks.
//
// In edit mode, blocks are wrapped in SortableBlock with move/remove controls
// and drag-and-drop reordering.

import { memo, useCallback, useState } from "react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import { SortableBlock } from "@/components/tethyr/page/sortable-block";
import { InlineInspector } from "@/components/tethyr/studio/inline-inspector";
import { Button } from "@/components/ui/button";
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

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  /** Called when the layout changes (edit mode only). */
  onLayoutChange?: (layout: PageLayoutType) => void;
  /** Called when a block's config changes. */
  onBlockConfigChange?: (blockId: string, config: Record<string, unknown>) => void;
  profileMedia?: { avatarUrl: string | null; bannerUrl: string | null };
  onProfileMediaSaved?: () => void;
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
}: PageLayoutRendererProps) {
  const sections = [...layout.sections].sort((a, b) => a.position - b.position);

  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);
  const [configuringBlockId, setConfiguringBlockId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sectionIdx: number; blockIdx: number } | null>(
    null,
  );

  // The block currently being configured (inspector target).
  const configuredBlock: LayoutBlockInstance | undefined = configuringBlockId
    ? sections.flatMap((s) => s.blocks).find((b) => b.id === configuringBlockId)
    : undefined;
  const configuredDefinition = configuredBlock ? getBlock(configuredBlock.type) : undefined;

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

      // Find source block and section.
      let srcSectionIdx = -1;
      let srcBlockIdx = -1;
      for (let si = 0; si < sections.length; si++) {
        const bi = sections[si].blocks.findIndex((b) => b.id === blockId);
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
      reindex(
        newSections[sectionIdx >= newSections.length ? newSections.length - 1 : sectionIdx].blocks,
      );
      onLayoutChange({ sections: newSections });
    },
    [layout, onLayoutChange, sections],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" data-page-layout>
      {sections.map((section, si) => {
        const gridClass = SECTION_GRID[section.layout] ?? "";
        const blocks = section.blocks
          .filter((b) => b.visible !== false)
          .sort((a, b) => a.position - b.position);

        const isWhitespaceLed = WHITESPACE_LED_LAYOUTS.has(section.layout);

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            className={[
              "py-[var(--spacing-section)] first:pt-0",
              isWhitespaceLed ? "" : "border-b border-border/35 last:border-b-0 last:pb-0",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(si, e)}
          >
            <div
              className={`${gridClass} content-safe`}
              style={gridClass ? { gridAutoFlow: "row", alignItems: "start" } : undefined}
            >
              {blocks.map((block, bi) => (
                <div
                  key={`drop-${block.id}`}
                  className={[
                    "contents",
                    gridClass && typeof block.span === "number" ? spanClass(block.span) : "",
                    dropTarget?.sectionIdx === si && dropTarget.blockIdx === bi
                      ? "[&>div]:border-t-2 [&>div]:border-[var(--user-accent,var(--trust))]"
                      : "",
                  ].join(" ")}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropTarget({ sectionIdx: si, blockIdx: bi });
                  }}
                  onDrop={(event) => handleBlockDrop(si, bi, event)}
                >
                  {context.isEditing ? (
                    <SortableBlock
                      block={block}
                      context={context}
                      isFirst={bi === 0}
                      isLast={bi === blocks.length - 1}
                      onMoveUp={() => handleMoveUp(si, bi)}
                      onMoveDown={() => handleMoveDown(si, bi)}
                      onRemove={() => setRemovingBlockId(block.id)}
                      onConfigure={() => setConfiguringBlockId(block.id)}
                      onConfigChange={(config) => onBlockConfigChange?.(block.id, config)}
                    />
                  ) : (
                    <BlockRenderer
                      type={block.type}
                      config={block.config}
                      context={{ ...context, blockId: block.id }}
                    />
                  )}
                </div>
              ))}
              {/* Empty tail drop target makes moving a block to the end explicit. */}
              {context.isEditing && blocks.length > 0 && (
                <div
                  className={[
                    "min-h-8 rounded-sm border border-dashed border-border/50 bg-surface/30 text-center text-[10px] text-muted-foreground/60 transition-colors",
                    dropTarget?.sectionIdx === si && dropTarget.blockIdx === blocks.length
                      ? "border-[var(--user-accent,var(--trust))] bg-[var(--user-accent-subtle,var(--learning-subtle))]"
                      : "",
                  ].join(" ")}
                  aria-label={`Drop at end of section ${si + 1}`}
                  role="button"
                  tabIndex={0}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropTarget({ sectionIdx: si, blockIdx: blocks.length });
                  }}
                  onDrop={(event) => handleBlockDrop(si, blocks.length, event)}
                >
                  <span className="pointer-events-none select-none">Drop here to place at end</span>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removingBlockId}
        onOpenChange={(open) => {
          if (!open) setRemovingBlockId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
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
