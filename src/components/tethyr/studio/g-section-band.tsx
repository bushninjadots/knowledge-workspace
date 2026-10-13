// ── Studio canvas: one area ──────────────────────────────────────────────────────
// An area (section) on the editing canvas: its header controls, the
// react-grid-layout grid with drag/resize, the snap and alignment overlay, and
// each block's frame. Split out of g-studio-surface.tsx, which owns the editor
// shell (top bar, rail, preview) and composes these bands.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { ReactGridLayout as LegacyGridLayout, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import {
  AreaDivider,
  AreaTitle,
  areaWidthStyle,
  areaGapScale,
  areaSurfaceClass,
  areaSurfaceStyle,
} from "@/components/tethyr/page/area-frame";
import { SECTION_GRID, colStartClass, spanClass } from "@/components/tethyr/page/page-layout";
import type { LayoutBlockInstance, LayoutGridItem, LayoutSection } from "@/lib/page-blocks";
import { cn } from "@/lib/utils";
import {
  COLS,
  fitGridItemToContent,
  sectionGrid,
  sectionLabel,
  settleGridSnap,
  snapGridPlacement,
  alignedEdges,
  sizeFor,
} from "@/lib/studio-grid";
import { useIsMobile } from "@/hooks/use-mobile";
import { IconButton } from "./studio-controls";
import { SectionLayoutPicker } from "./section-layout-picker";
import { GBlockFrame } from "./g-block-frame";
import type { GStudioSurfaceProps } from "./g-studio-surface";

const EditorGrid = WidthProvider(LegacyGridLayout);

/** Pointer types that must never start a block drag while editing. Mirrors the
 *  project-page canvas cancel list (interactive controls stay clickable). */
const BLOCK_DRAG_CANCEL =
  "button, a, input, textarea, select, label, [role='button'], [contenteditable='true'], [data-no-drag]";

function ResizeHandle(axis: string, ref: React.Ref<HTMLElement>) {
  const isCorner = axis === "se";
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(
        "react-resizable-handle",
        `react-resizable-handle-${axis}`,
        // Hover reveals the handles; a selected block keeps them (touch has no hover).
        "opacity-0 transition-opacity duration-140 group-hover/frame:opacity-100 [[aria-current=true]>&]:opacity-100",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "block rounded-sm border bg-[var(--surface-elevated)] border-[var(--user-accent)]",
          isCorner ? "h-2.5 w-2.5" : axis === "e" ? "h-5 w-2" : "h-2 w-5",
        )}
      />
    </div>
  );
}

/** Pointer position from a drag event, covering both mouse and touch gestures. */
function pointerPosition(event: Event | undefined): { x: number; y: number } | null {
  if (!event) return null;
  const mouse = event as MouseEvent;
  if (Number.isFinite(mouse.clientX) && Number.isFinite(mouse.clientY)) {
    return { x: mouse.clientX, y: mouse.clientY };
  }
  const touch = (event as TouchEvent).changedTouches?.[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The area canvas under the pointer, excluding the drag's own area. Dragging is
 * per-grid, so without this a block released over another area snaps back home.
 */
function sectionUnderPointer(x: number, y: number, sourceSectionId: string): string | null {
  let best: { id: string; area: number } | null = null;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-studio-grid]"))) {
    const id = node.dataset.studioGrid;
    if (!id || id === sourceSectionId) continue;
    const rect = node.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const area = rect.width * rect.height;
    if (!best || area < best.area) best = { id, area };
  }
  return best?.id ?? null;
}

/** Grid cell for a drop point, measured against the target area's own metrics. */
function cellUnderPointer(
  point: { x: number; y: number },
  sectionId: string,
  width: number,
): { col: number; row: number } | undefined {
  const node = document.querySelector<HTMLElement>(`[data-studio-grid="${sectionId}"]`);
  if (!node) return undefined;
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0) return undefined;
  const rowHeight = Number(node.dataset.rowHeight) || 24;
  const margin = Number(node.dataset.margin) || 14;
  const col = Math.floor(((point.x - rect.left) / rect.width) * COLS);
  const row = Math.round((point.y - rect.top) / (rowHeight + margin));
  return {
    col: Math.max(0, Math.min(COLS - width, col)),
    row: Math.max(0, row),
  };
}

/** What the grid overlay draws during a drag or resize. */
type GridGesture = {
  kind: "drag" | "resize";
  item: { x: number; y: number; w: number; h: number };
  guides: { cols: number[]; rows: number[] };
};

/**
 * Drawn over an area's grid while editing: the 12 columns (during a gesture,
 * or always with "Show layout grid"), alignment guides at edges the moving
 * block lines up with, and a width readout while resizing. Pixel positions
 * use the same column maths as the grid library.
 */
function GridOverlay({
  width,
  margin,
  rowHeight,
  gesture,
  showGrid,
  layer,
}: {
  width: number;
  margin: number;
  rowHeight: number;
  gesture: GridGesture | null;
  showGrid: boolean;
  /** "columns" sits behind the blocks; "guides" is drawn over them. */
  layer: "columns" | "guides";
}) {
  if (!width || (!gesture && !showGrid)) return null;
  if (layer === "guides" && !gesture) return null;
  const colW = (width - margin * (COLS - 1)) / COLS;
  const colX = (c: number) => c * (colW + margin);
  const rowY = (r: number) => r * (rowHeight + margin);
  // A boundary sits in the gutter between columns (at the outer edges, on them).
  const colLine = (c: number) => (c <= 0 ? 0 : c >= COLS ? width - 1 : colX(c) - margin / 2);
  const rowLine = (r: number) => (r <= 0 ? 0 : rowY(r) - margin / 2);
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", layer === "guides" ? "z-[35]" : "z-0")}
    >
      {layer === "columns" &&
        Array.from({ length: COLS }, (_, c) => (
          <span
            key={c}
            className={cn(
              "absolute inset-y-0 rounded-[2px] transition-opacity duration-150",
              gesture
                ? "bg-[color-mix(in_oklab,var(--user-accent,var(--primary))_7%,transparent)]"
                : "bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)]",
            )}
            style={{ left: colX(c), width: colW }}
          />
        ))}
      {layer === "guides" &&
        gesture?.guides.cols.map((c) => (
          <span
            key={`c${c}`}
            className="absolute -inset-y-3 w-px bg-[var(--user-accent,var(--primary))]"
            style={{ left: colLine(c) }}
          />
        ))}
      {layer === "guides" &&
        gesture?.guides.rows.map((r) => (
          <span
            key={`r${r}`}
            className="absolute inset-x-0 h-px bg-[var(--user-accent,var(--primary))]"
            style={{ top: rowLine(r) }}
          />
        ))}
      {layer === "guides" && gesture?.kind === "resize" && (
        <span
          className="absolute rounded-sm bg-[var(--user-accent,var(--primary))] px-1.5 py-0.5 font-mono text-2xs whitespace-nowrap text-[var(--user-accent-foreground,var(--primary-foreground))] shadow-sm"
          style={{
            // Inside the block's top-right corner, clear of the area header.
            left: colX(gesture.item.x + gesture.item.w) - margin - 8,
            top: rowY(gesture.item.y) + 8,
            transform: "translateX(-100%)",
          }}
        >
          {gesture.item.w} / {COLS} columns
        </span>
      )}
    </div>
  );
}

export function GSectionBand({
  section,
  index,
  total,
  editing,
  directManipulation,
  touchDrag,
  snapToBlocks,
  showGrid,
  onRequestPalette,
  ...props
}: GStudioSurfaceProps & {
  section: LayoutSection;
  index: number;
  total: number;
  editing: boolean;
  directManipulation: boolean;
  touchDrag: boolean;
  snapToBlocks: boolean;
  showGrid: boolean;
  onRequestPalette: (id: string) => void;
}) {
  const [gesture, setGesture] = useState<GridGesture | null>(null);
  const gridBoxRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  useEffect(() => {
    const node = gridBoxRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setGridWidth(node.clientWidth));
    observer.observe(node);
    setGridWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [editing, section.blocks.length]);
  const [renaming, setRenaming] = useState(false);
  // Phones edit in one stacked column: a 12-column desktop arrangement can't
  // be dragged by touch and squeezes side-by-side blocks to a few words wide.
  const stacked = useIsMobile();
  const sectionTitle = sectionLabel(section);
  const blocks = useMemo(
    () =>
      [...section.blocks]
        .sort((a, b) => a.position - b.position)
        .filter((block) => editing || block.visible !== false),
    [editing, section.blocks],
  );
  // Locked blocks are static: they can't be dragged or resized, and others
  // flow around them instead of over them.
  const grid = useMemo(
    () =>
      sectionGrid(section, blocks).map((item) =>
        blocks.find((block) => block.id === item.i)?.locked ? { ...item, static: true } : item,
      ),
    [section, blocks],
  );
  const rowHeight =
    props.config.density === "compact" ? 20 : props.config.density === "spacious" ? 28 : 24;
  const margin = Math.round(
    (props.config.density === "compact" ? 10 : props.config.density === "spacious" ? 20 : 14) *
      areaGapScale(section),
  );
  const dropItem = props.dragType
    ? {
        i: "__dropping-elem__",
        x: 0,
        y: 0,
        w: sizeFor(props.dragType)[0],
        h: sizeFor(props.dragType)[1],
      }
    : undefined;
  const hasGrid = !editing && (section.grid?.length ?? 0) > 0;

  // Auto-fit: when a block's content is taller than its grid rows the frame
  // clips it. Measure each block and grow its rows (pushing neighbours down)
  // so nothing in the canvas is ever cut off. The ResizeObserver lives in
  // GBlockFrame; this band converts reported content height into grid rows and
  // commits the change. All reads go through refs so the callback stays stable.
  const gridRef = useRef<LayoutGridItem[]>(grid);
  gridRef.current = grid;
  const rowHeightRef = useRef(rowHeight);
  rowHeightRef.current = rowHeight;
  const marginRef = useRef(margin);
  marginRef.current = margin;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const onGridFitRef = useRef(props.onGridFit);
  onGridFitRef.current = props.onGridFit;
  const sectionIdRef = useRef(section.id);
  sectionIdRef.current = section.id;
  // True between a drag/resize start and its stop. The grid library also
  // reports layout changes on its own (echoing a stale layout after a prop
  // change), which fought content auto-fit in a loop; only a gesture is an edit.
  const gestureRef = useRef(false);
  const pendingFitRef = useRef<Map<string, number>>(new Map());
  const fitTimerRef = useRef<number | null>(null);
  const fitBlock = useCallback((blockId: string, contentPx: number) => {
    pendingFitRef.current.set(blockId, contentPx);
    if (fitTimerRef.current !== null) return;
    const run = () => {
      fitTimerRef.current = null;
      if (!editingRef.current) {
        pendingFitRef.current.clear();
        return;
      }
      // Never fight an in-flight drag or resize; re-run once it settles.
      const busy =
        typeof document !== "undefined" &&
        Boolean(
          document.querySelector(
            ".react-grid-item.react-draggable-dragging, .react-grid-item.resizing",
          ),
        );
      if (busy) {
        fitTimerRef.current = window.setTimeout(run, 120);
        return;
      }
      let current = gridRef.current;
      let changed = false;
      for (const [blockId, px] of pendingFitRef.current) {
        const updated = fitGridItemToContent(
          current,
          blockId,
          px,
          rowHeightRef.current,
          marginRef.current,
        );
        if (updated) {
          current = updated;
          changed = true;
        }
      }
      pendingFitRef.current.clear();
      if (changed) onGridFitRef.current(sectionIdRef.current, current);
    };
    fitTimerRef.current = window.setTimeout(run, 0);
  }, []);
  useEffect(() => {
    if (editing && props.autoRenameId === section.id && !renaming) {
      setRenaming(true);
      props.onRenameFocusHandled?.();
    }
    // Only react when the target section id changes to the requested one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, props.autoRenameId, section.id]);
  if (
    !editing &&
    (section.visible === false ||
      !blocks.some(
        (block) => block.visible !== false && !(props.emptyBlockIds?.has(block.id) ?? false),
      ))
  )
    return null;
  return (
    <section
      data-section-id={section.id}
      aria-label={sectionTitle}
      // The area's own surface (background, spacing) renders in the editor
      // exactly as on the page.
      className={cn(
        "relative",
        areaSurfaceClass(section),
        section.visible === false && editing && "opacity-60",
      )}
      style={areaSurfaceStyle(section)}
      onClick={(event) => event.stopPropagation()}
    >
      {editing ? (
        <header className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className="h-3.5 w-0.5 shrink-0"
            style={{
              backgroundColor:
                section.layout === "feature" ? "var(--user-accent)" : "var(--border-strong)",
            }}
          />
          {renaming ? (
            <input
              autoFocus
              defaultValue={sectionTitle}
              aria-label="Area name"
              onBlur={(event) => {
                props.onRenameSection(section.id, event.target.value.trim());
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                if (event.key === "Escape") setRenaming(false);
              }}
              className="t-label w-40 rounded-sm border border-[var(--user-accent-border)] bg-[var(--surface-sunken)] px-1 py-0.5 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename area"
              aria-label={`${sectionTitle}. Rename area`}
              className="t-label flex h-6 pointer-coarse:h-10 items-center truncate rounded-sm px-1 hover:text-foreground"
            >
              {sectionTitle}
            </button>
          )}
          <span className="font-mono text-3xs text-muted-foreground-subtle">
            {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
          </span>
          <SectionLayoutPicker
            value={section.layout}
            areaName={sectionTitle}
            onChange={(layout) => props.onSectionLayoutChange(section.id, layout)}
          />
          <IconButton
            label={`Settings for ${sectionTitle}`}
            active={props.editingAreaId === section.id}
            onClick={() => props.onEditArea?.(section.id)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </IconButton>
          <div className="ml-auto flex gap-0.5">
            <IconButton
              label="Move area up"
              disabled={index === 0}
              onClick={() => props.onMoveSection(section.id, -1)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label="Move area down"
              disabled={index === total - 1}
              onClick={() => props.onMoveSection(section.id, 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={section.visible === false ? "Show area" : "Hide area"}
              onClick={() => props.onToggleSection(section.id)}
            >
              {section.visible === false ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </IconButton>
            {section.blocks.length === 0 && (
              <IconButton
                label="Remove empty area"
                onClick={() => props.onRemoveSection(section.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </div>
        </header>
      ) : (
        <AreaTitle section={section} />
      )}
      {blocks.length === 0 ? (
        editing ? (
          <button
            type="button"
            data-studio-grid={section.id}
            data-row-height={rowHeight}
            data-margin={margin}
            onClick={() => onRequestPalette(section.id)}
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-8 text-xs text-muted-foreground outline-none hover:border-[var(--user-accent-border)] hover:text-[var(--user-accent-text)] focus-visible:border-[var(--user-accent-border)] focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add a block
          </button>
        ) : null
      ) : editing && stacked ? (
        <div className="flex flex-col" style={{ gap: margin }}>
          {[...grid]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((item) => blocks.find((block) => block.id === item.i))
            .filter((block): block is LayoutBlockInstance => !!block)
            .map((block) => (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={props.selectedBlockIds.includes(block.id)}
                fluid
                {...props}
              />
            ))}
        </div>
      ) : editing ? (
        <div
          ref={gridBoxRef}
          data-studio-grid={section.id}
          data-row-height={rowHeight}
          data-margin={margin}
          className="relative"
          style={areaWidthStyle(section)}
        >
          <GridOverlay
            layer="columns"
            width={gridWidth}
            margin={margin}
            rowHeight={rowHeight}
            gesture={gesture}
            showGrid={showGrid}
          />
          <GridOverlay
            layer="guides"
            width={gridWidth}
            margin={margin}
            rowHeight={rowHeight}
            gesture={gesture}
            showGrid={showGrid}
          />
          <EditorGrid
            className="layout"
            layout={grid}
            cols={12}
            rowHeight={rowHeight}
            margin={[margin, margin]}
            containerPadding={[0, 0]}
            isDraggable={editing && directManipulation}
            isBounded={false}
            isResizable={editing && directManipulation}
            isDroppable={editing && directManipulation && Boolean(props.dragType)}
            droppingItem={dropItem}
            draggableCancel={BLOCK_DRAG_CANCEL}
            draggableHandle={touchDrag ? ".studio-drag-handle" : undefined}
            // Width only: heights follow content (the public page ignores them).
            resizeHandles={["e"]}
            resizeHandle={ResizeHandle}
            useCSSTransforms
            compactType={null}
            // Free canvas: a dragged block never displaces its neighbours. It
            // parks at the last free spot instead of shoving everything away.
            preventCollision

            onDragStart={() => {
              gestureRef.current = true;
              props.onGridInteractionStart();
            }}
            onResizeStart={() => {
              gestureRef.current = true;
              props.onGridInteractionStart();
            }}
            // Live snapping: move the landing preview to the snapped cell as the
            // block is dragged, so what you see is where it lands (the drop is
            // settled with the same rule). Guides mark edges that line up.
            onDrag={(current, _old, item, placeholder) => {
              if (!item) return;
              const others = (current as LayoutGridItem[]).filter((other) => other.i !== item.i);
              let { x, y } = item;
              if (snapToBlocks) {
                const snapped = snapGridPlacement(
                  { sectionId: section.id, col: x, row: y },
                  item.w,
                  item.h,
                  others,
                  true,
                  String(item.i),
                );
                if (snapped) {
                  x = snapped.col;
                  y = snapped.row;
                  if (placeholder) {
                    placeholder.x = x;
                    placeholder.y = y;
                  }
                }
              }
              const box = { x, y, w: item.w, h: item.h };
              setGesture({ kind: "drag", item: box, guides: alignedEdges(box, others) });
            }}
            onResize={(current, _old, item) => {
              if (!item) return;
              const others = (current as LayoutGridItem[]).filter((other) => other.i !== item.i);
              const box = { x: item.x, y: item.y, w: item.w, h: item.h };
              setGesture({ kind: "resize", item: box, guides: alignedEdges(box, others) });
            }}
            onDragStop={(current, _oldItem, newItem, _placeholder, event) => {
              setGesture(null);
              // The final onLayoutChange lands after this callback.
              window.setTimeout(() => (gestureRef.current = false), 0);
              props.onGridInteractionEnd();
              if (!editing || !directManipulation || !newItem) return;
              const blockId = String(newItem.i);
              // Each area owns its own grid, so a block released over a different
              // area would be clamped back into its own. Hand it to the area under
              // the pointer instead, at the cell it was dropped on.
              const point = pointerPosition(event);
              const targetSectionId = point
                ? sectionUnderPointer(point.x, point.y, section.id)
                : null;
              if (point && targetSectionId) {
                props.onMoveToSection(
                  blockId,
                  targetSectionId,
                  cellUnderPointer(point, targetSectionId, newItem.w),
                );
                return;
              }
              const committed = (current as LayoutGridItem[]).map((item) => ({
                i: item.i,
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                minW: item.minW,
                minH: item.minH,
              }));
              // RGL has already committed the drop at the grid cell; when block
              // snapping is on, nudge the final cell onto the nearest neighbour
              // edge one tick later so this is the last write and wins.
              const settled = settleGridSnap(committed, blockId, snapToBlocks);
              if (settled) {
                window.setTimeout(() => props.onGridChange(section.id, settled), 0);
              }
            }}
            onResizeStop={() => {
              setGesture(null);
              window.setTimeout(() => (gestureRef.current = false), 0);
              props.onGridInteractionEnd();
            }}
            onDrop={(_layout, item, event) => {
              const type =
                props.dragType ?? (event as DragEvent).dataTransfer?.getData("text/plain");
              if (type && item) {
                props.onAdd(type, section.id, item);
                props.onDragTypeChange(null);
              }
            }}
            onLayoutChange={(next) => {
              if (!editing || !gestureRef.current) return;
              props.onGridChange(
                section.id,
                next.map((item) => ({
                  i: item.i,
                  x: item.x,
                  y: item.y,
                  w: item.w,
                  h: item.h,
                  minW: item.minW,
                  minH: item.minH,
                })),
              );
            }}
          >
            {blocks.map((block) => (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={props.selectedBlockIds.includes(block.id)}
                reportContentHeight={fitBlock}
                {...props}
              />
            ))}
          </EditorGrid>
        </div>
      ) : (
        <div
          className={cn(
            "content-safe",
            hasGrid
              ? "grid grid-cols-1 gap-8 md:grid-cols-12"
              : (SECTION_GRID[section.layout] ?? ""),
          )}
          style={
            hasGrid
              ? { gridAutoFlow: "row dense", alignItems: "start" }
              : (SECTION_GRID[section.layout] ?? "")
                ? { gridAutoFlow: "row", alignItems: "start" }
                : undefined
          }
        >
          {blocks.map((block) => {
            const item = hasGrid ? grid.find((candidate) => candidate.i === block.id) : undefined;
            return hasGrid ? (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={false}
                fluid
                className={cn(
                  "relative min-w-0",
                  colStartClass((item?.x ?? 0) + 1),
                  spanClass(item?.w ?? 12),
                )}
                {...props}
              />
            ) : (
              <GBlockFrame
                key={block.id}
                block={block}
                editing={editing}
                selected={false}
                bare
                className={cn(
                  "contents",
                  (SECTION_GRID[section.layout] ?? "") && typeof block.span === "number"
                    ? spanClass(block.span)
                    : "",
                )}
                {...props}
              />
            );
          })}
        </div>
      )}
      {editing && blocks.length > 0 && (
        <button
          type="button"
          onClick={() => onRequestPalette(section.id)}
          className="mx-auto mt-1 flex h-6 pointer-coarse:h-10 pointer-coarse:px-3 pointer-coarse:opacity-100 items-center gap-1 border border-border bg-[var(--studio-bg,var(--background))] px-1.5 font-mono text-3xs uppercase tracking-widest text-muted-foreground opacity-40 outline-none transition-opacity hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--user-accent,var(--ring))] focus-visible:ring-offset-1"
        >
          <Plus className="h-3 w-3" /> Add block
        </button>
      )}
      <AreaDivider section={section} />
    </section>
  );
}
