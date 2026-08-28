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
import {
  blockWidthClass,
  effectiveColumnCount,
  gridClassForSection,
  groupBlocksByColumn,
  usesMultiColumnGrid,
} from "@/components/tethyr/page/page-composition";
import type {
  PageLayout as PageLayoutType,
  BlockContext,
  LayoutBlockInstance,
} from "@/lib/page-blocks";
import type { DevicePreview } from "@/components/tethyr/page/page-composition";

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  /** When set, overrides responsive breakpoints to match the preview mode. */
  devicePreview?: DevicePreview;
  /**
   * When true (default), each block honors its `config.width` arrangement and
   * grid sections group blocks by their assigned `column`. The Studio canvas
   * disables this because its BlockCard already applies width/placement chrome.
   */
  applyBlockWidths?: boolean;
}

/** Width utilities and grid mapping live in page-composition.ts (shared with
 * the Studio canvas) so the editor and the hosted page never drift apart. */

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
  const sections = [...layout.sections].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col" data-page-layout>
      {sections.map((section) => {
        const gridClass = gridClassForSection(section.layout, devicePreview);
        const blocks = section.blocks
          .filter((b) => b.visible !== false)
          .sort((a, b) => a.position - b.position);

        // The section is a real multi-column arrangement unless the device
        // preview forced everything to a single column.
        const colCount = effectiveColumnCount(section.layout, devicePreview);
        const useGrid = usesMultiColumnGrid(section.layout, devicePreview);

        const renderBlock = (block: LayoutBlockInstance) => {
          const span = Math.max(1, Math.min(block.span ?? 1, colCount));
          const widthWrap = applyBlockWidths
            ? `min-w-0 ${blockWidthClass(block.config?.width, devicePreview)}`
            : "min-w-0";
          const spanClass = useGrid && span > 1 ? `md:col-span-${span}` : "";
          return (
            <div key={block.id} className={`${widthWrap} ${spanClass}`}>
              <BlockRenderer type={block.type} config={block.config} context={context} />
            </div>
          );
        };

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            className="py-8 first:pt-0 last:pb-0 sm:py-10"
            style={{ paddingBlock: "var(--spacing-section, 1rem)" }}
          >
            <div className={`${gridClass} [&>*]:min-w-0`}>
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
  );
});
