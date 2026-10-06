// Studio page-layout normalization, duplication, and undo-history helpers.
//
// Split out of creation-studio.tsx. These are pure functions over PageLayout
// and grid items; the canvas-level placement and snapping rules they build on
// live in studio-grid.ts.

import type { CardBorderPreference } from "@/lib/background-themes";
import { overlapsGridItems, sizeFor } from "@/lib/studio-grid";
import type { GStudioConfig } from "@/components/tethyr/studio/g-studio-surface";
import type {
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";
import type { StudioConfig } from "@/lib/studio-config";

export type HistoryEntry = {
  layout: PageLayout;
  config: GStudioConfig;
  /** The page theme at the time (null = default). Absent = leave the theme. */
  themeId?: string | null;
  /** The member's card outline preference at the time. */
  borders?: { cardBorders: CardBorderPreference; cardBorderColor: string };
  /** Areas arranged on the grid at the time (their grids are saved). Undo
   *  restores this too, or undoing a layout would still save the grids it
   *  wrote and change how those areas look on the public page. */
  arranged?: string[];
};

export function createHistoryEntry(layout: PageLayout, config: GStudioConfig): HistoryEntry {
  return { layout: cloneLayout(layout), config: cloneConfig(config) };
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Default canvas size for a block type — single source of truth lives in
 * studio-grid's sizeFor() so click-to-add, drag-in placeholders, and the
 * canvas agree on the compact default heights. */
export function blockSize(type: string): [number, number, number, number] {
  return sizeFor(type);
}

export function firstFreePosition(
  id: string,
  existing: LayoutGridItem[],
  width: number,
  height: number,
): { x: number; y: number } {
  const others = existing.filter((item) => item.i !== id);
  const maxY = others.reduce((value, item) => Math.max(value, item.y + item.h), 0);
  for (let y = 0; y <= maxY + height; y++) {
    for (let x = 0; x <= 12 - width; x++) {
      const candidate: LayoutGridItem = { i: id, x, y, w: width, h: height };
      if (!others.some((item) => overlapsGridItems(candidate, item))) return { x, y };
    }
  }
  return { x: 0, y: maxY + height };
}

export function nextGridItem(
  id: string,
  existing: LayoutGridItem[],
  width: number,
  height: number,
  minW: number,
  minH: number,
): LayoutGridItem {
  const w = Math.max(minW, Math.min(12, width));
  const h = Math.max(minH, height);
  const { x, y } = firstFreePosition(id, existing, w, h);
  return normalizeGridItem({ i: id, x, y, w, h }, id, w, h, minW, minH);
}

export function placeDuplicateGridItem(
  grid: LayoutGridItem[],
  source: LayoutGridItem | undefined,
  duplicateId: string,
  size: [number, number, number, number],
): LayoutGridItem[] {
  const [defaultW, defaultH, minW, minH] = size;
  if (!source) return [...grid, nextGridItem(duplicateId, grid, defaultW, defaultH, minW, minH)];
  const w = Math.max(minW, Math.min(12, source.w));
  const h = Math.max(minH, source.h);
  const x = source.x + source.w + w <= 12 ? source.x + source.w : 0;
  const y = x === 0 ? Math.max(...grid.map((item) => item.y + item.h), 0) : source.y;
  const candidate = normalizeGridItem(
    { i: duplicateId, x, y, w, h },
    duplicateId,
    defaultW,
    defaultH,
    minW,
    minH,
  );
  if (grid.some((item) => overlapsGridItems(candidate, item))) {
    const { x: freeX, y: freeY } = firstFreePosition(duplicateId, grid, candidate.w, candidate.h);
    candidate.x = freeX;
    candidate.y = freeY;
  }
  return [...grid, candidate];
}

export function normalizeGridItem(
  item: LayoutGridItem,
  id: string,
  fallbackW: number,
  fallbackH: number,
  minW = 2,
  minH = 2,
): LayoutGridItem {
  const w = Math.max(minW, Math.min(12, Math.round(item.w || fallbackW)));
  return {
    i: id,
    x: Math.max(0, Math.min(12 - w, Math.round(item.x || 0))),
    y: Math.max(0, Math.round(item.y || 0)),
    w,
    h: Math.max(minH, Math.round(item.h || fallbackH)),
    minW,
    minH,
    maxW: item.maxW,
    maxH: item.maxH,
  };
}

export function normalizeLayout(layout: PageLayout): PageLayout {
  return {
    sections: layout.sections.map((section, sectionIndex) => {
      const blocks = [...section.blocks].sort((a, b) => a.position - b.position);
      const seeded = new Map((section.grid ?? []).map((item) => [item.i, item]));
      const grid: LayoutGridItem[] = [];
      blocks.forEach((block, index) => {
        const [w, h, minW, minH] = blockSize(block.type);
        const existing = seeded.get(block.id);
        if (existing) {
          grid.push(normalizeGridItem(existing, block.id, w, h, minW, minH));
        } else {
          const preferredWidth = preferredGridWidth(section.layout, index, minW);
          grid.push(nextGridItem(block.id, grid, preferredWidth, h, minW, minH));
        }
      });
      return {
        ...section,
        position: sectionIndex,
        blocks: blocks.map((block, blockIndex) => ({ ...block, position: blockIndex })),
        grid,
      };
    }),
  };
}

export function cloneLayout(layout: PageLayout): PageLayout {
  return JSON.parse(JSON.stringify(layout)) as PageLayout;
}

export function cloneConfig(config: GStudioConfig): GStudioConfig {
  return JSON.parse(JSON.stringify(config)) as GStudioConfig;
}

export function sameGrid(a: LayoutGridItem[], b: LayoutGridItem[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x.i.localeCompare(y.i));
  const right = [...b].sort((x, y) => x.i.localeCompare(y.i));
  return left.every((item, index) => {
    const other = right[index];
    return (
      item.i === other.i &&
      item.x === other.x &&
      item.y === other.y &&
      item.w === other.w &&
      item.h === other.h
    );
  });
}

// GStudioConfig is now identical to StudioConfig — no conversion needed.
export function fromTethyrConfig(value: StudioConfig): GStudioConfig {
  return { ...value };
}

export function toTethyrConfig(value: GStudioConfig, _current: StudioConfig): StudioConfig {
  return { ...value };
}

export function preferredGridWidth(
  layout: LayoutSection["layout"],
  index: number,
  minW: number,
): number {
  const widths = TRACK_WIDTHS[layout] ?? [12];
  return Math.max(minW, Math.min(12, widths[index % widths.length]));
}

export function normalizedSectionGrid(
  section: LayoutSection,
  blocks: LayoutBlockInstance[],
): LayoutGridItem[] {
  const seeded = new Map((section.grid ?? []).map((item) => [item.i, item]));
  const grid: LayoutGridItem[] = [];
  blocks.forEach((block, index) => {
    const existing = seeded.get(block.id);
    const [width, height, minW, minH] = blockSize(block.type);
    if (existing) {
      grid.push(
        normalizeGridItem(
          existing,
          block.id,
          width,
          height,
          existing.minW ?? 2,
          existing.minH ?? 2,
        ),
      );
    } else {
      const preferredWidth = preferredGridWidth(section.layout, index, minW);
      grid.push(nextGridItem(block.id, grid, preferredWidth, height, minW, minH));
    }
  });
  return grid;
}

export function insertDuplicateGridItem(
  grid: LayoutGridItem[],
  sourceId: string,
  duplicateId: string,
  source?: LayoutGridItem,
): LayoutGridItem[] {
  const sourceItem = source ?? grid.find((item) => item.i === sourceId);
  const [width, height, minW, minH] = sourceItem
    ? [sourceItem.w, sourceItem.h, sourceItem.minW ?? 2, sourceItem.minH ?? 2]
    : blockSize("text");
  const duplicate = nextGridItem(duplicateId, grid, width, height, minW, minH);
  if (!sourceItem) return [...grid, duplicate];
  const x = Math.min(12 - duplicate.w, sourceItem.x + sourceItem.w);
  const y = sourceItem.y;
  if (!grid.some((item) => overlapsGridItems({ ...duplicate, x, y }, item))) {
    duplicate.x = x;
    duplicate.y = y;
  }
  return [...grid, duplicate];
}

/** Typical column widths per section layout, matched to the public page's
 *  SECTION_GRID proportions so a chosen layout seeds a faithful grid. */
const TRACK_WIDTHS: Record<LayoutSection["layout"], number[]> = {
  full: [12],
  two_column: [6],
  three_column: [4],
  sidebar_left: [3, 9],
  sidebar_right: [9, 3],
  feature: [8, 4],
  side_by_side: [6],
  featured_work: [8, 4],
  asymmetric: [8, 4],
  split: [6],
  image_lead: [5, 7],
  compact_list: [12],
};

/** Build a non-overlapping grid that snapshots a section layout into concrete
 *  column widths (the pattern repeats for blocks beyond the first row). */
export function seedGridFromLayout(
  section: Pick<LayoutSection, "id" | "blocks">,
  layout: LayoutSection["layout"],
): LayoutGridItem[] {
  const widths = TRACK_WIDTHS[layout] ?? [12];
  const ordered = [...section.blocks].sort((a, b) => a.position - b.position);
  const grid: LayoutGridItem[] = [];
  ordered.forEach((block, index) => {
    const [, defaultHeight, minW, minH] = blockSize(block.type);
    const w = Math.max(minW, Math.min(12, widths[index % widths.length]));
    const h = Math.max(minH, defaultHeight);
    const { x, y } = firstFreePosition(block.id, grid, w, h);
    grid.push(normalizeGridItem({ i: block.id, x, y, w, h }, block.id, w, h, minW, minH));
  });
  return grid;
}

/**
 * Apply content auto-fit (new `y`/`h` for an area's grid items) to a layout.
 * Only rows move; widths, order and everything else stay. The editor applies
 * this to both the working layout and the saved baseline: heights are an
 * editor-only measurement (the public page sizes rows to content), so a fit
 * must never count as an unsaved edit or trigger a save on its own.
 */
export function withFittedGrid(
  layout: PageLayout,
  sectionId: string,
  fitted: LayoutGridItem[],
): PageLayout | null {
  const byId = new Map(fitted.map((item) => [item.i, item]));
  let changed = false;
  const sections = layout.sections.map((section) => {
    if (section.id !== sectionId || !section.grid) return section;
    let sectionChanged = false;
    const grid = section.grid.map((item) => {
      const fit = byId.get(item.i);
      if (!fit || (fit.y === item.y && fit.h === item.h)) return item;
      sectionChanged = true;
      return { ...item, y: fit.y, h: fit.h };
    });
    if (!sectionChanged) return section;
    changed = true;
    const heights = new Map(grid.map((item) => [item.i, item.h]));
    return {
      ...section,
      grid,
      blocks: section.blocks.map((block) =>
        heights.has(block.id) ? { ...block, height: heights.get(block.id) } : block,
      ),
    };
  });
  return changed ? { sections } : null;
}

/**
 * What a layout looks like to the public page, as a comparable string. The
 * public page places a block by its column (`x`) and width (`w`) and orders
 * blocks by `position`; row heights and vertical offsets are editor-only
 * measurements (content auto-fit), so they are left out. Used to tell whether
 * the draft differs from what is published without auto-fit noise.
 */
export function publicLayoutSignature(layout: PageLayout): string {
  const normalized = normalizeLayout(layout);
  return JSON.stringify(
    normalized.sections.map((section) => ({
      ...section,
      grid: (section.grid ?? []).map(({ i, x, w }) => ({ i, x, w })),
      blocks: section.blocks.map(({ height: _height, ...block }) => block),
    })),
  );
}
