// ── Studio Config ─────────────────────────────────────────────────────────────
// The StudioConfig JSON stored on each page row drives the look-and-feel of a
// studio: corner radius, typography mood, spacing density, and the accent color
// (auto = derived from the active theme, person = the owner's chosen hue,
// none = neutral primary).
//
// Two outputs are produced:
//   • studioConfigToThemeTokens  → merged into the page's ThemeTokens so it
//     flows through the existing theme-token → CSS variable pipeline.
//   • studioConfigToStyle        → something like `--content-density-*` and the
//     `--user-accent-*` family, which are page-local custom properties set
//     directly on the page container.
//
// A personality preset (see studio-personalities.ts) stamps an initial
// StudioConfig + layout; manual edits afterward just tweak this config.

import type { ThemeTokens } from "@/lib/page-blocks";

// ── Treatment Types ───────────────────────────────────────────────────────────

export type RadiusTreatment = "sharp" | "soft" | "rounded";
export type TypographyTreatment = "editorial" | "modern" | "classic";
export type Density = "compact" | "comfortable" | "spacious";
export type AccentMode = "auto" | "person" | "none";

export interface StudioConfig {
  /** Selected page structure preset (null = custom arrangement). */
  compositionId: string | null;
  /** Selected visual-tone preset (null = custom visual treatment). */
  vibeId: string | null;
  /** Legacy combined preset id, retained for backwards-compatible writes/reads. */
  personalityId: string | null;
  radius: RadiusTreatment;
  typography: TypographyTreatment;
  density: Density;
  accentMode: AccentMode;
  /** Personal accent color (only used when accentMode === "person"). */
  accentColor: string | null;
}

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  compositionId: null,
  vibeId: null,
  personalityId: null,
  radius: "soft",
  typography: "modern",
  density: "comfortable",
  accentMode: "auto",
  accentColor: null,
};

// ── Option Catalogs ───────────────────────────────────────────────────────────
// Shared by the appearance picker controls and the normalization guards.

export const RADIUS_OPTIONS: ReadonlyArray<{ value: RadiusTreatment; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
  { value: "rounded", label: "Rounded" },
];

export const TYPOGRAPHY_OPTIONS: ReadonlyArray<{ value: TypographyTreatment; label: string }> = [
  { value: "editorial", label: "Editorial" },
  { value: "modern", label: "Modern" },
  { value: "classic", label: "Classic" },
];

export const DENSITY_OPTIONS: ReadonlyArray<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "person", label: "Choose" },
  { value: "none", label: "None" },
];

const RADIUS_VALUES = new Set(RADIUS_OPTIONS.map((o) => o.value));
const TYPOGRAPHY_VALUES = new Set(TYPOGRAPHY_OPTIONS.map((o) => o.value));
const DENSITY_VALUES = new Set(DENSITY_OPTIONS.map((o) => o.value));
const ACCENT_VALUES = new Set(ACCENT_OPTIONS.map((o) => o.value));

const isOneOf =
  <T extends string>(allowed: Set<T>) =>
  (value: unknown): value is T =>
    typeof value === "string" && allowed.has(value as T);

/**
 * Defensively normalize an unknown JSON value (from the pages.config column)
 * into a full StudioConfig. Unknown/missing fields fall back to defaults so a
 * hand-edited or legacy row can never crash the renderer.
 */
export function normalizeStudioConfig(raw: unknown): StudioConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STUDIO_CONFIG };

  const value = raw as Record<string, unknown>;
  const legacyId =
    typeof value.personalityId === "string" && value.personalityId.length > 0
      ? value.personalityId
      : null;
  const compositionId =
    typeof value.compositionId === "string" && value.compositionId.length > 0
      ? value.compositionId
      : legacyId;
  const vibeId =
    typeof value.vibeId === "string" && value.vibeId.length > 0 ? value.vibeId : legacyId;

  return {
    compositionId,
    vibeId,
    // Kept populated for old consumers, but new UI reads the independent ids.
    personalityId: legacyId,
    radius: isOneOf(RADIUS_VALUES)(value.radius) ? value.radius : DEFAULT_STUDIO_CONFIG.radius,
    typography: isOneOf(TYPOGRAPHY_VALUES)(value.typography)
      ? value.typography
      : DEFAULT_STUDIO_CONFIG.typography,
    density: isOneOf(DENSITY_VALUES)(value.density) ? value.density : DEFAULT_STUDIO_CONFIG.density,
    accentMode: isOneOf(ACCENT_VALUES)(value.accentMode)
      ? value.accentMode
      : DEFAULT_STUDIO_CONFIG.accentMode,
    accentColor:
      typeof value.accentColor === "string" && /^#([0-9a-f]{6})$/i.test(value.accentColor)
        ? value.accentColor
        : null,
  };
}

// ── Treatment → Theme Tokens ──────────────────────────────────────────────────

const RADIUS_SCALE: Record<RadiusTreatment, Record<string, string>> = {
  sharp: { sm: "1px", md: "2px", lg: "3px", xl: "4px", "2xl": "4px", "3xl": "5px", "4xl": "6px" },
  soft: { sm: "2px", md: "3px", lg: "4px", xl: "5px", "2xl": "5px", "3xl": "6px", "4xl": "8px" },
  rounded: {
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    "2xl": "14px",
    "3xl": "16px",
    "4xl": "18px",
  },
};

const EDITORIAL_HEADING_FONT = "Space Grotesk, ui-sans-serif, system-ui, sans-serif";

const DENSITY_SECTION: Record<Density, string> = {
  compact: "2.5rem",
  comfortable: "4rem",
  spacious: "6rem",
};

/**
 * Translate the config's visual treatments into ThemeTokens that can be
 * deep-merged over the page theme. This keeps radius, typography, and section
 * rhythm in the same pipeline as every other theme token.
 */
export function studioConfigToThemeTokens(config: StudioConfig): ThemeTokens {
  const tokens: ThemeTokens = {
    borders: { radius: { ...RADIUS_SCALE[config.radius] } },
    spacing: { section: DENSITY_SECTION[config.density] },
  };

  if (config.typography === "editorial") {
    tokens.typography = {
      headingFont: EDITORIAL_HEADING_FONT,
      scale: {
        heading1: { fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: "1.05", fontWeight: "600" },
      },
    };
  } else if (config.typography === "classic") {
    tokens.typography = {
      scale: {
        heading1: {
          fontSize: "clamp(1.875rem, 3.5vw, 2.5rem)",
          lineHeight: "1.15",
          fontWeight: "500",
        },
      },
    };
  }

  return tokens;
}

// ── Config → Page-Level CSS Variables ─────────────────────────────────────────

/**
 * Emit the page-local custom properties that don't fit the token pipeline:
 * density gutters and the `--user-accent-*` family (used by rings, borders,
 * active states, and selection across the whole studio).
 */
export function studioConfigToStyle(config: StudioConfig): React.CSSProperties {
  const style = {} as React.CSSProperties & Record<string, string>;

  const densityGap =
    config.density === "compact" ? "0.75rem" : config.density === "spacious" ? "1.5rem" : "1rem";
  style["--content-density-gap"] = densityGap;
  style["--content-density-padding"] = densityGap;

  if (config.accentMode === "person" && config.accentColor) {
    const foreground = contrastingHexForeground(config.accentColor);
    style["--user-accent"] = config.accentColor;
    style["--user-accent-foreground"] = foreground;
    style["--user-accent-subtle"] = `color-mix(in oklab, ${config.accentColor} 10%, transparent)`;
    style["--user-accent-border"] = `color-mix(in oklab, ${config.accentColor} 30%, transparent)`;
    style["--user-accent-glow"] = `color-mix(in oklab, ${config.accentColor} 6%, transparent)`;
  } else {
    // Accent "none" AND "auto" both resolve to the page primary so the
    // --user-accent-* family always has a defined value (no dangling var()).
    style["--user-accent"] = "var(--primary)";
    style["--user-accent-foreground"] = "var(--primary-foreground)";
    style["--user-accent-subtle"] = "color-mix(in oklab, var(--primary) 10%, transparent)";
    style["--user-accent-border"] = "color-mix(in oklab, var(--primary) 30%, transparent)";
    style["--user-accent-glow"] = "color-mix(in oklab, var(--primary) 6%, transparent)";
  }

  return style;
}

/**
 * Pick a readable foreground for the accent color (dark text on light colors,
 * white on dark colors). Mirrors the private helper in background-themes.ts.
 */
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
