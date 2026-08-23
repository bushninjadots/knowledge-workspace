// ── Studio Canvas ────────────────────────────────────────────────────────────
// Center panel: renders the real page with contextual hover controls and
// drag-to-reorder for blocks.

import { useState, useCallback } from "react";
import { GripVertical, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import { PageLayoutRenderer } from "@/components/tethyr/page/page-layout";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudioPage } from "./studio";
import type { BlockContext, PageData, PageLayout, LayoutBlockInstance } from "@/lib/page-blocks";

interface StudioCanvasProps {
  page: StudioPage;
  pageData: PageData | undefined | null;
  pageLoading: boolean;
  pageError: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onRemoveBlock: (blockId: string) => void;
  onToggleVisibility: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onAddBlock: (blockType: string) => void;
  onReorderBlocks: (sectionId: string, blockId: string, targetIndex: number) => void;
  onLayoutChange: (layout: PageLayout) => void;
  onRefetch: () => void;
}

export function StudioCanvas({
  page, pageData, pageLoading, pageError,
  selectedBlockId, onSelectBlock,
  onRemoveBlock, onToggleVisibility, onMoveBlock,
  onAddBlock, onReorderBlocks, onRefetch,
}: StudioCanvasProps) {
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, blockId: string) => {
    e.dataTransfer.setData("text/plain", blockId);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.4";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragOverBlockId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverBlockId(blockId);
  }, []);

  const handleDrop = useCallback((
    e: React.DragEvent,
    sectionId: string,
    targetBlockId: string,
    targetIndex: number,
  ) => {
    e.preventDefault();
    const draggedBlockId = e.dataTransfer.getData("text/plain");
    if (draggedBlockId && draggedBlockId !== targetBlockId) {
      onReorderBlocks(sectionId, draggedBlockId, targetIndex);
    }
    setDragOverBlockId(null);
  }, [onReorderBlocks]);
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

  const layout: PageLayout = pageData.layout ?? { sections: [] };

  if (layout.sections.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-xs text-center">
          <p className="text-sm text-foreground font-medium">Your page is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add blocks from the left sidebar to start building your {page.type === "profile" ? "studio" : "project"} page.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {(["text", "heading", "project-hero", "project-status"]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onAddBlock(type)}
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
    <div className="space-y-3">
      {layout.sections.map((section) => (
        <div key={section.id} className="space-y-2">
          {section.blocks.map((block, idx) => {
            const isSelected = selectedBlockId === block.id;
            const isHidden = block.visible === false;
            const isFirst = idx === 0;
            const isLast = idx === section.blocks.length - 1;
            const isDragOver = dragOverBlockId === block.id;

            return (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, block.id)}
                onDragLeave={() => setDragOverBlockId(null)}
                onDrop={(e) => handleDrop(e, section.id, block.id, idx)}
                className={`group/block relative rounded-md transition-all ${
                  isSelected
                    ? "ring-2 ring-primary/30 bg-primary/[0.03]"
                    : isDragOver
                      ? "ring-2 ring-primary/20 bg-primary/[0.05]"
                      : "ring-1 ring-transparent hover:ring-border/20"
                } ${isDragOver ? "scale-[1.01]" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectBlock(block.id);
                }}
              >
                {/* Block content */}
                <div className={isHidden ? "opacity-30" : ""}>
                  <SingleBlockRenderer block={block} context={blockContext} />
                </div>

                {/* Hover controls — top-right corner */}
                <div className="pointer-events-none absolute -top-0 right-0 z-10 flex -translate-y-full items-center gap-0.5 rounded-md border border-border/30 bg-surface-elevated p-0.5 opacity-0 shadow-sm transition-opacity group-hover/block:opacity-100">
                  {/* Drag handle */}
                  <span
                    className="pointer-events-auto rounded p-1 text-muted-foreground/50 cursor-grab active:cursor-grabbing"
                    aria-label="Drag to reorder"
                  >
                    <GripVertical className="h-3 w-3" />
                  </span>
                  {!isFirst && (
                    <button
                      type="button"
                      className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Move up"
                      onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, "up"); }}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                  )}
                  {!isLast && (
                    <button
                      type="button"
                      className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Move down"
                      onClick={(e) => { e.stopPropagation(); onMoveBlock(block.id, "down"); }}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  )}
                  <span className="h-3 w-px bg-border/40" />
                  <button
                    type="button"
                    className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={isHidden ? "Show block" : "Hide block"}
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(block.id); }}
                  >
                    {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    className="pointer-events-auto rounded p-1 text-muted-foreground hover:text-red-400"
                    aria-label="Remove block"
                    onClick={(e) => { e.stopPropagation(); onRemoveBlock(block.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Selected indicator — subtle left border */}
                {isSelected && (
                  <div className="absolute left-0 top-0 h-full w-0.5 rounded-l-md bg-primary/40" />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Add section button at bottom */}
      <button
        type="button"
        onClick={() => {
          // Open the sidebar to blocks tab — signal via a simple add
          // Not ideal but functional: just pick text block as default
          onAddBlock("text-block");
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 py-4 text-xs text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add section
      </button>
    </div>
  );
}

// ── Single block renderer ────────────────────────────────────────────────────

function SingleBlockRenderer({
  block, context,
}: {
  block: LayoutBlockInstance;
  context: BlockContext;
}) {
  const layout: PageLayout = {
    sections: [{ id: "single", position: 0, layout: "full", blocks: [block] }],
  };
  return <PageLayoutRenderer layout={layout} context={context} />;
}