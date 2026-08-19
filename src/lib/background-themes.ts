import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Profile background — the backdrop behind a member's whole Tethyr space.
 *
 * Stored as a JSONB column on `profiles` so it follows the member across
 * devices and can render on their public Studio too. `color`/`pattern`/mode
 * are always kept in the row so switching modes never loses a previous choice.
 */
export type ProfileBackground = {
  mode: "color" | "pattern" | "image" | null;
  /** Base tint color (CSS color string) used by color and pattern modes. */
  color: string | null;
  /** Pattern id from BACKGROUND_PATTERNS. */
  pattern: string | null;
  /** Storage path in the `backgrounds` bucket (image mode). */
  image_url: string | null;
  /**
   * How strongly the choice is applied, 1–100 (percent of the colour mixed
   * into the theme background; pattern + image intensity scale with it).
   * Omitted/older rows fall back to the default.
   */
  strength?: number | null;
};

/** Default tint strength when a row predates the strength slider. */
export const BACKGROUND_DEFAULT_STRENGTH = 34;

/** Lower bound so a barely-visible choice can't be mistaken for "not saved". */
export const BACKGROUND_MIN_STRENGTH = 18;

export const BACKGROUND_MAX_STRENGTH = 60;

export type BackgroundColor = { id: string; label: string; color: string };

export type BackgroundPattern = {
  id: string;
  label: string;
  backgroundImage: string;
  backgroundSize: string;
};

/**
 * Curated base tints. These are always mixed into the theme's own background
 * (see backgroundStyle), so every choice stays quiet enough that text keeps
 * its guaranteed contrast in both light and dark mode.
 */
export const BACKGROUND_COLORS: BackgroundColor[] = [
  { id: "sky", label: "Sky", color: "#38bdf8" },
  { id: "ocean", label: "Ocean", color: "#2dd4bf" },
  { id: "meadow", label: "Meadow", color: "#4ade80" },
  { id: "sunset", label: "Sunset", color: "#fbbf24" },
  { id: "rose", label: "Rose", color: "#fb7185" },
  { id: "violet", label: "Violet", color: "#a78bfa" },
  { id: "slate", label: "Slate", color: "#94a3b8" },
  { id: "sand", label: "Sand", color: "#e9c9a3" },
];

/**
 * CSS-drawn patterns. Each uses `var(--bg-pattern-color)`, which the layer
 * sets to a faint mix of the foreground, so patterns adapt to light/dark.
 */
export const BACKGROUND_PATTERNS: BackgroundPattern[] = [
  {
    id: "dots",
    label: "Dots",
    backgroundImage: "radial-gradient(circle, var(--bg-pattern-color) 1.5px, transparent 1.5px)",
    backgroundSize: "22px 22px",
  },
  {
    id: "grid",
    label: "Grid",
    backgroundImage:
      "linear-gradient(to right, var(--bg-pattern-color) 1px, transparent 1px), linear-gradient(to bottom, var(--bg-pattern-color) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  {
    id: "diagonal",
    label: "Diagonal",
    backgroundImage:
      "repeating-linear-gradient(45deg, var(--bg-pattern-color) 0 1px, transparent 1px 16px)",
    backgroundSize: "auto",
  },
  {
    id: "crosshatch",
    label: "Crosshatch",
    backgroundImage:
      "repeating-linear-gradient(45deg, var(--bg-pattern-color) 0 1px, transparent 1px 18px), repeating-linear-gradient(-45deg, var(--bg-pattern-color) 0 1px, transparent 1px 18px)",
    backgroundSize: "auto",
  },
  {
    id: "rings",
    label: "Rings",
    backgroundImage:
      "radial-gradient(circle at 50% 50%, var(--bg-pattern-color) 0 1.5px, transparent 2px 26px)",
    backgroundSize: "26px 26px",
  },
];

export const BACKGROUND_PATTERN_IDS = BACKGROUND_PATTERNS.map((p) => p.id);

/**
 * How strongly an uploaded image is dimmed behind content at the default
 * strength. Strong enough to read as a personal wallpaper, faint enough that
 * text stays legible. Scales with the member's chosen strength.
 */
export const BACKGROUND_IMAGE_OPACITY = 0.55;

export function imageOpacityFor(strength: number | null | undefined): number {
  const s = clampStrength(strength);
  // Two-segment band so the default strength keeps the original 0.55 dim:
  // min → 0.35, default → 0.55, max → 0.75 (never fully opaque, so text
  // keeps its contrast).
  if (s <= BACKGROUND_DEFAULT_STRENGTH) {
    const t =
      (s - BACKGROUND_MIN_STRENGTH) / (BACKGROUND_DEFAULT_STRENGTH - BACKGROUND_MIN_STRENGTH);
    return Math.round((0.35 + t * 0.2) * 100) / 100;
  }
  const t =
    (s - BACKGROUND_DEFAULT_STRENGTH) / (BACKGROUND_MAX_STRENGTH - BACKGROUND_DEFAULT_STRENGTH);
  return Math.round((0.55 + t * 0.2) * 100) / 100;
}

export function isBackgroundActive(bg: ProfileBackground | null | undefined): boolean {
  return !!bg && bg.mode != null;
}

/**
 * Turn a saved background into layer styles. The base color is always a
 * color-mix of the choice into `var(--background)`, which guarantees the
 * wallpaper can never overpower the surface hierarchy in either theme.
 */
/** Clamp a saved strength into the allowed range. */
export function clampStrength(strength: number | null | undefined): number {
  if (!strength || Number.isNaN(strength)) return BACKGROUND_DEFAULT_STRENGTH;
  return Math.min(BACKGROUND_MAX_STRENGTH, Math.max(BACKGROUND_MIN_STRENGTH, strength));
}

export function backgroundStyle(
  background: ProfileBackground | null | undefined,
  imageUrl: string | null = null,
): CSSProperties {
  if (!background?.mode) return {};
  // Strong enough to be clearly visible as a personal backdrop, but still a
  // tint: mixed into the theme's own background so text keeps its contrast
  // in both light and dark mode.
  const strength = clampStrength(background.strength);
  const patternPct = Math.round(strength * 0.4);
  const base = background.color
    ? `color-mix(in oklab, ${background.color} ${strength}%, var(--background))`
    : "var(--background)";

  switch (background.mode) {
    case "color":
      return { backgroundColor: base };
    case "pattern": {
      const pattern = BACKGROUND_PATTERNS.find((p) => p.id === background.pattern);
      if (!pattern) return { backgroundColor: base };
      return {
        backgroundColor: base,
        backgroundImage: pattern.backgroundImage,
        backgroundSize: pattern.backgroundSize,
        backgroundRepeat: "repeat",
        "--bg-pattern-color": `color-mix(in oklab, var(--foreground) ${patternPct}%, transparent)`,
      } as CSSProperties;
    }
    case "image":
      return imageUrl
        ? {
            backgroundColor: "var(--background)",
            backgroundImage: `url("${imageUrl}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }
        : {};
    default:
      return {};
  }
}

/** Public URL for a background image — public bucket, so no signed URL needed. */
export function backgroundImagePublicUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  return supabase.storage.from("backgrounds").getPublicUrl(imageUrl).data.publicUrl;
}
