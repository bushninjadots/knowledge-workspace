// ── Studio Canvas ────────────────────────────────────────────────────────────// Center panel: renders the real page with selection outlines, a contextual
// floating toolbar for the selected block, drag-to-reorder, and section
// click areas. Width control is handled exclusively by the inspector.

import { useState, useCallback } from "react";
import {
  GripVertical,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
} from "lucide-react";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudioPage, SelectionType } from "./studio";
import type { SectionPreset } from "./section-presets";
import type {
  BlockContext,
  PageData,
  PageLayout,
  LayoutBlockInstance,
} from "@/lib/page-blocks";

interface StudioCanvasProps {
  page: StudioPage;
  pageData: PageData | undefined | null;
  layout: PageLayout;
  pageLoading: boolean;
  pageError: boolean;
  selectionType: SelectionType;
  selectedBlockId: string | null;
  selectedSectionId: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onSelectPage: () => void;
  onRemoveBlock: (blockId: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onToggleVisibility: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onAddBlock: (blockType: string) => void;
  onAddSection: (preset: SectionPreset) => void;
  onUpdateBlockConfig: (blockId: string, config: Record<string, unknown>) => void;
  onDuplicateBlock: (blockId: string) => void;
  onReorderBlocks: (sectionId: string, blockId: string, targetIndex: number) => void;
  onLayoutChange: (layout: PageLayout) => void;
  onRefetch: () => void;
}

export function StudioCanvas({
  page,
  pageData,
  layout,
  pageLoading,
  pageError,
  selectionType: _selectionType,
  selectedBlockId,
  selectedSectionId,
  onSelectBlock,
  onSelectSection,
  onSelectPage,
  onRemoveBlock,
  onRemoveSection: _onRemoveSection,
  onToggleVisibility,
  onMoveBlock,
  onAddBlock,
  onAddSection,
  onUpdateBlockConfig: _onUpdateBlockConfig,
  onDuplicateBlock,
  onReorderBlocks,
  onLayoutChange,
  onRefetch,
}: StudioCanvasProps) {
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"block" | "section" | null>(null);

  // ── Block drag handlers ───────────────────────────────────────────────
  const handleBlockDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData("text/plain", `block:${blockId}`);
    e.dataTransfer.effectAllowed = "move";
    setDragType("block");
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragOverBlockId(null);
    setDragOverSectionId(null);
    setDragType(null);
  }, []);

  const handleBlockDragOver = useCallback((e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverBlockId(blockId);
  }, []);

  // ── Section drag handlers ─────────────────────────────────────────────
  const handleSectionDragStart = useCallback((e: React.DragEvent, sectionId: string) => {
    e.dataTransfer.setData("text/plain", `section:${sectionId}`);
    e.dataTransfer.effectAllowed = "move";
    setDragType("section");
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleSectionDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverSectionId(sectionId);
  }, []);

  const handleSectionDrop = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer.getData("text/plain");
      if (!data.startsWith("section:")) return;
      const sourceId = data.replace("section:", "");
      if (sourceId === targetSectionId) return;
      // Reorder sections
      const sections = layout.sections.map((s) => ({ ...s, blocks: [...s.blocks] }));
      const srcIdx = sections.findIndex((s) => s.id === sourceId);
      const tgtIdx = sections.findIndex((s) => s.id === targetSectionId);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const [moved] = sections.splice(srcIdx, 1);
      sections.splice(tgtIdx, 0, moved);
      onLayoutChange({ sections });
      setDragOverSectionId(null);
      setDragType(null);
    },
    [layout, onLayoutChange],
  );

  const handleBlockDrop = useCallback(
    (e: React.DragEvent, sectionId: string, targetBlockId: string, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      const data = e.dataTransfer.getData("text/plain");
      if (data.startsWith("block:")) {
        const blockId = data.replace("block:", "");
        if (blockId && blockId !== targetBlockId) {
          onReorderBlocks(sectionId, blockId, targetIndex);
        }
      }
      setDragOverBlockId(null);
    },
    [onReorderBlocks],
  );

  if (pageLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (pageError || !pageData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">This page couldn't be loaded.</p>
          <button
            type="button"
            onClick={() => onRefetch()}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const blockContext: BlockContext = {
    ownerId: page.id,
    ownerType: page.type,
    pageId: pageData.id,
    isEditing: true,
  };

  if (layout.sections.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" onClick={onSelectPage}>
        <div className="max-w-xs text-center">
          <p className="text-sm text-foreground font-medium">Your page is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a section to start building your {page.type === "profile" ? "studio" : "project"}{" "}
            page.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {["text", "heading", "project-hero", "project-status"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBlock(type);
                }}
                className="rounded-md border border-border/30 bg-surface/40 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
              >
                <Plus className="mr-1 inline h-3 w-3" />
                {type.replace("-block", "").replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" onClick={onSelectPage}>
      {layout.sections.map((section, sectionIdx) => {
        const isSectionSelected = selectedSectionId === section.id;

        return (
          <div
            key={section.id}
            className={`group/section relative rounded-lg transition-all ${
              isSectionSelected
                ? "ring-2 ring-primary/25 bg-primary/[0.02]"
                : dragOverSectionId === section.id && dragType === "section"
                  ? "ring-2 ring-primary/20 bg-primary/[0.05]"
                  : "ring-1 ring-transparent hover:ring-border/20"
            }`}
            draggable
            onDragStart={(e) => handleSectionDragStart(e, section.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleSectionDragOver(e, section.id)}
            onDragLeave={() => setDragOverSectionId(null)}
            onDrop={(e) => handleSectionDrop(e, section.id)}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onSelectSection(section.id);
              }
            }}
          >
            {/* Section drag handle — visible on hover */}
            <div className="pointer-events-none absolute -left-1 top-2 z-20 opacity-0 group-hover/section:opacity-100 transition-opacity">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing pointer-events-auto" />
            </div>

            {/* Section label — shown when section is selected */}
            {isSectionSelected && (
              <div className="pointer-events-none absolute -top-2 left-3 z-20 rounded bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                Section {sectionIdx + 1} · {section.layout.replace("_", " ")}
              </div>
            )}

            <div className="space-y-2 p-2">
              {section.blocks.map((block, idx) => {
                const isSelected = selectedBlockId === block.id;
                const isHidden = block.visible === false;
                const isDragOver = dragOverBlockId === block.id;

                const blockWidth = (block.config?.width as string) ?? "full";
                const widthClass =
                  blockWidth === "2/3"
                    ? "w-2/3"
                    : blockWidth === "1/2"
                      ? "w-1/2"
                      : blockWidth === "1/3"
                        ? "w-1/3"
                        : blockWidth === "auto"
                          ? "w-auto"
                          : "w-full";

                return (
                  <div
                    key={block.id}
                    className={`group/block relative rounded-md transition-all ${widthClass} ${
                      isSelected
                        ? "ring-2 ring-primary/30 bg-primary/[0.03]"
                        : isDragOver
                          ? "ring-2 ring-primary/20 bg-primary/[0.05]"
                          : "ring-1 ring-transparent hover:ring-border/20"
                    } ${isDragOver ? "scale-[1.01]" : ""}`}
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, block.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleBlockDragOver(e, block.id)}
                    onDragLeave={() => setDragOverBlockId(null)}
                    onDrop={(e) => handleBlockDrop(e, section.id, block.id, idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBlock(block.id);
                    }}
                  >
                    {/* Block content */}
                    <div className={isHidden ? "opacity-30" : ""}>
                      <SingleBlockRenderer block={block} context={blockContext} />
                    </div>

                    {/* Floating toolbar — shown only when this block is selected */}
                    {isSelected && (
                      <div className="absolute -top-8 left-1/2 z-30 -translate-x-1/2 flex items-center gap-0.5 rounded-md border border-border/40 bg-surface-elevated px-1.5 py-1 shadow-md">
                        <span className="px-1.5 text-[10px] font-medium text-foreground select-none">
                          {getBlockLabel(block)}
                        </span>
                        <span className="h-3.5 w-px bg-border/40" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveBlock(block.id, "up");
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveBlock(block.id, "down");
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateBlock(block.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Duplicate"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisibility(block.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label={isHidden ? "Show block" : "Hide block"}
                        >
                          {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveBlock(block.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-red-400"
                          aria-label="Delete block"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    {/* Selected indicator — left border accent */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 h-full w-0.5 rounded-l-md bg-primary/40" />
                    )}
                  </div>
                );
              })}

              {/* Add block button at bottom of section */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBlock("text");
                }}
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border/30 py-2 text-[10px] text-muted-foreground/50 transition-colors hover:border-border/50 hover:text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
                Add block
              </button>
            </div>
          </div>
        );
      })}

      {/* Add section button at bottom */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // Add a default blank section
          onAddSection({
            id: "blank",
            label: "Blank",
            description: "Empty section",
            icon: "Square",
            layout: "full",
          });
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 py-4 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add section
      </button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

import { getBlock } from "@/lib/block-registry";

function getBlockLabel(block: LayoutBlockInstance): string {
  const def = getBlock(block.type);
  return def?.label ?? block.type.replace(/-/g, " ");
}

// ── Single block renderer ────────────────────────────────────────────────────

function SingleBlockRenderer({
  block,
  context,
}: {
  block: LayoutBlockInstance;
  context: BlockContext;
}) {
  const layout: PageLayout = {
    sections: [{ id: "single", position: 0, layout: "full", blocks: [block] }],
  };
  return <PageLayoutRenderer layout={layout} context={context} />;
}
