import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Profile background — the backdrop behind a member's whole Tethyr space.
 *
 * Stored as a JSONB column on `profiles` so it follows the member across
 * devices and can render on their public Studio too. `color`/`pattern`/mode
 * are always kept in the row so switching modes never loses a previous choice.
 */
export type CardBorderPreference = "accent" | "neutral" | "none";
export type AccentMode = "dynamic" | "custom";
export type ContentDensity = "comfortable" | "compact";

export type ProfileBackground = {
  mode: "color" | "pattern" | "image" | "gradient" | null;
  /** Base tint color (CSS color string) used by color and pattern modes. */
  color: string | null;
  /** Pattern id from BACKGROUND_PATTERNS. */
  pattern: string | null;
  /** Gradient id from BACKGROUND_GRADIENTS (gradient mode). */
  gradient?: string | null;
  /** Storage path in the `backgrounds` bucket (image mode). */
  image_url: string | null;
  /**
   * How strongly the choice is applied, 1–100 (percent of the colour mixed
   * into the theme background; pattern + image intensity scale with it).
   * Omitted/older rows fall back to the default.
   */
  strength?: number | null;
  /** Appearance preferences share this JSON document so they work without a new table. */
  cardBorders?: CardBorderPreference | null;
  accentMode?: AccentMode | null;
  accentColor?: string | null;
  density?: ContentDensity | null;
  /** Shared banner presentation preferences for Dashboard and Studio. */
  bannerOverlay?: BannerOverlayId | null;
  bannerCaptionPosition?: "left" | "center" | "right" | null;
};

/**
 * Banner overlay treatments. These sit above the banner image only — they
 * never tint the page background — so a member can keep their photo readable
 * behind captions without changing the surface hierarchy.
 */
export type BannerOverlayId =
  "none" | "soft" | "strong" | "scrim" | "vignette" | "spotlight" | "duotone";

export type BannerOverlayOption = {
  id: BannerOverlayId;
  label: string;
  description: string;
};

export const BANNER_OVERLAYS: BannerOverlayOption[] = [
  { id: "none", label: "None", description: "Show the image untouched" },
  { id: "soft", label: "Soft", description: "A light, even wash" },
  { id: "strong", label: "Strong", description: "A heavier wash for busy photos" },
  { id: "scrim", label: "Bottom scrim", description: "Fades toward the caption" },
  { id: "vignette", label: "Vignette", description: "Darkens the outer edges" },
  { id: "spotlight", label: "Spotlight", description: "Lifts the centre of the image" },
  { id: "duotone", label: "Duotone", description: "Tints with your accent colour" },
];

/** Normalise a stored value (older rows / unknown ids fall back to `soft`). */
export function normalizeBannerOverlay(value: string | null | undefined): BannerOverlayId {
  return BANNER_OVERLAYS.some((option) => option.id === value)
    ? (value as BannerOverlayId)
    : "soft";
}

/** Layer styles for a banner overlay, or null when no overlay should render. */
export function bannerOverlayStyle(value: string | null | undefined): CSSProperties | null {
  const id = normalizeBannerOverlay(value);
  switch (id) {
    case "none":
      return null;
    case "soft":
      return { backgroundColor: "color-mix(in oklab, var(--background) 20%, transparent)" };
    case "strong":
      return { backgroundColor: "color-mix(in oklab, var(--background) 45%, transparent)" };
    case "scrim":
      return {
        backgroundImage:
          "linear-gradient(to top, color-mix(in oklab, var(--background) 78%, transparent) 0%, color-mix(in oklab, var(--background) 30%, transparent) 45%, transparent 100%)",
      };
    case "vignette":
      return {
        backgroundImage:
          "radial-gradient(120% 100% at 50% 50%, transparent 40%, color-mix(in oklab, var(--background) 70%, transparent) 100%)",
      };
    case "spotlight":
      return {
        backgroundImage:
          "radial-gradient(80% 70% at 50% 35%, color-mix(in oklab, var(--foreground) 10%, transparent) 0%, color-mix(in oklab, var(--background) 55%, transparent) 100%)",
      };
    case "duotone":
      return {
        backgroundImage:
          "linear-gradient(135deg, color-mix(in oklab, var(--user-accent, var(--primary)) 45%, transparent) 0%, color-mix(in oklab, var(--background) 60%, transparent) 100%)",
      };
  }
}

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

export type BackgroundGradient = {
  id: string;
  label: string;
  from: string;
  to: string;
};

/**
 * Curated two-colour gradients. Each end is mixed into the theme's own
 * background at the member's strength, so gradients tint rather than
 * overwhelm and text keeps its contrast in both light and dark mode.
 */
export const BACKGROUND_GRADIENTS: BackgroundGradient[] = [
  { id: "tethyr", label: "Tethyr", from: "#8250df", to: "#1a7f37" },
  { id: "dusk", label: "Dusk", from: "#a78bfa", to: "#f472b6" },
  { id: "ocean", label: "Ocean", from: "#38bdf8", to: "#2dd4bf" },
  { id: "sunset", label: "Sunset", from: "#fbbf24", to: "#fb7185" },
  { id: "forest", label: "Forest", from: "#4ade80", to: "#2dd4bf" },
  { id: "ember", label: "Ember", from: "#f97316", to: "#e11d48" },
  { id: "skyline", label: "Skyline", from: "#38bdf8", to: "#a78bfa" },
];

export const BACKGROUND_GRADIENT_IDS = BACKGROUND_GRADIENTS.map((g) => g.id);

/**
 * The CSS for a gradient backdrop at a given strength. Both ends are
 * color-mixed to transparent so the theme background shows through, which
 * keeps the result quiet at low strengths and bold at high ones.
 */
export function gradientBackgroundImage(
  gradient: BackgroundGradient | undefined,
  strength: number,
): string | null {
  if (!gradient) return null;
  return `linear-gradient(135deg, color-mix(in oklab, ${gradient.from} ${strength}%, transparent), color-mix(in oklab, ${gradient.to} ${strength}%, transparent))`;
}

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

/** Reset a background to the empty state (keeping the default strength). */
export function emptyBackground(): ProfileBackground {
  return {
    mode: null,
    color: null,
    pattern: null,
    gradient: null,
    image_url: null,
    strength: BACKGROUND_DEFAULT_STRENGTH,
    cardBorders: "neutral",
    accentMode: "dynamic",
    accentColor: null,
    density: "comfortable",
    bannerOverlay: "soft",
    bannerCaptionPosition: "right",
  };
}

export function hasAppearanceSettings(background: ProfileBackground | null | undefined): boolean {
  return (
    !!background &&
    (background.mode != null ||
      (background.cardBorders != null && background.cardBorders !== "neutral") ||
      (background.accentMode === "custom" && !!background.accentColor) ||
      background.density === "compact")
  );
}

/** Apply creator-selected accent, border, and density preferences as CSS variables. */
export function appearanceStyle(background: ProfileBackground | null | undefined): CSSProperties {
  if (!background) return {};
  const style = {} as CSSProperties & Record<string, string>;
  const cardBorders = background.cardBorders ?? "neutral";
  style["--card-border-color"] =
    cardBorders === "none"
      ? "transparent"
      : cardBorders === "neutral"
        ? "var(--border)"
        : "var(--user-accent-border, var(--border))";

  if (background.accentMode === "custom" && background.accentColor) {
    const foreground = contrastingHexForeground(background.accentColor);
    style["--user-accent"] = background.accentColor;
    style["--user-accent-foreground"] = foreground;
    style["--user-accent-subtle"] =
      `color-mix(in oklab, ${background.accentColor} 10%, transparent)`;
    style["--user-accent-border"] =
      `color-mix(in oklab, ${background.accentColor} 30%, transparent)`;
    style["--user-accent-glow"] = `color-mix(in oklab, ${background.accentColor} 6%, transparent)`;
  }

  if (background.density === "compact") {
    style["--content-density-gap"] = "0.75rem";
    style["--content-density-padding"] = "0.75rem";
  } else {
    style["--content-density-gap"] = "1rem";
    style["--content-density-padding"] = "1rem";
  }
  return style;
}

function contrastingHexForeground(hex: string): string {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return "var(--background)";
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.56 ? "#1f2328" : "#ffffff";
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
  const patternPct = Math.round(strength * 0.22);
  const base = background.color
    ? `color-mix(in oklab, ${background.color} ${strength}%, var(--background))`
    : "var(--background)";

  switch (background.mode) {
    case "color":
      return { backgroundColor: base };
    case "gradient": {
      const gradient = BACKGROUND_GRADIENTS.find((g) => g.id === background.gradient);
      const image = gradientBackgroundImage(gradient, strength);
      if (!image) return { backgroundColor: base };
      return {
        backgroundColor: "var(--background)",
        backgroundImage: image,
        backgroundSize: "cover",
      };
    }
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

/**
 * Signed URL for a background image. The `backgrounds` bucket is private, so
 * plain public URLs no longer resolve — resolve through a short-lived signed
 * URL instead (resolved against the PUBLIC SELECT policy on storage.objects).
 */
export async function backgroundImageSignedUrl(
  imageUrl: string | null | undefined,
): Promise<string | null> {
  if (!imageUrl) return null;
  const { data } = await supabase.storage
    .from("backgrounds")
    .createSignedUrl(imageUrl, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}
