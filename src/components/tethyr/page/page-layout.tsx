// ── Page Layout ───────────────────────────────────────────────────────────────
// Renders a published (or draft-previewed) PageLayout for visitors: an ordered
// list of areas (sections), each with a column arrangement or a persisted
// 12-column grid. Editing happens in the Studio editor (g-studio-surface),
// which has the one block inspector; this renderer is view-only.

import { memo, useCallback, useEffect, useState } from "react";
import { BlockRenderer } from "@/components/tethyr/page/block-renderer";
import {
  AreaDivider,
  AreaTitle,
  areaGridStyle,
  areaSurfaceClass,
  areaSurfaceStyle,
  areaOverlapped,
  overlapAttr,
} from "./area-frame";
import type {
  PageLayout as PageLayoutType,
  BlockContext,
  LayoutBlockInstance,
  SectionLayoutType,
} from "@/lib/page-blocks";
import { getBlock } from "@/lib/block-registry";
import { blockFrameStyle } from "@/lib/studio-config";
import { isDefinitelyEmptyBlock, shouldRenderSectionInView } from "@/lib/studio-visibility";
import { reflowAroundHidden } from "@/lib/studio-grid";
import "@/components/tethyr/blocks/register-all";

interface PageLayoutRendererProps {
  layout: PageLayoutType;
  context: BlockContext;
  profileCompleteness?: number;
  onCompleteProfile?: () => void;
}

/** Tailwind grid classes for each section layout type. */
export const SECTION_GRID: Record<SectionLayoutType, string> = {
  full: "",
  two_column: "grid grid-cols-1 gap-8 md:grid-cols-2",
  three_column: "grid grid-cols-1 gap-6 md:grid-cols-3",
  sidebar_left: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(180px,280px)_minmax(0,1fr)]",
  sidebar_right: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(180px,280px)]",
  feature: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]",
  side_by_side: "grid grid-cols-1 gap-8 md:grid-cols-2",
  // Whitespace-led compositions for the Studio personality presets. Their
  // rhythm comes from intentional asymmetry, so they skip the divider border.
  featured_work: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]",
  asymmetric: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]",
  split: "grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
  image_lead: "grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
  compact_list: "",
};

/**
 * A template should not preserve an elaborate multi-column composition after
 * empty blocks have been removed. Falling back to flow for one public block,
 * and reducing three columns to two when only two blocks remain, keeps sparse
 * sections intentional instead of leaving a lonely card in an oversized lane.
 */
function sparseSafeGridClass(layout: SectionLayoutType, blockCount: number): string {
  if (blockCount <= 1) return "";
  if (layout === "three_column" && blockCount === 2) {
    return "grid grid-cols-1 gap-6 md:grid-cols-2";
  }
  return SECTION_GRID[layout] ?? "";
}

/**
 * Renders the full page composition: sections → blocks.
 * Memoised at the layout level so only changed sections re-render.
 */
export const PageLayoutRenderer = memo(function PageLayoutRenderer({
  layout,
  context,
  profileCompleteness,
  onCompleteProfile,
}: PageLayoutRendererProps) {
  const sections = [...layout.sections]
    .sort((a, b) => a.position - b.position)
    // Visitors never get space reserved for sections with no visible content.
    .filter((section) => section.blocks.some((block) => block.visible !== false));

  // Blocks that report they rendered no public content. Used to fully
  // collapse sections whose visible blocks are all empty, so the public
  // Studio doesn't leave blank bands + dividers behind.
  const [emptyBlockIds, setEmptyBlockIds] = useState<Set<string>>(new Set());

  // Memoised so unrelated layout renders don't reset the set.
  const reportBlockEmpty = useCallback((blockId: string, isEmpty: boolean) => {
    setEmptyBlockIds((prev) => {
      const next = new Set(prev);
      if (isEmpty) next.add(blockId);
      else next.delete(blockId);
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) return prev;
      return next;
    });
  }, []);

  // Drop reports for deleted blocks so a reused id isn't hidden by a stale report.
  useEffect(() => {
    const blockIds = new Set(
      sections.flatMap((section) => section.blocks).map((block) => block.id),
    );
    setEmptyBlockIds((previous) => {
      const next = new Set([...previous].filter((id) => blockIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [sections]);

  // Drop sections whose visible blocks are all empty. A block counts as empty
  // when it was classified statically (config-driven, empty config) or when it
  // reported no public content at runtime (`emptyBlockIds`).
  const sectionsToRender = sections.filter((section) =>
    shouldRenderSectionInView(
      section,
      new Set([
        ...emptyBlockIds,
        ...section.blocks.filter((block) => isDefinitelyEmptyBlock(block)).map((block) => block.id),
      ]),
    ),
  );

  return (
    <div
      className="flex flex-col"
      style={{ gap: "calc(var(--studio-gap, 14px) * 1.6)" }}
      data-page-layout
    >
      {sectionsToRender.map((section, renderIndex) => {
        const previousSection = sectionsToRender[renderIndex - 1] ?? null;
        /** Grid-based (builder) sections render from their persisted 12-col
         *  grid; template sections fall back to SECTION_GRID + block.span. */
        const hasGrid = (section.grid?.length ?? 0) > 0;
        const gridByBlock = new Map((section.grid ?? []).map((item) => [item.i, item]));
        const blocks = section.blocks
          .filter(
            (b) => b.visible !== false && !emptyBlockIds.has(b.id) && !isDefinitelyEmptyBlock(b),
          )
          .sort((a, b) => a.position - b.position);
        // Blocks that won't show (hidden or empty) give their columns back to
        // the rest of their row instead of leaving a hole.
        const placed = reflowAroundHidden(
          section.grid ?? [],
          new Set(
            (section.grid ?? [])
              .map((item) => item.i)
              .filter((id) => !blocks.some((block) => block.id === id)),
          ),
        );
        const gridClass = sparseSafeGridClass(section.layout, blocks.length);

        return (
          <section
            key={section.id}
            data-section-id={section.id}
            data-section-layout={section.layout}
            style={areaSurfaceStyle(section)}
            className={["first:pt-0", areaSurfaceClass(section)].filter(Boolean).join(" ")}
          >
            <AreaTitle section={section} />
            <div
              className={
                hasGrid
                  ? "grid grid-cols-2 gap-8 md:grid-cols-12 content-safe"
                  : `${gridClass} content-safe`
              }
              style={areaGridStyle(
                section,
                hasGrid
                  ? { gridAutoFlow: "row dense", alignItems: "start" }
                  : gridClass
                    ? { gridAutoFlow: "row", alignItems: "start" }
                    : undefined,
              )}
              data-section-grid={hasGrid ? "true" : undefined}
              data-overlapped={
                hasGrid &&
                areaOverlapped(
                  section,
                  sectionsToRender[renderIndex + 1],
                  (b) =>
                    b.visible !== false && !emptyBlockIds.has(b.id) && !isDefinitelyEmptyBlock(b),
                )
                  ? ""
                  : undefined
              }
            >
              {blocks.map((block) => {
                const stored = hasGrid ? gridByBlock.get(block.id) : undefined;
                const gridItem = stored
                  ? { ...stored, ...(placed?.get(block.id) ?? {}) }
                  : undefined;
                const blockDef = getBlock(block.type);
                // Full-bleed blocks opt out of the studio-block frame, exactly
                // like the owner Studio view and the editor canvas.
                const isFlush = blockDef?.containerless === true || block.type === "profile-header";
                return (
                  <div
                    key={`drop-${block.id}`}
                    className={[
                      // "Show on" desktop / phone only (block settings).
                      block.showOn === "desktop" ? "max-md:hidden" : "",
                      block.showOn === "mobile" ? "md:hidden" : "",
                      hasGrid
                        ? gridItem
                          ? `relative min-w-0 ${colStartClass(gridItem.x + 1)} ${spanClass(gridItem.w)} ${phoneClasses(block)}`
                          : "relative min-w-0 max-md:col-span-2"
                        : // Template sections (no persisted grid): the wrapper is
                          // the grid item — same span boxes the owner view uses —
                          // instead of display:contents auto-flow, which laid the
                          // same section out differently on the public page.
                          "relative min-w-0",
                      !hasGrid && gridClass && typeof block.span === "number"
                        ? spanClass(block.span)
                        : "",
                    ].join(" ")}
                    data-overlap={
                      hasGrid ? overlapAttr(block, gridItem, section, previousSection) : undefined
                    }
                  >
                    {/* Same studio-block frame the owner Studio view wraps its
                        blocks in (background, border, radius, inset; flush for
                        full-bleed blocks) — so a block reads identically on the
                        public page and in the creator's view. */}
                    <div
                      style={blockFrameStyle(block)}
                      className={[
                        "relative h-full min-h-0 overflow-hidden studio-block",
                        isFlush ? "studio-block-flush" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <BlockRenderer
                        type={block.type}
                        config={block.config}
                        context={{
                          ...context,
                          blockId: block.id,
                          profileCompleteness:
                            block.type === "profile-header" ? profileCompleteness : undefined,
                          onCompleteProfile:
                            block.type === "profile-header" ? onCompleteProfile : undefined,
                          onBlockEmptyChange: reportBlockEmpty,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <AreaDivider section={section} />
          </section>
        );
      })}
    </div>
  );
});

/** Phone placement for a block in a grid area: phones get a two-column
 *  grid, where a block spans both (default) or one ("half"), and can move to
 *  the start or end of its area. Desktop placement is untouched. */
export function phoneClasses(
  block: Pick<LayoutBlockInstance, "phoneWidth" | "phoneOrder">,
): string {
  return [
    block.phoneWidth === "half" ? "max-md:col-span-1" : "max-md:col-span-2",
    block.phoneOrder === "first" ? "max-md:order-first" : "",
    block.phoneOrder === "last" ? "max-md:order-last" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function spanClass(span: number): string {
  const classes = [
    "md:col-span-1",
    "md:col-span-2",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-5",
    "md:col-span-6",
    "md:col-span-7",
    "md:col-span-8",
    "md:col-span-9",
    "md:col-span-10",
    "md:col-span-11",
    "md:col-span-12",
  ];
  return classes[Math.min(classes.length, Math.max(1, Math.round(span))) - 1];
}

export function colStartClass(column: number): string {
  const classes = [
    "md:col-start-1",
    "md:col-start-2",
    "md:col-start-3",
    "md:col-start-4",
    "md:col-start-5",
    "md:col-start-6",
    "md:col-start-7",
    "md:col-start-8",
    "md:col-start-9",
    "md:col-start-10",
    "md:col-start-11",
    "md:col-start-12",
  ];
  return classes[Math.min(classes.length, Math.max(1, Math.round(column))) - 1];
}
