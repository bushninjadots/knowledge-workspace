// ── Sortable Block ────────────────────────────────────────────────────────────
// Wraps each block in edit mode with controls: move up/down, remove, and a
// click target to open the block config panel. Uses HTML5 drag handles for
// free reordering within a section.

import { useCallback } from "react";
import { ArrowUp, ArrowDown, GripVertical, Trash2, Settings2 } from "lucide-react";
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
      {/* Hover controls */}
      <div className="absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-card-border bg-surface-elevated px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover/edit:opacity-100">
        <button
          type="button"
          className="cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground"
          title="Drag to reorder"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={onMoveDown}
          disabled={isLast}
          title="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={onConfigure}
          title="Configure"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Visually hidden label for accessibility */}
      <span className="sr-only">{block.type} block</span>

      {/* Block content */}
      <BlockRenderer
        type={block.type}
        config={block.config}
        context={context}
        onChange={onConfigChange}
      />
    </div>
  );
}