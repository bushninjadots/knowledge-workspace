// ── Page Layout ───────────────────────────────────────────────────────────────
// Renders a PageLayout: an ordered list of sections, each with a column
// arrangement (full, two_column, three_column, sidebar, feature).
// Each section contains an ordered list of blocks.
//
// Purely presentational: blocks render through BlockRenderer with the shared
// BlockContext. Arrangement (block width and assigned column) is honored so a
// saved Studio layout renders identically here, in previews, and on the
// published page. All editing lives exclusively in the Creativity Studio.

import { memo } from "react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import type {
  PageLayout as PageLayoutType,
  BlockContext,
  LayoutBlockInstance,
} from "@/lib/page-blocks";
import { groupSections } from "@/lib/page-block-layout";

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  /** When set, overrides responsive breakpoints to match the preview mode. */
  devicePreview?: "desktop" | "tablet" | "mobile";
  /**
   * When true (default), each block honors its `config.width` arrangement and
   * grid sections group blocks by their assigned `column`. The Studio canvas
   * disables this because its BlockCard already applies width/placement chrome.
   */
  applyBlockWidths?: boolean;
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

/** Number of columns each section layout produces at desktop width. */
const COLUMN_COUNT: Record<string, number> = {
  full: 1,
  two_column: 2,
  three_column: 3,
  sidebar_left: 2,
  sidebar_right: 2,
  feature: 2,
};

/** Width utilities for block `config.width` — same contract as the Studio canvas. */
const BLOCK_WIDTH_CLASS: Record<string, string> = {
  full: "w-full",
  "2/3": "w-2/3",
  "1/2": "w-1/2",
  "1/3": "w-1/3",
  auto: "w-auto",
};

function blockWidthClass(width: unknown, devicePreview?: "desktop" | "tablet" | "mobile") {
  if (devicePreview === "mobile" || devicePreview === "tablet") return "w-full";
  return BLOCK_WIDTH_CLASS[(width as string) ?? "full"] ?? "w-full";
}

/**
 * Distribute blocks into columns: blocks carrying an explicit `column` land in
 * that column, unassigned blocks round-robin across columns. Mirrors the rule
 * the Studio canvas uses so arrangement survives from edit to hosted page.
 */
function groupBlocksByColumn(
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

/**
 * Renders the full page composition: sections → blocks.
 * Memoised at the layout level so only changed sections re-render.
 */
export const PageLayoutRenderer = memo(function PageLayoutRenderer({
  layout,
  context,
  devicePreview,
  applyBlockWidths = true,
}: PageLayoutRendererProps) {
  return (
    <div className="flex flex-col" data-page-layout>
      {groupSections(layout).map((sectionGroup, groupIndex) => (
        <div
          key={`section-group-${groupIndex}`}
          className={
            layout.composition?.columns && layout.composition.columns > 1
              ? "grid grid-cols-1 gap-6 md:grid-cols-2"
              : ""
          }
          style={{
            gridTemplateColumns:
              layout.composition?.columns && layout.composition.columns > 2
                ? "repeat(3, minmax(0, 1fr))"
                : undefined,
          }}
          data-section-group
        >
          {sectionGroup.map((section) => {
            // Override grid classes based on device preview.
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

            // The section is a real multi-column arrangement unless the device
            // preview forced everything to a single column.
            const colCount = COLUMN_COUNT[section.layout] ?? 1;
            const forceSingle =
              devicePreview === "mobile" ||
              (devicePreview === "tablet" && section.layout === "three_column");
            const useGrid = colCount > 1 && !forceSingle;

            const renderBlock = (block: LayoutBlockInstance) => {
              const widthWrap = applyBlockWidths
                ? `min-w-0 ${blockWidthClass(block.config?.width, devicePreview)}`
                : "min-w-0";
              return (
                <div key={block.id} className={widthWrap}>
                  <BlockRenderer type={block.type} config={block.config} context={context} />
                </div>
              );
            };

            return (
              <section
                key={section.id}
                data-section-id={section.id}
                data-section-layout={section.layout}
                className="py-4 first:pt-0 last:pb-0"
              >
                <div className={gridClass}>
                  {useGrid
                    ? groupBlocksByColumn(blocks, colCount).map((colBlocks, colIdx) => (
                        <div key={`${section.id}:col-${colIdx}`} className="min-w-0 space-y-6">
                          {colBlocks.map((block) => renderBlock(block))}
                        </div>
                      ))
                    : blocks.map((block) => renderBlock(block))}
                </div>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
});
