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
  frameForDevice,
  FREEFORM_COLUMNS,
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
    <div
      className="flex flex-col"
      data-page-layout
      style={
        sections.some((section) => frameForDevice(section.frames, devicePreview))
          ? {
              display: "grid",
              gridTemplateColumns: `repeat(${FREEFORM_COLUMNS}, minmax(0, 1fr))`,
              gridAutoRows: "minmax(2rem, auto)",
              gap: "var(--spacing-section, 1rem)",
            }
          : undefined
      }
    >
      {sections.map((section) => {
        const sectionFrame = frameForDevice(section.frames, devicePreview);
        const gridClass = gridClassForSection(section.layout, devicePreview);
        const blocks = section.blocks
          .filter((b) => b.visible !== false)
          .sort((a, b) => a.position - b.position);

        // The section is a real multi-column arrangement unless the device
        // preview forced everything to a single column.
        const colCount = effectiveColumnCount(section.layout, devicePreview);
        const useGrid = usesMultiColumnGrid(section.layout, devicePreview);
        const freeformBlocks = blocks.some((block) => frameForDevice(block.frames, devicePreview));

        const renderBlock = (block: LayoutBlockInstance) => {
          const span = Math.max(1, Math.min(block.span ?? 1, colCount));
          const widthWrap = applyBlockWidths
            ? `min-w-0 ${blockWidthClass(block.config?.width, devicePreview)}`
            : "min-w-0";
          const spanClass = useGrid && span > 1 ? `md:col-span-${span}` : "";
          const blockFrame = frameForDevice(block.frames, devicePreview);
          return (
            <div
              key={block.id}
              className={`${widthWrap} ${spanClass}`}
              style={
                blockFrame && freeformBlocks
                  ? {
                      gridColumn: `${blockFrame.x + 1} / span ${Math.max(1, Math.min(FREEFORM_COLUMNS, blockFrame.width))}`,
                      gridRowStart: blockFrame.y + 1,
                      minHeight: blockFrame.height ? `${blockFrame.height * 48}px` : undefined,
                    }
                  : undefined
              }
              data-freeform={blockFrame && freeformBlocks ? "true" : undefined}
            >
              <BlockRenderer type={block.type} config={block.config} context={context} />
            </div>
          );
        };

        return (
          <section
            key={section.id}
            style={
              sectionFrame
                ? {
                    gridColumn: `${sectionFrame.x + 1} / span ${Math.max(1, Math.min(FREEFORM_COLUMNS, sectionFrame.width))}`,
                    gridRowStart: sectionFrame.y + 1,
                    marginLeft: `${(sectionFrame.x / FREEFORM_COLUMNS) * 100}%`,
                    width: `${(sectionFrame.width / FREEFORM_COLUMNS) * 100}%`,
                  }
                : { paddingBlock: "var(--spacing-section, 1rem)" }
            }
            data-section-id={section.id}
            data-section-layout={section.layout}
            className="py-8 first:pt-0 last:pb-0 sm:py-10"
            data-freeform={sectionFrame ? "true" : undefined}
          >
            <div
              className={`${gridClass} [&>*]:min-w-0`}
              style={
                freeformBlocks
                  ? {
                      display: "grid",
                      gridTemplateColumns: `repeat(${FREEFORM_COLUMNS}, minmax(0, 1fr))`,
                      gridAutoRows: "minmax(2rem, auto)",
                      gap: "var(--spacing-section, 1rem)",
                    }
                  : undefined
              }
            >
              {freeformBlocks
                ? blocks.map((block) => renderBlock(block))
                : useGrid
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
