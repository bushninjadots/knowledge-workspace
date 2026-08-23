// ── Page Layout ───────────────────────────────────────────────────────────────
// Renders a PageLayout: an ordered list of sections, each with a column
// arrangement (full, two_column, three_column, sidebar, feature).
// Each section contains an ordered list of blocks.

import { memo } from "react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import type { PageLayout as PageLayoutType, BlockContext } from "@/lib/page-blocks";

interface PageLayoutProps {
  layout: PageLayoutType;
  context: BlockContext;
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

/**
 * Renders the full page composition: sections → blocks.
 * Memoised at the layout level so only changed sections re-render.
 */
export const PageLayoutRenderer = memo(function PageLayoutRenderer({
  layout,
  context,
}: PageLayoutProps) {
  const sections = [...layout.sections].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col" data-page-layout>
      {sections.map((section) => {
        const gridClass = SECTION_GRID[section.layout] ?? "";
        const blocks = section.blocks
          .filter((b) => b.visible !== false)
          .sort((a, b) => a.position - b.position);

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            className="py-4 first:pt-0 last:pb-0"
          >
            <div className={gridClass}>
              {blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  type={block.type}
                  config={block.config}
                  context={context}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});