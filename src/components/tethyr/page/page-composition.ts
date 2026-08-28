// ── Page Composition ──────────────────────────────────────────────────────────
// Single source of truth for how a PageLayout's sections map to the rendered
// grid: section layout → Tailwind grid classes, column counts, block width
// utilities, per-column block distribution, and device-preview overrides.
//
// Both the page renderer (PageLayoutRenderer) and the Studio editor canvas
// (StudioCanvas) consume these helpers so a saved layout renders identically
// in the editor, in previews, and on the published page. Never redefine these
// mappings in two places — that is exactly the drift the old copies caused.

import type { LayoutBlockInstance, SectionLayoutType } from "@/lib/page-blocks";

/** Tailwind grid classes for each section layout type. */
export const SECTION_GRID: Record<string, string> = {
  full: "",
  two_column: "grid grid-cols-1 md:grid-cols-2 gap-6",
  three_column: "grid grid-cols-1 md:grid-cols-3 gap-6",
  sidebar_left: "grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6",
  sidebar_right: "grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6",
  feature: "grid grid-cols-1 md:grid-cols-2 gap-6",
  side_by_side: "grid grid-cols-1 md:grid-cols-2 gap-6",
};

/** Number of columns each section layout produces at desktop width. */
export const COLUMN_COUNT: Record<string, number> = {
  full: 1,
  two_column: 2,
  three_column: 3,
  sidebar_left: 2,
  sidebar_right: 2,
  feature: 2,
  side_by_side: 2,
};

/** Width utilities for block `config.width`. */
export const BLOCK_WIDTH_CLASS: Record<string, string> = {
  full: "w-full",
  "2/3": "w-2/3",
  "1/2": "w-1/2",
  "1/3": "w-1/3",
  auto: "w-auto",
};

export type DevicePreview = "desktop" | "tablet" | "mobile";

/**
 * Grid class for a section layout with device-preview responsive overrides.
 * Mobile: always single column. Tablet: max 2 columns.
 */
export function gridClassForSection(layout: string, devicePreview?: DevicePreview): string {
  let gridClass = SECTION_GRID[layout] ?? "";
  if (devicePreview === "mobile") {
    gridClass = gridClass.replace(/md:grid-cols-\S+/g, "grid-cols-1");
  } else if (devicePreview === "tablet") {
    gridClass = gridClass.replace(/md:grid-cols-3/g, "md:grid-cols-2");
    gridClass = gridClass.replace(/md:grid-cols-\[\S+\]/g, "md:grid-cols-2");
  }
  return gridClass;
}

/** True when a section renders as a real multi-column grid at this device. */
export function usesMultiColumnGrid(
  layout: SectionLayoutType | string,
  devicePreview?: DevicePreview,
): boolean {
  const colCount = COLUMN_COUNT[layout] ?? 1;
  const forceSingle =
    devicePreview === "mobile" || (devicePreview === "tablet" && layout === "three_column");
  return colCount > 1 && !forceSingle;
}

/** Number of columns a section renders at this device (after force-single). */
export function effectiveColumnCount(
  layout: SectionLayoutType | string,
  devicePreview?: DevicePreview,
): number {
  return usesMultiColumnGrid(layout, devicePreview) ? (COLUMN_COUNT[layout] ?? 1) : 1;
}

/** Width utility for a block, collapsed to full-width on mobile/tablet preview. */
export function blockWidthClass(width: unknown, devicePreview?: DevicePreview): string {
  if (devicePreview === "mobile" || devicePreview === "tablet") return "w-full";
  return BLOCK_WIDTH_CLASS[(width as string) ?? "full"] ?? "w-full";
}

/**
 * Distribute blocks into columns: blocks carrying an explicit `column` land in
 * that column, unassigned blocks round-robin across columns. Shared so the
 * editor canvas and the hosted page arrange blocks identically.
 */
export function groupBlocksByColumn(
  blocks: LayoutBlockInstance[],
  colCount: number,
): LayoutBlockInstance[][] {
  const columns: LayoutBlockInstance[][] = Array.from({ length: colCount }, () => []);
  const unassigned: LayoutBlockInstance[] = [];
  for (const block of blocks) {
    const col = block.column;
    if (col != null && col >= 0 && col < colCount) columns[col].push(block);
    else unassigned.push(block);
  }
  for (let i = 0; i < unassigned.length; i++) {
    columns[i % colCount].push(unassigned[i]);
  }
  return columns;
}
