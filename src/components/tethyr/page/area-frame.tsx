// ── Area frame ────────────────────────────────────────────────────────────────
// How an area (a section of blocks) presents itself — its title row, a
// surface behind the whole area (tint, accent, gradient or image, as a panel
// or edge to edge), its own accent colour, the gap and alignment of its
// blocks, its width, a divider and the room after it. One module for the
// editor canvas, the owner's Studio view and the public page, so an area
// looks the same in all three.

import type { CSSProperties, ReactNode } from "react";
import type { LayoutSection } from "@/lib/page-blocks";
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
export function areaSurfaceClass(section: LayoutSection): string {
  const appearance = section.appearance ?? {};
  const background = appearance.background ?? "none";
  const hasSurface = background !== "none";
  return cn(
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
  if (appearance.width === "narrow") {
    style.maxWidth = "min(100%, 46rem)";
    style.marginInline = "auto";
  }
  return Object.keys(style).length > 0 ? style : undefined;
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
    <header className="mb-3 flex items-center gap-2">
      {title && (
        <>
          <span
            aria-hidden
            className="h-3 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--user-accent, var(--trust))" }}
          />
          <h2 className="t-label">{title}</h2>
        </>
      )}
      <span aria-hidden className="t-rule flex-1" />
      {action}
    </header>
  );
}
