import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GridLayout,
  useContainerWidth,
  noCompactor,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { Magnet, Move3d, Rows3, Columns3, ArrowDownToLine } from "lucide-react";
import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";

const COLS = 12;
const ROW_HEIGHT = 22;
const MARGIN: readonly [number, number] = [12, 12];
const MIN_ROWS = 3;
/** Elements that must stay clickable instead of starting a drag. */
const DRAG_CANCEL =
  "button, a, input, textarea, select, label, [role='button'], [contenteditable='true'], .studio-no-drag";

type Device = "desktop" | "tablet" | "mobile";
type SnapMode = "stack" | "free";

interface StudioSectionGridProps {
  section: LayoutSection;
  blocks: LayoutBlockInstance[];
  renderBlock: (block: LayoutBlockInstance, index: number) => React.ReactNode;
  onChange: (blocks: LayoutBlockInstance[]) => void;
}

/**
 * Editing-only canvas. Blocks snap to a 12-column grid, can be dragged from
 * anywhere on their surface, resized from any edge or corner, and remember
 * their placement per device in `block.frames`. "Stack" snaps blocks upward so
 * there are never floating gaps; "Free" keeps whatever position you drop them
 * in so deliberate whitespace survives.
 */
export function StudioSectionGrid({
  section,
  blocks,
  renderBlock,
  onChange,
}: StudioSectionGridProps) {
  const { width, containerRef } = useContainerWidth({ initialWidth: 960 });
  const device = deviceForWidth(width);
  const [snapMode, setSnapMode] = useState<SnapMode>("stack");

  const baseLayout = useMemo(
    () => toGridLayout(section, blocks, device),
    [section, blocks, device],
  );
  const [items, setItems] = useState<LayoutItem[]>(baseLayout);
  const readyRef = useRef(false);

  const signature = layoutSignature(baseLayout);
  useEffect(() => {
    readyRef.current = false;
    setItems(baseLayout);
    // Signature keeps this in sync without thrashing on identical layouts.
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(
    (nextGrid: LayoutItem[]) => {
      const byId = new Map(nextGrid.map((item) => [item.i, item]));
      const ordered = [...nextGrid].sort((a, b) => a.y - b.y || a.x - b.x);
      const orderById = new Map(ordered.map((item, index) => [item.i, index]));

      const nextBlocks = blocks
        .map((block) => {
          const item = byId.get(block.id);
          if (!item) return block;
          return {
            ...block,
            position: orderById.get(block.id) ?? block.position,
            span: item.w,
            height: item.h,
            frames: {
              ...(block.frames ?? {}),
              [device]: { x: item.x, y: item.y, width: item.w, height: item.h },
            },
          } as LayoutBlockInstance;
        })
        .sort((a, b) => a.position - b.position);

      const changed = nextBlocks.some((block, index) => {
        const previous = blocks.find((candidate) => candidate.id === block.id);
        const previousFrame = previous?.frames?.[device];
        const frame = block.frames?.[device];
        return (
          block.id !== blocks[index]?.id ||
          block.position !== previous?.position ||
          block.span !== previous?.span ||
          block.height !== previous?.height ||
          previousFrame?.x !== frame?.x ||
          previousFrame?.y !== frame?.y
        );
      });

      setItems(nextGrid);
      if (!readyRef.current) {
        readyRef.current = true;
        return;
      }
      if (changed) onChange(nextBlocks);
    },
    [blocks, device, onChange],
  );

  function handleLayoutChange(layout: Layout) {
    commit(layout as LayoutItem[]);
  }

  /** Snap every block's height to the height its content actually needs. */
  const fitHeights = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const next = items.map((item) => {
      const node = root.querySelector<HTMLElement>(`[data-block-id="${item.i}"]`);
      const content = node?.scrollHeight ?? 0;
      if (!content) return item;
      const rows = Math.max(MIN_ROWS, Math.ceil((content + MARGIN[1]) / (ROW_HEIGHT + MARGIN[1])));
      return { ...item, h: rows };
    });
    readyRef.current = true;
    commit(verticalCompactor.compact(next as Layout, COLS) as LayoutItem[]);
  }, [items, commit, containerRef]);

  /** Even columns across the current rows: 1 → 12, 2 → 6, 3 → 4, 4+ → 3. */
  const distribute = useCallback(
    (perRow: number) => {
      const width = Math.max(1, Math.floor(COLS / perRow));
      const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
      let y = 0;
      const next = ordered.map((item, index) => {
        const slot = index % perRow;
        if (slot === 0 && index > 0) y += 1;
        return { ...item, w: width, x: slot * width, y };
      });
      readyRef.current = true;
      commit(verticalCompactor.compact(next as Layout, COLS) as LayoutItem[]);
    },
    [items, commit],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div
          className="inline-flex items-center rounded-md border border-card-border p-0.5"
          role="group"
          aria-label="Snapping mode"
        >
          <ModeButton
            active={snapMode === "stack"}
            onClick={() => setSnapMode("stack")}
            icon={<Magnet className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Snap"
            title="Blocks snap together and pull upward"
          />
          <ModeButton
            active={snapMode === "free"}
            onClick={() => setSnapMode("free")}
            icon={<Move3d className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Free"
            title="Keep blocks exactly where you drop them"
          />
        </div>
        <ToolButton onClick={fitHeights} title="Resize every block to fit its content">
          <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" /> Fit heights
        </ToolButton>
        <ToolButton onClick={() => distribute(1)} title="One block per row">
          <Rows3 className="h-3.5 w-3.5" aria-hidden="true" /> 1 up
        </ToolButton>
        <ToolButton onClick={() => distribute(2)} title="Two blocks per row">
          <Columns3 className="h-3.5 w-3.5" aria-hidden="true" /> 2 up
        </ToolButton>
        <ToolButton onClick={() => distribute(3)} title="Three blocks per row">
          <Columns3 className="h-3.5 w-3.5" aria-hidden="true" /> 3 up
        </ToolButton>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {device}
        </span>
      </div>

      <div
        ref={containerRef}
        className="studio-section-grid"
        data-studio-canvas="grid"
        data-studio-snap={snapMode}
        data-studio-rgl-section={section.id}
      >
        {width > 0 && (
          <GridLayout
            width={width}
            layout={items}
            gridConfig={{
              cols: COLS,
              rowHeight: ROW_HEIGHT,
              margin: MARGIN,
              containerPadding: [0, 0],
            }}
            compactor={snapMode === "stack" ? verticalCompactor : noCompactor}
            dragConfig={{ enabled: true, bounded: false, cancel: DRAG_CANCEL, threshold: 4 }}
            resizeConfig={{
              enabled: true,
              handles: ["se", "sw", "e", "w", "s", "ne", "n", "nw"],
            }}
            onLayoutChange={handleLayoutChange}
          >
            {blocks.map((block, index) => (
              <div key={block.id} className="min-w-0 cursor-grab active:cursor-grabbing">
                {renderBlock(block, index)}
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-[var(--user-accent-subtle,var(--surface-elevated))] text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ToolButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-md border border-card-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}

function deviceForWidth(width: number): Device {
  if (width >= 996) return "desktop";
  if (width >= 720) return "tablet";
  return "mobile";
}

function layoutSignature(layout: LayoutItem[]): string {
  return layout.map((item) => `${item.i}:${item.x}:${item.y}:${item.w}:${item.h}`).join("|");
}

function toGridLayout(
  section: LayoutSection,
  blocks: LayoutBlockInstance[],
  device: Device,
): LayoutItem[] {
  const defaultWidth = defaultSpan(section.layout);
  let cursorX = 0;
  let cursorY = 0;

  return [...blocks]
    .sort((a, b) => a.position - b.position)
    .map((block) => {
      const frame = block.frames?.[device];
      const width = clamp(frame?.width ?? block.span ?? defaultWidth, 1, COLS);
      const height = Math.max(MIN_ROWS, frame?.height ?? block.height ?? 8);

      let x = frame?.x;
      let y = frame?.y;
      if (x === undefined || y === undefined) {
        // Legacy layouts have no coordinates: flow them into rows.
        if (cursorX + width > COLS) {
          cursorX = 0;
          cursorY += 1;
        }
        x = cursorX;
        y = cursorY;
        cursorX += width;
      }

      return {
        i: block.id,
        x: clamp(x, 0, COLS - width),
        y: Math.max(0, y),
        w: width,
        h: height,
        minW: 2,
        maxW: COLS,
        minH: MIN_ROWS,
      } satisfies LayoutItem;
    });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function defaultSpan(layout: LayoutSection["layout"]): number {
  switch (layout) {
    case "three_column":
      return 4;
    case "two_column":
    case "side_by_side":
    case "split":
      return 6;
    case "sidebar_left":
    case "sidebar_right":
      return 4;
    case "feature":
    case "featured_work":
    case "image_lead":
    case "asymmetric":
      return 6;
    default:
      return 12;
  }
}
