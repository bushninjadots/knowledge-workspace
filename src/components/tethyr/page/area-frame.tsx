// ── Area frame ────────────────────────────────────────────────────────────────
// How an area (a section of blocks) presents itself — its title row, a
// surface behind the whole area (tint, accent, gradient or image, as a panel
// or edge to edge), its own accent colour, the gap and alignment of its
// blocks, its width, a divider and the room after it. One module for the
// editor canvas, the owner's Studio view and the public page, so an area
// looks the same in all three.

import type { CSSProperties, ReactNode } from "react";
import type { LayoutBlockInstance, LayoutGridItem, LayoutSection } from "@/lib/page-blocks";
import { accentFamilyVars } from "@/lib/studio-config";
import { isSafeUrl } from "@/lib/validators";
import { cn } from "@/lib/utils";

/** Untitled areas are named "Area 3" by the editor; those never show. */
const PLACEHOLDER_TITLE = /^area\s+\d+$/i;

/** The title an area shows on the page, or null when it shows none. */
export function areaTitle(section: LayoutSection): string | null {
  const title = section.title?.trim();
  if (!title || PLACEHOLDER_TITLE.test(title)) return null;
  return section.appearance?.showTitle === false ? null : title;
}

/** Classes for the area's own surface (background treatments pad the area). */
/**
 * Phones read top to bottom, so a visitor should meet the person before their
 * work: the area holding the profile header moves to the top on phones.
 * Desktop keeps the owner's arrangement. (Areas stack in a flex column on
 * both the public page and the owner's view.)
 */
export function areaPhoneOrderClass(section: LayoutSection): string {
  return section.blocks.some((block) => block.type === "profile-header" && block.visible !== false)
    ? "max-md:order-first"
    : "";
}

export function areaSurfaceClass(section: LayoutSection): string {
  const appearance = section.appearance ?? {};
  const background = appearance.background ?? "none";
  const hasSurface = background !== "none";
  return cn(
    // Hooks for the visual language (styles.css): rhythm, transitions,
    // the page-wide divider and section numbers key off these.
    "studio-area",
    hasSurface && "studio-area-surface",
    (appearance.divider ?? "none") !== "none" && "studio-area-own-divider",
    hasSurface &&
      (appearance.bleed
        ? // Edge to edge across the Studio column, flush corners.
          "-mx-4 px-4 py-6 sm:-mx-6 sm:px-6 sm:py-8"
        : "rounded-[var(--studio-radius,0.75rem)] p-4 sm:p-6"),
    background === "tint" && "bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]",
    background === "accent" &&
      cn(
        "bg-[var(--user-accent-subtle,var(--surface-sunken))]",
        !appearance.bleed && "border border-[var(--user-accent-border,var(--border))]",
      ),
    background === "gradient" &&
      "bg-[linear-gradient(135deg,color-mix(in_oklab,var(--user-accent,var(--primary))_22%,transparent),color-mix(in_oklab,var(--user-accent,var(--primary))_4%,transparent)_70%)]",
    background === "image" && "bg-cover bg-center",
  );
}

/** Inline style for the area: its accent, image and the room after it. */
export function areaSurfaceStyle(section: LayoutSection): CSSProperties | undefined {
  const appearance = section.appearance ?? {};
  const style: Record<string, string> = { ...(accentFamilyVars(appearance.accent) ?? {}) };
  const spacing = appearance.spacing ?? "normal";
  if (spacing === "tight") style.marginBottom = "calc(var(--studio-gap, 14px) * -0.75)";
  if (spacing === "loose") style.marginBottom = "calc(var(--studio-gap, 14px) * 2)";
  if (appearance.background === "image" && appearance.imageUrl && isSafeUrl(appearance.imageUrl)) {
    // A soft wash keeps cards and titles readable over any photo.
    style.backgroundImage = `linear-gradient(color-mix(in oklab, var(--background) 55%, transparent), color-mix(in oklab, var(--background) 55%, transparent)), url("${appearance.imageUrl.replace(/"/g, "%22")}")`;
  }
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}

/** Gap between blocks for an area, from the Studio's own rhythm. */
export function areaGapScale(section: LayoutSection): number {
  const gap = section.appearance?.gap ?? "normal";
  return gap === "tight" ? 0.5 : gap === "roomy" ? 1.75 : 1;
}

/** Style for the area's block grid on the page: gap, alignment, width. */
export function areaGridStyle(
  section: LayoutSection,
  base: CSSProperties | undefined,
): CSSProperties | undefined {
  const appearance = section.appearance ?? {};
  const style: CSSProperties = { ...(base ?? {}) };
  if (appearance.gap && appearance.gap !== "normal") {
    style.gap = appearance.gap === "tight" ? "0.75rem" : "3rem";
  }
  if (appearance.align) style.alignItems = appearance.align;
  Object.assign(style, areaWidthStyle(section) ?? {});
  return Object.keys(style).length > 0 ? style : undefined;
}

/** An area's own width: Narrow for a tighter column, Reading for a
 *  comfortable line length on long text. Centred in the page. Shared by the
 *  editor, the page and layout previews so they can't disagree. */
export function areaWidthStyle(section: LayoutSection): CSSProperties | undefined {
  const width = section.appearance?.width;
  if (width === "narrow") return { maxWidth: "min(100%, 46rem)", marginInline: "auto" };
  if (width === "reading") return { maxWidth: "min(100%, 38rem)", marginInline: "auto" };
  return undefined;
}

/** The divider an area draws after itself, if any. */
export function AreaDivider({ section }: { section: LayoutSection }) {
  const divider = section.appearance?.divider ?? "none";
  if (divider === "none") return null;
  if (divider === "dots") {
    return (
      <div aria-hidden className="mt-8 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-[var(--user-accent,var(--primary))] opacity-60"
          />
        ))}
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "mt-8 h-px w-full",
        divider === "line"
          ? "bg-[var(--border)]"
          : "bg-[linear-gradient(90deg,transparent,var(--user-accent,var(--primary)),transparent)] opacity-60",
      )}
    />
  );
}

/** The area's title row: accent tick, label, hairline; optional action. */
export function AreaTitle({ section, action }: { section: LayoutSection; action?: ReactNode }) {
  const title = areaTitle(section);
  if (!title && !action) return null;
  return (
    <header className="studio-area-head mb-3 flex items-center gap-2">
      {title && (
        <>
          <span
            aria-hidden
            className="studio-area-tick h-3 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--vl-mark, var(--user-accent, var(--trust)))" }}
          />
          <h2 className="studio-area-title t-label">{title}</h2>
        </>
      )}
      <span aria-hidden className="t-rule flex-1" />
      {action}
    </header>
  );
}

/**
 * "Overlap the piece above" (LayoutBlockInstance.overlap) for one block's
 * grid cell, as its `data-overlap` value (styles.css; bigger screens only).
 * The grid itself never overlaps — dragging, snapping and phone stacking
 * work as usual. The piece is drawn up across the space above it and into
 * room the frames above make for it (`areaOverlapped`), so it layers over
 * their edge and never over their content:
 *   • "row" — from a later row of its area, across the row gap;
 *   • "area" — from its area's first row into the area before, only when no
 *     area title sits between them.
 * It never reaches over a profile header, which has no frame to make room.
 */
export function overlapAttr(
  block: Pick<LayoutBlockInstance, "overlap">,
  item: Pick<LayoutGridItem, "y"> | undefined,
  section: LayoutSection,
  previous: LayoutSection | null | undefined,
): "area" | "row" | undefined {
  if (block.overlap !== "up" || !item) return undefined;
  const top = Math.min(...(section.grid ?? []).map((cell) => cell.y));
  if (item.y > top) return hasHeader(section) ? undefined : "row";
  if (!previous || hasHeader(previous) || areaTitle(section)) return undefined;
  return "area";
}

const hasHeader = (section: LayoutSection) =>
  section.blocks.some((block) => block.type === "profile-header");

/**
 * Whether this area's frames make room at their foot for a piece layered
 * over them — from a later row of this area, or from the area after it.
 * `shown` says which blocks will actually render (hidden and empty ones
 * don't reach anywhere).
 */
export function areaOverlapped(
  section: LayoutSection,
  next: LayoutSection | null | undefined,
  shown: (block: LayoutBlockInstance) => boolean,
): boolean {
  const reaches = (area: LayoutSection, previous: LayoutSection | null, kind: "area" | "row") =>
    area.blocks.some(
      (block) =>
        shown(block) &&
        overlapAttr(
          block,
          area.grid?.find((cell) => cell.i === block.id),
          area,
          previous,
        ) === kind,
    );
  return reaches(section, null, "row") || (!!next && reaches(next, section, "area"));
}
