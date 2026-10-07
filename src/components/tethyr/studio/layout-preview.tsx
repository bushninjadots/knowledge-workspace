// A miniature of a layout applied to the member's own page: the real output of
// the composition engine (areas, grid columns, titles, order) painted with the
// member's real look — fonts, atmosphere, surfaces, borders, dividers, type
// scale — through the same CSS the page uses. Blocks are drawn as labelled
// skeletons so the preview reads the same whether or not they have content
// yet, and so it can never claim content the page doesn't have.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getBlock } from "@/lib/block-registry";
import type { LayoutBlockInstance, PageLayout } from "@/lib/page-blocks";
import {
  CARD_SURFACE_STYLE,
  blockFrameStyle,
  cardFillStyle,
  studioBackgroundVars,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
  profileScheme,
  type StudioConfig,
} from "@/lib/studio-config";
import { themeTokensToStyle } from "@/lib/theme-tokens";
import { useTheme as useAppTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  AreaTitle,
  areaSurfaceClass,
  areaSurfaceStyle,
  areaWidthStyle,
} from "@/components/tethyr/page/area-frame";
import { lookCanvasAttributes } from "@/components/tethyr/page/look-canvas";

const MEDIA = new Set(["profile-gallery", "profile-projects", "profile-currently-building"]);

function SkeletonBlock({ block }: { block: LayoutBlockInstance }) {
  if (block.type === "profile-header") {
    return (
      <div className="studio-header flex items-center gap-4 p-4">
        <span className="h-12 w-12 shrink-0 rounded-full bg-[var(--border-strong)]" />
        <span className="min-w-0">
          <span className="studio-name block font-display text-3xl font-semibold leading-tight text-foreground">
            Your name
          </span>
          <span className="studio-header-meta mt-1 block text-sm text-muted-foreground">
            What you make · where you are
          </span>
        </span>
      </div>
    );
  }
  const label = getBlock(block.type)?.label ?? block.type;
  return (
    <div>
      <div className="block-title-row">
        <span className="block-title">{label}</span>
      </div>
      {MEDIA.has(block.type) && (
        <span
          className="mb-3 block h-24 rounded-[var(--radius-md)]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--user-accent, var(--primary)) 45%, var(--surface)), color-mix(in oklab, var(--foreground) 18%, var(--surface)))",
          }}
        />
      )}
      <span className="block h-3 w-11/12 rounded-full bg-[color-mix(in_oklab,var(--foreground)_28%,transparent)]" />
      <span className="mt-2.5 block h-3 w-2/3 rounded-full bg-[color-mix(in_oklab,var(--foreground)_18%,transparent)]" />
    </div>
  );
}

/** The frame every preview is drawn in, so page widths compare honestly: a
 *  Column page shows real margins beside it, a Full page fills it. */
const FRAME = 1000;
const PAGE_WIDTH: Record<StudioConfig["structure"], number> = {
  single: 620,
  sidebar: 800,
  wide: 920,
  full: FRAME,
};

/** The composed page scaled to the preview's width, clipped to `height` px. */
export function LayoutPreview({
  layout,
  config,
  height = 160,
  className,
}: {
  layout: PageLayout;
  config: StudioConfig;
  height?: number;
  className?: string;
}) {
  const { resolvedTheme } = useAppTheme();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    if (!box) return;
    const measure = () => setScale(box.clientWidth / FRAME || 0.25);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const width = PAGE_WIDTH[config.structure] ?? PAGE_WIDTH.wide;
  const style = useMemo(
    () =>
      ({
        ...themeTokensToStyle(
          studioConfigToThemeTokens(config),
          profileScheme(config, null, resolvedTheme),
        ),
        ...studioSurfaceStyle(config),
        ...cardFillStyle(config),
        ...studioBackgroundVars(config, "public"),
        ...CARD_SURFACE_STYLE,
      }) as CSSProperties,
    [config, resolvedTheme],
  );
  return (
    <div
      ref={setBox}
      aria-hidden
      className={cn("pointer-events-none select-none overflow-hidden", className)}
      style={{ height, ...style, backgroundColor: "var(--studio-bg, var(--background))" }}
    >
      <div
        className="studio-canvas relative isolate origin-top-left font-sans text-foreground"
        style={{
          width,
          marginLeft: ((FRAME - width) / 2) * scale,
          padding: "2rem 1.5rem",
          transform: `scale(${scale})`,
        }}
        {...lookCanvasAttributes(config)}
      >
        <div className="flex flex-col gap-10">
          {layout.sections
            .filter((section) => section.visible !== false)
            .map((section) => {
              const grid = new Map((section.grid ?? []).map((item) => [item.i, item]));
              const blocks = section.blocks
                .filter((block) => block.visible !== false && grid.has(block.id))
                .sort((a, b) => {
                  const ga = grid.get(a.id)!;
                  const gb = grid.get(b.id)!;
                  return ga.y - gb.y || ga.x - gb.x;
                });
              return (
                <section
                  key={section.id}
                  className={areaSurfaceClass(section)}
                  style={areaSurfaceStyle(section)}
                >
                  <AreaTitle section={section} />
                  <div className="grid grid-cols-12 gap-4" style={areaWidthStyle(section)}>
                    {blocks.map((block) => {
                      const item = grid.get(block.id)!;
                      return (
                        <div
                          key={block.id}
                          className={cn(
                            "studio-block",
                            block.type === "profile-header" && "studio-block-flush",
                          )}
                          style={{
                            gridColumn: `${item.x + 1} / span ${item.w}`,
                            ...blockFrameStyle(block),
                          }}
                        >
                          <SkeletonBlock block={block} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      </div>
    </div>
  );
}
