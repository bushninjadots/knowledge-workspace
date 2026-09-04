// ── Studio Config ─────────────────────────────────────────────────────────────
// Five coherent decisions that drive the Studio's look-and-feel:
//   STRUCTURE  — how the Studio is arranged (single column, balanced, wide)
//   PERSONALITY — typography + visual character (editorial, modern, technical)
//   DENSITY    — spacing rhythm (compact, comfortable, spacious)
//   RADIUS     — corner treatment (sharp, soft)
//   ACCENT     — user identity colour (auto from banner, custom pick, none)
//
// Two outputs are produced:
//   • studioConfigToThemeTokens  → merged into the page's ThemeTokens so it
//     flows through the existing theme-token → CSS variable pipeline.
//   • studioConfigToStyle        → page-local custom properties (--user-accent-*
//     family, density gap, structure max-width, studio radius/gap/pad).
//
// Legacy fields (compositionId, vibeId, personalityId, typography) are accepted
// on read via normalizeStudioConfig and silently migrated. New writes never
// produce them.

import type { ThemeTokens } from "@/lib/page-blocks";

// ── Dimension Types ───────────────────────────────────────────────────────────

/** STRUCTURE — how the Studio is arranged. */
export type StructureId = "single" | "sidebar" | "wide";
/** PERSONALITY — typography + visual character. */
export type PersonalityId = "editorial" | "modern" | "technical";
export type DensityId = "compact" | "comfortable" | "spacious";
export type RadiusId = "sharp" | "soft";
/** ACCENT — user identity colour. */
export type AccentMode = "auto" | "custom" | "none";
/** BACKGROUND — app shell vs public Studio. */
export type BackgroundId = "default" | "surface" | "sunken";

export type StarterId = "focused" | "editorial" | "project-first" | "minimal" | "experimental";

// ── Legacy Types (accepted on read, never produced on write) ──────────────────

/** @deprecated Use StructureId instead. */
export type RadiusTreatment = RadiusId | "rounded";
/** @deprecated Use PersonalityId instead. */
export type TypographyTreatment = "editorial" | "modern" | "classic";
/** @deprecated Use DensityId instead. */
export type Density = DensityId;
/** @deprecated Use AccentMode instead (was "person", now "custom"). */

// ── Studio Config ─────────────────────────────────────────────────────────────

export interface StudioConfig {
  /** Active starter preset (null = custom arrangement). */
  starterId: StarterId | null;
  /** How the Studio is arranged. */
  structure: StructureId;
  /** Typography + visual character. */
  personality: PersonalityId;
  /** Spacing rhythm. */
  density: DensityId;
  /** Corner treatment. */
  radius: RadiusId;
  /** User identity colour mode. */
  accentMode: AccentMode;
  /** Accent hex colour (used when accentMode === "custom"). */
  accentColor: string;
  /** App shell background while editing. */
  appBackground: BackgroundId;
  /** Public Studio background. */
  publicBackground: BackgroundId;

  // ── Legacy fields (optional, accepted on read for backward compat) ────────
  /** @deprecated Use `structure` instead. */
  compositionId?: string | null;
  /** @deprecated Use `personality` instead. */
  vibeId?: string | null;
  /** @deprecated Removed. Use `personality` instead. */
  personalityId?: string | null;
  /** @deprecated Use `personality` instead (classic → technical). */
  typography?: TypographyTreatment;
}

export const DEFAULT_STUDIO_CONFIG: Readonly<StudioConfig> = {
  starterId: null,
  structure: "wide",
  personality: "modern",
  density: "comfortable",
  radius: "soft",
  accentMode: "auto",
  accentColor: "#3f8f8a",
  appBackground: "surface",
  publicBackground: "default",
};

// ── Option Catalogs ───────────────────────────────────────────────────────────

export const STRUCTURE_OPTIONS: ReadonlyArray<{ value: StructureId; label: string; hint: string }> =
  [
    { value: "single", label: "Column", hint: "One narrow column. Everything reads in order." },
    {
      value: "sidebar",
      label: "Balanced",
      hint: "A medium measure that lets blocks sit side by side.",
    },
    { value: "wide", label: "Wide", hint: "Full width — room for three columns of signals." },
  ];

export const PERSONALITY_OPTIONS: ReadonlyArray<{ value: PersonalityId; label: string }> = [
  { value: "editorial", label: "Editorial" },
  { value: "modern", label: "Modern" },
  { value: "technical", label: "Technical" },
];

export const DENSITY_OPTIONS: ReadonlyArray<{ value: DensityId; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

export const RADIUS_OPTIONS: ReadonlyArray<{ value: RadiusId; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
];

export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentMode; label: string }> = [
  { value: "auto", label: "From banner" },
  { value: "custom", label: "Pick" },
  { value: "none", label: "None" },
];

export const BACKGROUND_OPTIONS: ReadonlyArray<{ value: BackgroundId; label: string }> = [
  { value: "default", label: "Paper" },
  { value: "surface", label: "Surface" },
  { value: "sunken", label: "Sunken" },
];

const STRUCTURE_VALUES = new Set(STRUCTURE_OPTIONS.map((o) => o.value));
const PERSONALITY_VALUES = new Set(PERSONALITY_OPTIONS.map((o) => o.value));
const DENSITY_VALUES = new Set(DENSITY_OPTIONS.map((o) => o.value));
const RADIUS_VALUES = new Set(RADIUS_OPTIONS.map((o) => o.value));
const ACCENT_VALUES = new Set(ACCENT_OPTIONS.map((o) => o.value));
const BACKGROUND_VALUES = new Set(BACKGROUND_OPTIONS.map((o) => o.value));

const isOneOf =
  <T extends string>(allowed: Set<T>) =>
  (value: unknown): value is T =>
    typeof value === "string" && allowed.has(value as T);

/**
 * Map legacy personality/composition IDs to the new clean model.
 * Handles: compositionId → structure, vibeId/personalityId → personality,
 * typography "classic" → "technical", accentMode "person" → "custom",
 * radius "rounded" → "soft".
 */
function migrateLegacy(value: Record<string, unknown>): Partial<StudioConfig> {
  const patch: Partial<StudioConfig> = {};

  // Structure: read from compositionId if present
  if (typeof value.compositionId === "string" && value.compositionId.length > 0) {
    const v = value.compositionId;
    if (v === "single" || v === "sidebar" || v === "wide") {
      patch.structure = v;
    }
  }

  // Personality: read from vibeId, personalityId, or typography
  if (typeof value.vibeId === "string" && value.vibeId.length > 0) {
    const v = value.vibeId;
    if (v === "editorial" || v === "modern" || v === "technical") {
      patch.personality = v;
    }
  } else if (typeof value.personalityId === "string" && value.personalityId.length > 0) {
    const v = value.personalityId;
    if (v === "editorial" || v === "modern" || v === "technical") {
      patch.personality = v;
    }
  }
  // Typography "classic" → "technical" if no personality found yet
  if (!patch.personality && typeof value.typography === "string") {
    if (value.typography === "editorial") patch.personality = "editorial";
    else if (value.typography === "modern") patch.personality = "modern";
    else if (value.typography === "classic") patch.personality = "technical";
  }

  // Radius: "rounded" → "soft"
  if (value.radius === "rounded") {
    patch.radius = "soft";
  }

  // AccentMode: "person" → "custom"
  if (value.accentMode === "person") {
    patch.accentMode = "custom";
  }

  return patch;
}

/**
 * Defensively normalize an unknown JSON value (from the pages.config column)
 * into a full StudioConfig. Unknown/missing fields fall back to defaults so a
 * hand-edited or legacy row can never crash the renderer.
 */
export function normalizeStudioConfig(raw: unknown): StudioConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STUDIO_CONFIG };

  const value = raw as Record<string, unknown>;
  const legacy = migrateLegacy(value);

  return {
    starterId:
      typeof value.starterId === "string" && value.starterId.length > 0
        ? (value.starterId as StarterId)
        : null,
    structure:
      legacy.structure ??
      (isOneOf(STRUCTURE_VALUES)(value.structure)
        ? value.structure
        : DEFAULT_STUDIO_CONFIG.structure),
    personality:
      legacy.personality ??
      (isOneOf(PERSONALITY_VALUES)(value.personality)
        ? value.personality
        : DEFAULT_STUDIO_CONFIG.personality),
    density: isOneOf(DENSITY_VALUES)(value.density) ? value.density : DEFAULT_STUDIO_CONFIG.density,
    radius:
      legacy.radius ??
      (isOneOf(RADIUS_VALUES)(value.radius) ? value.radius : DEFAULT_STUDIO_CONFIG.radius),
    accentMode:
      legacy.accentMode ??
      (isOneOf(ACCENT_VALUES)(value.accentMode)
        ? value.accentMode
        : DEFAULT_STUDIO_CONFIG.accentMode),
    accentColor:
      typeof value.accentColor === "string" && /^#([0-9a-f]{6})$/i.test(value.accentColor)
        ? value.accentColor
        : DEFAULT_STUDIO_CONFIG.accentColor,
    appBackground: isOneOf(BACKGROUND_VALUES)(value.appBackground)
      ? value.appBackground
      : DEFAULT_STUDIO_CONFIG.appBackground,
    publicBackground: isOneOf(BACKGROUND_VALUES)(value.publicBackground)
      ? value.publicBackground
      : DEFAULT_STUDIO_CONFIG.publicBackground,
  };
}

// ── Structure → Canvas Width ──────────────────────────────────────────────────

/**
 * Max content width (px) for each structure mode. Kept under the site-wide
 * max-w-7xl (1280px) cap so the builder fits alongside the rest of Tethyr's
 * fixed chrome (inspector rail + customize panel).
 */
export function structureMaxWidth(config: StudioConfig): number {
  if (config.structure === "single") return 768;
  if (config.structure === "sidebar") return 1024;
  return 1200;
}

// ── Density → Spacing Metrics ─────────────────────────────────────────────────

interface DensityMetrics {
  gap: number;
  pad: number;
  rowHeight: number;
}

const DENSITY_METRICS: Record<DensityId, DensityMetrics> = {
  compact: { gap: 10, pad: 12, rowHeight: 20 },
  comfortable: { gap: 14, pad: 16, rowHeight: 24 },
  spacious: { gap: 20, pad: 22, rowHeight: 28 },
};

export function densityMetrics(density: DensityId): DensityMetrics {
  return DENSITY_METRICS[density];
}

// ── Treatment → Theme Tokens ──────────────────────────────────────────────────

const RADIUS_SCALE: Record<RadiusId, Record<string, string>> = {
  sharp: { sm: "1px", md: "2px", lg: "3px", xl: "4px", "2xl": "4px", "3xl": "5px", "4xl": "6px" },
  soft: { sm: "2px", md: "3px", lg: "4px", xl: "5px", "2xl": "5px", "3xl": "6px", "4xl": "8px" },
};

export const EDITORIAL_HEADING_FONT = "Space Grotesk, ui-sans-serif, system-ui, sans-serif";

const DENSITY_SECTION: Record<DensityId, string> = {
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

  if (config.personality === "editorial") {
    tokens.typography = {
      headingFont: EDITORIAL_HEADING_FONT,
      scale: {
        heading1: { fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: "1.05", fontWeight: "600" },
      },
    };
  } else if (config.personality === "technical") {
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
 * density gutters, studio radius/gap/pad, structure max-width, and the
 * `--user-accent-*` family (used by rings, borders, active states, and
 * selection across the whole studio).
 */
export function studioConfigToStyle(config: StudioConfig): React.CSSProperties {
  const style = {} as React.CSSProperties & Record<string, string>;

  const { gap, pad } = densityMetrics(config.density);

  // Density
  const densityGap =
    config.density === "compact" ? "0.75rem" : config.density === "spacious" ? "1.5rem" : "1rem";
  style["--content-density-gap"] = densityGap;
  style["--content-density-padding"] = densityGap;

  // Studio-specific tokens (used by g-studio-surface)
  style["--studio-radius"] = config.radius === "sharp" ? "2px" : "5px";
  style["--studio-gap"] = `${gap}px`;
  style["--studio-pad"] = `${pad}px`;

  // Accent
  if (config.accentMode === "custom" && config.accentColor) {
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
