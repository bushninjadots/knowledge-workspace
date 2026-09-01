import { GripVertical, ArrowUp, ArrowDown, Copy, Eye, EyeOff } from "lucide-react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import {
  frameForDevice,
  FREEFORM_COLUMNS,
  clampFrame,
} from "@/components/tethyr/page/page-composition";
import type { BlockContext, LayoutBlockInstance } from "@/lib/page-blocks";
import type { DevicePreview } from "@/components/tethyr/page/page-composition";

export function FreeformBlockCard({
  block,
  idx,
  sectionId: _sectionId,
  blockContext,
  devicePreview,
  onSelect,
  onPointerStart,
  onFrameChange,
  onToggleVisibility,
  onDuplicateBlock,
  onMoveBlock,
  onConfigChange,
}: {
  block: LayoutBlockInstance;
  idx: number;
  sectionId: string;
  blockContext: BlockContext;
  devicePreview?: DevicePreview;
  onSelect: (id: string) => void;
  onPointerStart: (event: React.PointerEvent, kind: "move" | "resize") => void;
  onFrameChange: (
    id: string,
    frame: { x: number; y: number; width: number; height?: number },
  ) => void;
  onToggleVisibility: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
  onMoveBlock: (id: string, direction: "up" | "down") => void;
  onConfigChange: (id: string, config: Record<string, unknown>) => void;
}) {
  const frame = frameForDevice(block.frames, devicePreview) ?? {
    x: 0,
    y: idx * 4,
    width: FREEFORM_COLUMNS,
    height: 4,
  };
  const hidden = block.visible === false;

  return (
    <div
      className={`group/freeform relative min-w-0 ${hidden ? "opacity-30" : ""}`}
      style={{
        gridColumn: `${frame.x + 1} / span ${Math.max(1, Math.min(FREEFORM_COLUMNS, frame.width))}`,
        gridRowStart: frame.y + 1,
        minHeight: frame.height ? `${frame.height * 48}px` : undefined,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(block.id);
      }}
      data-freeform-block={block.id}
    >
      <button
        type="button"
        className="absolute -left-5 top-2 z-20 rounded p-1 opacity-0 transition-opacity group-hover/freeform:opacity-100 focus-visible:opacity-100"
        aria-label={`Move block ${idx + 1}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerStart(event, "move");
        }}
        onKeyDown={(event) => {
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
          ) {
            event.preventDefault();
            const delta = event.shiftKey ? 5 : 1;
            if (
              event.key === "ArrowUp" ||
              event.key === "ArrowDown" ||
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight"
            ) {
              onFrameChange(
                block.id,
                clampFrame({
                  ...frame,
                  x:
                    frame.x +
                    (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0),
                  y:
                    frame.y +
                    (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0),
                }),
              );
            } else {
              onMoveBlock(block.id, event.key === "Home" ? "up" : "down");
            }
          }
        }}
      >
        <GripVertical className="h-3.5 w-3.5 cursor-grab text-muted-foreground/50" />
      </button>
      <BlockRenderer
        type={block.type}
        config={block.config}
        context={blockContext}
        onChange={(config) => onConfigChange(block.id, config)}
      />
      <div className="absolute -top-7 right-1 z-20 hidden items-center gap-0.5 rounded-md border border-border/40 bg-surface-elevated px-1 py-0.5 shadow-sm group-hover/freeform:flex">
        <button
          type="button"
          onClick={() => onMoveBlock(block.id, "up")}
          aria-label="Move block up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onMoveBlock(block.id, "down")}
          aria-label="Move block down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicateBlock(block.id)}
          aria-label="Duplicate block"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onToggleVisibility(block.id)}
          aria-label={hidden ? "Show block" : "Hide block"}
        >
          {hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
      </div>
      <button
        type="button"
        aria-label={`Resize block ${idx + 1}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerStart(event, "resize");
        }}
        className="absolute bottom-1 right-1 z-20 h-3 w-3 cursor-se-resize rounded-sm bg-primary/60 opacity-0 transition-opacity group-hover/freeform:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}
