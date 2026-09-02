// ── Sortable Block ────────────────────────────────────────────────────────────
// Wraps each block in edit mode with controls: move up/down, remove, and a
// click target to open the block config panel. Uses HTML5 drag handles for
// free reordering within a section.

import { useCallback } from "react";
import { ArrowUp, ArrowDown, GripVertical, Trash2, Settings2, Maximize2 } from "lucide-react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import type { LayoutBlockInstance, BlockContext } from "@/lib/page-blocks";

interface SortableBlockProps {
  block: LayoutBlockInstance;
  context: BlockContext;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onConfigure: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  onResize: () => void;
}

export function SortableBlock({
  block,
  context,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onConfigure,
  onConfigChange,
  onResize,
}: SortableBlockProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", block.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [block.id],
  );

  return (
    <div
      className="group/edit relative rounded-lg border border-transparent transition-colors hover:border-card-border"
      draggable
      onDragStart={handleDragStart}
      data-block-id={block.id}
    >
      {/* Block controls stay visible in Customize mode so the primary edit path
          is discoverable on touch devices as well as with a mouse. */}
      <div className="absolute -top-3 right-2 z-10 flex flex-wrap items-center gap-1 rounded-md border border-card-border bg-surface-elevated px-1.5 py-1 opacity-100 shadow-sm sm:opacity-0 sm:group-hover/edit:opacity-100 sm:group-focus-within/edit:opacity-100">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground"
          title="Drag to reorder"
          aria-label={`Drag ${block.type} block to reorder`}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && !isFirst) {
              e.preventDefault();
              onMoveUp();
            }
            if (e.key === "ArrowDown" && !isLast) {
              e.preventDefault();
              onMoveDown();
            }
          }}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Reorder</span>
        </button>
        <button
          type="button"
          aria-label={`Move ${block.type} block up`}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          <span className="sr-only">Move up</span>
        </button>
        <button
          type="button"
          aria-label={`Move ${block.type} block down`}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={onMoveDown}
          disabled={isLast}
          title="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          <span className="sr-only">Move down</span>
        </button>
        <button
          type="button"
          aria-label={`Resize ${block.type} block`}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={onResize}
          title="Resize block"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="sr-only">Resize</span>
        </button>
        <button
          type="button"
          aria-label={`Edit ${block.type} block`}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={onConfigure}
          title="Edit block"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="sr-only">Edit content</span>
        </button>
        <button
          type="button"
          aria-label={`Remove ${block.type} block`}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Remove</span>
        </button>
      </div>

      {/* Visually hidden label for accessibility */}
      <span className="sr-only">{block.type} block</span>

      {/* Block content */}
      <BlockRenderer
        type={block.type}
        config={block.config}
        context={{ ...context, blockId: block.id }}
        onChange={onConfigChange}
      />
    </div>
  );
}
