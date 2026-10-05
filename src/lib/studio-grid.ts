// Studio canvas grid math and section lookups — pure functions over
// react-grid-layout items and page layouts.
//
// Split out of g-studio-surface.tsx so placement, snapping, and overlap rules
// can be read and tested without the editor UI around them.

import type {
  LayoutBlockInstance,
  LayoutGridItem,
  LayoutSection,
  PageLayout,
} from "@/lib/page-blocks";

type DragTarget = { sectionId: string; col: number; row: number };

export const COLS = 12;

const BLOCK_SIZES: Record<string, [number, number, number, number]> = {
  "profile-header": [12, 4, 6, 3],
  "profile-bio": [7, 3, 3, 2],
  "profile-readme": [8, 6, 4, 4],
  "profile-direction": [5, 3, 3, 2],
  "profile-projects": [12, 5, 4, 3],
  "profile-needs": [5, 4, 3, 2],
  "profile-credits": [7, 4, 4, 2],
  "profile-activity": [5, 4, 3, 2],
  "profile-skills": [5, 4, 3, 2],
  "profile-tools": [4, 4, 2, 2],
  "profile-links": [3, 4, 2, 2],
  "profile-achievements": [6, 4, 3, 2],
  "profile-gallery": [12, 5, 4, 3],
  "profile-currently-building": [12, 5, 4, 3],
  "profile-proof-of-work": [8, 6, 4, 4],
  "profile-activity-heatmap": [12, 6, 6, 4],
  "profile-looking-for": [5, 4, 3, 2],
  "profile-availability": [5, 4, 3, 2],
  "profile-contribution-stats": [7, 4, 3, 2],
  "profile-collaboration-network": [7, 5, 4, 3],
  "content-text": [6, 3, 3, 2],
  "content-heading": [12, 2, 3, 2],
  "content-divider": [12, 1, 2, 1],
};

export function overlapsGridItems(a: LayoutGridItem, b: LayoutGridItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function xOverlaps(a: LayoutGridItem, b: LayoutGridItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x;
}

function firstFreeGridPosition(
  existing: LayoutGridItem[],
  width: number,
  height: number,
): { x: number; y: number } {
  const maxY = existing.reduce((value, item) => Math.max(value, item.y + item.h), 0);
  for (let y = 0; y <= maxY + height; y += 1) {
    for (let x = 0; x <= COLS - width; x += 1) {
      const candidate = { i: "__candidate__", x, y, w: width, h: height };
      if (!existing.some((item) => overlapsGridItems(candidate, item))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: maxY };
}

export function snapGridPlacement(
  target: DragTarget | null,
  width: number,
  height: number,
  existing: LayoutGridItem[],
  enabled: boolean,
  ignoreId?: string,
): DragTarget | null {
  if (!target) return null;
  const maxCol = Math.max(0, COLS - width);
  const clamped = {
    ...target,
    col: Math.max(0, Math.min(maxCol, Math.round(target.col))),
    row: Math.max(0, Math.round(target.row)),
  };
  if (!enabled) return clamped;

  const others = existing.filter((item) => item.i !== ignoreId);
  const candidates: Array<{ col: number; row: number; distance: number }> = [];
  const consider = (candidate: { col: number; row: number }) => {
    const col = Math.max(0, Math.min(maxCol, candidate.col));
    const row = Math.max(0, candidate.row);
    // Manhattan distance between the drop cell and the candidate edge cell —
    // 2 is roughly two grid cells of travel, enough that a near miss still
    // glues to a neighbour.
    const distance = Math.abs(col - clamped.col) + Math.abs(row - clamped.row);
    if (distance > 2) return;
    const proposed = { i: "__snap__", x: col, y: row, w: width, h: height };
    if (!others.some((other) => overlapsGridItems(proposed, other))) {
      candidates.push({ col, row, distance });
    }
  };
  for (const item of others) {
    // Snap to neighbour edges — flush right/left/above/below plus corner
    // alignments so boxes can stack tightly against each other.
    const edgeCandidates = [
      { col: item.x + item.w, row: item.y },
      { col: item.x - width, row: item.y },
      { col: item.x, row: item.y + item.h },
      { col: item.x, row: item.y - height },
      { col: item.x + item.w - width, row: item.y },
      { col: item.x + item.w - width, row: item.y + item.h - height },
      { col: item.x, row: item.y + item.h - height },
    ];
    for (const candidate of edgeCandidates) {
      if (candidate.col >= 0 && candidate.col <= maxCol) consider(candidate);
    }
    // Grid-edge alignment: matching rows of neighbours so blocks can also
    // snap flush to x=0 / x=maxCol even when no neighbour edge offers it.
    consider({ col: 0, row: item.y });
    consider({ col: maxCol, row: item.y });
  }
  const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
  return nearest ? { ...clamped, col: nearest.col, row: nearest.row } : clamped;
}

/** After RGL settles a drag inside a section, re-align the block onto a nearby
 *  neighbour edge when block-edge snapping is enabled. Returns an updated grid
 *  when the dropped cell moved, otherwise null (caller keeps the RGL result). */
export function settleGridSnap(
  grid: LayoutGridItem[],
  blockId: string,
  enabled: boolean,
): LayoutGridItem[] | null {
  const item = grid.find((candidate) => candidate.i === blockId);
  if (!item) return null;
  const others = grid.filter((candidate) => candidate.i !== blockId);
  const snapped = snapGridPlacement(
    { sectionId: "", col: item.x, row: item.y },
    item.w,
    item.h,
    others,
    enabled,
    blockId,
  );
  if (!snapped || (snapped.col === item.x && snapped.row === item.y)) return null;
  const moved = { ...item, x: snapped.col, y: snapped.row };
  if (others.some((other) => overlapsGridItems(moved, other))) {
    const free = firstFreeGridPosition(others, moved.w, moved.h);
    moved.x = free.x;
    moved.y = free.y;
  }
  if (moved.x === item.x && moved.y === item.y) return null;
  return [...others, moved];
}

/** Minimum whole grid rows whose pixel box (h × row + (h−1) × margin) can hold
 *  `contentPx` pixels. Auto-grow uses this so editing never clips content. */
function minRowsForContent(
  contentPx: number,
  rowHeight: number,
  marginY: number,
  minRows = 1,
): number {
  if (!Number.isFinite(contentPx) || contentPx <= 0) return minRows;
  return Math.max(minRows, Math.ceil((contentPx + marginY) / (rowHeight + marginY)));
}

/** Grow a block's rows to fit its measured content, pushing any neighbours it
 *  would now overlap downward so the grid never ends up with overlapping
 *  blocks. Returns the updated grid or null when no change is needed. */
export function growGridItemToContent(
  grid: LayoutGridItem[],
  blockId: string,
  contentPx: number,
  rowHeight: number,
  marginY: number,
): LayoutGridItem[] | null {
  const item = grid.find((candidate) => candidate.i === blockId);
  if (!item) return null;
  const rows = minRowsForContent(contentPx, rowHeight, marginY, item.minH ?? 1);
  if (rows <= item.h) return null;
  const grown = { ...item, h: rows };
  const updated = grid.map((candidate) => (candidate.i === blockId ? grown : candidate));
  return pushDownOverlaps(updated);
}

/** Move any item that overlaps the one above it straight down so the grid is
 *  never overlapping. Only items that actually collide move — deliberate
 *  whitespace gaps elsewhere survive. The item array order (and therefore block
 *  positions) is preserved. */
function pushDownOverlaps(grid: LayoutGridItem[]): LayoutGridItem[] {
  const items = grid.map((item) => ({ ...item }));
  let changed = true;
  let guard = 0;
  const maxPasses = items.length * items.length + items.length + 4;
  while (changed && guard < maxPasses) {
    changed = false;
    guard += 1;
    for (let i = 0; i < items.length; i += 1) {
      const upper = items[i];
      for (let j = 0; j < items.length; j += 1) {
        if (i === j) continue;
        const lower = items[j];
        // Only nudge items that start below the grown block.
        if (lower.y < upper.y) continue;
        if (lower.y >= upper.y + upper.h) continue;
        if (!xOverlaps(upper, lower)) continue;
        const pushedY = upper.y + upper.h;
        if (pushedY > lower.y) {
          lower.y = pushedY;
          changed = true;
        }
      }
    }
  }
  return items;
}

export function sectionGrid(
  section: LayoutSection,
  blocks: LayoutBlockInstance[],
): LayoutGridItem[] {
  const existing = new Map((section.grid ?? []).map((item) => [item.i, item]));
  return blocks.map((block, index) => {
    const current = existing.get(block.id);
    if (current) return current;
    const [w, h, minW, minH] = sizeFor(block.type);
    return {
      i: block.id,
      x: w >= 12 ? 0 : index % 2 === 0 ? 0 : 6,
      y: Math.floor(index / 2) * 5,
      w,
      h,
      minW,
      minH,
    };
  });
}

/** Default canvas size [w, h, minW, minH] for a block type. Exported so the
 * orchestrator (creation-studio) sizes new/duplicated blocks identically to
 * drag-in placeholders — one source of truth for block default heights. */
export function sizeFor(type: string): [number, number, number, number] {
  return BLOCK_SIZES[type] ?? [6, 4, 2, 2];
}

export function findSection(layout: PageLayout, blockId: string) {
  return layout.sections.find((section) => section.blocks.some((block) => block.id === blockId));
}

/** Human names for untitled sections, so the editor never shows layout ids. */
const SECTION_LAYOUT_NAMES: Record<LayoutSection["layout"], string> = {
  full: "Full-width area",
  two_column: "Two-column area",
  three_column: "Three-column area",
  sidebar_left: "Area with left sidebar",
  sidebar_right: "Area with right sidebar",
  feature: "Featured area",
  side_by_side: "Side-by-side area",
  featured_work: "Featured work",
  asymmetric: "Uneven columns",
  split: "Split area",
  image_lead: "Image-led area",
  compact_list: "Compact list",
};

/** Display label for a section: its custom title, else a name for its layout. */
export function sectionLabel(section: LayoutSection): string {
  const title = section.title?.trim();
  return title || (SECTION_LAYOUT_NAMES[section.layout] ?? "Area");
}
