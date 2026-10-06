// ── Area frame ────────────────────────────────────────────────────────────────
// How an area (a section of blocks) presents itself — its title row, an
// optional background behind the whole area, and the room after it. One
// module for the editor canvas, the owner's Studio view and the public page,
// so an area looks the same in all three.

import type { CSSProperties, ReactNode } from "react";
import type { LayoutSection } from "@/lib/page-blocks";
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
  const background = section.appearance?.background ?? "none";
  return cn(
    background !== "none" && "rounded-[var(--studio-radius,0.75rem)] p-4 sm:p-6",
    background === "tint" && "bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]",
    background === "accent" &&
      "border border-[var(--user-accent-border,var(--border))] bg-[var(--user-accent-subtle,var(--surface-sunken))]",
  );
}

/** Extra room after the area, relative to the Studio's own rhythm. */
export function areaSurfaceStyle(section: LayoutSection): CSSProperties | undefined {
  const spacing = section.appearance?.spacing ?? "normal";
  if (spacing === "tight") return { marginBottom: "calc(var(--studio-gap, 14px) * -0.75)" };
  if (spacing === "loose") return { marginBottom: "calc(var(--studio-gap, 14px) * 2)" };
  return undefined;
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
