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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PageLayout as PageLayoutType, BlockContext, LayoutSection } from "@/lib/page-blocks";

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  /** Called when the layout changes (edit mode only). */
  onLayoutChange?: (layout: PageLayoutType) => void;
  /** Called when a block's config changes. */
  onBlockConfigChange?: (blockId: string, config: Record<string, unknown>) => void;
  /** When set, overrides responsive breakpoints to match the preview mode. */
  devicePreview?: "desktop" | "tablet" | "mobile";
}

/** Tailwind grid classes for each section layout type. */
const SECTION_GRID: Record<string, string> = {
  full: "",
  two_column: "grid grid-cols-1 md:grid-cols-2 gap-6",
  three_column: "grid grid-cols-1 md:grid-cols-3 gap-6",
  sidebar_left: "grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6",
  sidebar_right: "grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6",
  feature: "grid grid-cols-1 md:grid-cols-2 gap-6",
};

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
  devicePreview,
}: PageLayoutRendererProps) {
  const sections = [...layout.sections].sort((a, b) => a.position - b.position);

  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

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
      newSections[sectionIdx].blocks.push(moved);
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
      {sections.map((section, si) => {            // Override grid classes based on device preview.
            // Mobile: always single column. Tablet: max 2 columns.
            let gridClass = SECTION_GRID[section.layout] ?? "";
            if (devicePreview === "mobile") {
              gridClass = gridClass.replace(/md:grid-cols-\S+/g, "grid-cols-1");
            } else if (devicePreview === "tablet") {
              gridClass = gridClass.replace(/md:grid-cols-3/g, "md:grid-cols-2");
              gridClass = gridClass.replace(/md:grid-cols-\[\S+\]/g, "md:grid-cols-2");
            }
        const blocks = section.blocks
          .filter((b) => b.visible !== false)
          .sort((a, b) => a.position - b.position);

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            className="py-4 first:pt-0 last:pb-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(si, e)}
          >
            <div className={gridClass}>
              {blocks.map((block, bi) =>
                context.isEditing ? (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    context={context}
                    isFirst={bi === 0}
                    isLast={bi === blocks.length - 1}
                    onMoveUp={() => handleMoveUp(si, bi)}
                    onMoveDown={() => handleMoveDown(si, bi)}
                    onRemove={() => setRemovingBlockId(block.id)}
                    onConfigure={() => {
                      /* config is handled by onChange prop */
                    }}
                    onConfigChange={(config) => onBlockConfigChange?.(block.id, config)}
                  />
                ) : (
                  <BlockRenderer
                    key={block.id}
                    type={block.type}
                    config={block.config}
                    context={context}
                  />
                ),
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
