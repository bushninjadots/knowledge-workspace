// ── Studio Config ─────────────────────────────────────────────────────────────
// Five coherent decisions that drive the Studio's look-and-feel:
//   STRUCTURE  — how the Studio is arranged (single column, balanced, wide)
//   PERSONALITY — heading scale + visual character (editorial, modern, technical)
//   DENSITY    — spacing rhythm (compact, comfortable, spacious)
//   RADIUS     — corner roundness in pixels (0–24, exposed as a slider)
//   ACCENT     — user identity colour (pick, banner + pick, none)
//
// Two outputs are produced:
//   • studioConfigToThemeTokens  → merged into the page's ThemeTokens so it
//     flows through the existing theme-token → CSS variable pipeline.
//   • studioConfigToStyle (studio-config-style.ts) → page-local custom
//     properties (--user-accent-* family, density gap, structure max-width,
//     studio radius/gap/pad, and the Studio-owned --card-border-width). Card
//     border *colour* is the member's appearance (ProfileBackground.cardBorders),
//     not a Studio decision.
//
// A block's own frame (shape, inset, fill, border) is studio-block-frame.ts.
//
// Typeface is the only font control. Heading/body faces are optional ids from
// src/lib/fonts.ts; unset means "the theme's own face". Personality no longer
// implies a face at render time: choosing one writes its paired heading face
// into `headingFont` (personalityPatch), which the member can then change.
// Configs saved before that split (no `fontModel`) are migrated on read by
// giving them the face their personality used to imply, so they render as
// they always did.
//
// Legacy fields (compositionId, vibeId, personalityId, typography) are accepted
// on read via normalizeStudioConfig and silently migrated. New writes never
// produce them.

import type { ThemeTokens } from "@/lib/page-blocks";
import { fontStack, isFontId, type FontId } from "@/lib/fonts";
import {
  atmosphereColors,
  normalizeLook,
  resolveLook,
  typePairing,
  visualLanguage,
  type Look,
  type VisualLanguageId,
} from "@/lib/visual-language";

// ── Dimension Types ───────────────────────────────────────────────────────────

/** STRUCTURE — how the Studio is arranged. */
export type StructureId = "single" | "sidebar" | "wide" | "full";
/** PERSONALITY — typography + visual character. */
export type PersonalityId = "editorial" | "modern" | "technical";
export type DensityId = "compact" | "comfortable" | "spacious";
/** ACCENT — user identity colour. "dual" pairs a picked primary with the
 *  banner-derived colour as the secondary tone (interactive vs background).
 *  "auto" (legacy) migrated to "dual" on read. */
export type AccentMode = "custom" | "dual" | "none";
/** BACKGROUND — app shell vs public Studio. */
export type BackgroundId = "default" | "surface" | "sunken";
/** How every block's title is set: a small uppercase label, a sentence-case
 *  heading in the heading face, or hidden (kept for screen readers). */
export type BlockTitleStyle = "label" | "heading" | "hidden";
export type ShadowStyle = "none" | "soft" | "lifted";

/** Shadow presets shared by the Studio-wide card shadow and per-block shadow. */
export const SHADOWS: Record<ShadowStyle, string> = {
  none: "none",
  soft: "0 1px 2px rgb(0 0 0 / 0.05), 0 4px 14px rgb(0 0 0 / 0.07)",
  lifted: "0 2px 4px rgb(0 0 0 / 0.06), 0 14px 36px rgb(0 0 0 / 0.14)",
};
type CardBorderWidth = "thin" | "medium" | "thick";

/** Layout templates (src/data/starters.ts). */
export type StarterId =
  | "editorial"
  | "magazine"
  | "journal"
  | "portfolio"
  | "gallery"
  | "split"
  | "technical"
  | "archive"
  | "linear"
  | "statement"
  | "collage"
  | "open"
  | "for-hire";

const STARTER_IDS = new Set<StarterId>([
  "editorial",
  "magazine",
  "journal",
  "portfolio",
  "gallery",
  "split",
  "technical",
  "archive",
  "linear",
  "statement",
  "collage",
  "open",
  "for-hire",
]);

/** Layouts from before compositions, read as their nearest successor. */
const LEGACY_STARTERS: Record<string, StarterId> = {
  focused: "linear",
  "project-first": "portfolio",
  minimal: "linear",
  experimental: "collage",
};

// ── Radius range & defaults ────────────────────────────────────────────────────

/** Slider bounds for corner roundness, in px. */
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 24;
/** Legacy "soft" treatment is the default. */
const DEFAULT_RADIUS = 12;

/**
 * Normalize a stored radius value to a px number. Numeric values are clamped to
 * the 0–24 range; legacy string treatments migrate to their closest px values
 * ("sharp" 6px, "soft"/"rounded" the default).
 */
function normalizeRadius(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, Math.round(raw)));
  }
  if (typeof raw === "string") {
    if (raw === "sharp") return 6;
    if (raw === "soft" || raw === "rounded") return DEFAULT_RADIUS;
  }
  return DEFAULT_RADIUS;
}

// ── Legacy Types (accepted on read, never produced on write) ──────────────────

/** @deprecated Use the px radius number on StudioConfig instead. */
export type RadiusTreatment = "sharp" | "soft" | "rounded";
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
  /** Heading scale + visual character. Sets no face by itself. */
  personality: PersonalityId;
  /** Heading typeface id from FONT_OPTIONS. Unset = the theme's own face. */
  headingFont?: FontId | null;
  /** Body typeface id from FONT_OPTIONS. Unset = the theme's own face. */
  bodyFont?: FontId | null;
  /** 2 = headingFont is authoritative. Absent on configs saved while the
   *  personality still implied a face; normalizeStudioConfig migrates those. */
  fontModel?: 2;
  /** Spacing rhythm. */
  density: DensityId;
  /** Corner roundness in px (0 = sharp, 24 = very soft). */
  radius: number;
  /** User identity colour mode. */
  accentMode: AccentMode;
  /** Accent hex colour (used when accentMode === "custom"). */
  accentColor: string;
  /** Border weight shared by cards and panels. (Colour is owned by the member's
   *  appearance — see ProfileBackground.cardBorders.) */
  cardBorderWidth?: CardBorderWidth;
  /** Card/block fill colour (hex). Empty = follow the page's elevated surface. */
  cardColor?: string;
  /** Card/block fill opacity, 0–100. Lower values let the backdrop show through,
   * the way Dashboard panels do. */
  cardOpacity?: number;
  /** Treatment of block titles across the Studio. Unset = "label". */
  blockTitles?: BlockTitleStyle;
  /** Shadow under every block. Unset = "none". */
  cardShadow?: ShadowStyle;
  /** Legacy motion switch ("rise" = Reveal); Motion now lives in `look`. */
  motion?: "none" | "rise";
  /** Light/dark for visitors: "visitor" (default) follows each visitor's
   *  setting; "theme" always shows the profile's theme in its own mode. */
  colorMode?: "visitor" | "theme";
  /** The chosen visual direction; unset = Original (see visual-language.ts). */
  visualLanguage?: VisualLanguageId | null;
  /** The member's own page-wide visual choices, over the direction's. */
  look?: Partial<Look>;
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
  fontModel: 2,
  density: "comfortable",
  radius: DEFAULT_RADIUS,
  accentMode: "custom",
  accentColor: "#3f8f8a",
  cardBorderWidth: "thin",
  cardColor: "",
  cardOpacity: 30,
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
    { value: "wide", label: "Wide", hint: "Room for three columns of signals." },
    { value: "full", label: "Full", hint: "Edge to edge on large screens, for image-led pages." },
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

export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentMode; label: string }> = [
  { value: "custom", label: "Pick" },
  { value: "dual", label: "Colour + banner tint" },
  { value: "none", label: "None" },
];

export const BACKGROUND_OPTIONS: ReadonlyArray<{ value: BackgroundId; label: string }> = [
  { value: "default", label: "Paper" },
  { value: "surface", label: "Surface" },
  { value: "sunken", label: "Sunken" },
];

const STRUCTURE_VALUES = new Set(STRUCTURE_OPTIONS.map((o) => o.value));
const PERSONALITY_VALUES = new Set(PERSONALITY_OPTIONS.map((o) => o.value));
const BLOCK_TITLE_VALUES = new Set<BlockTitleStyle>(["label", "heading", "hidden"]);
const SHADOW_VALUES = new Set<ShadowStyle>(["none", "soft", "lifted"]);
const DENSITY_VALUES = new Set(DENSITY_OPTIONS.map((o) => o.value));
const ACCENT_VALUES = new Set(ACCENT_OPTIONS.map((o) => o.value));
const BACKGROUND_VALUES = new Set(BACKGROUND_OPTIONS.map((o) => o.value));
const CARD_BORDER_WIDTH_VALUES = new Set<CardBorderWidth>(["thin", "medium", "thick"]);

const isOneOf =
  <T extends string>(allowed: Set<T>) =>
  (value: unknown): value is T =>
    typeof value === "string" && allowed.has(value as T);

/**
 * Map legacy personality/composition IDs to the new clean model.
 * Handles: compositionId → structure, vibeId/personalityId → personality,
 * typography "classic" → "technical", accentMode "person" → "custom".
 * Radius string treatments are normalized separately by normalizeRadius().
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

  // AccentMode: "person" → "custom"
  if (value.accentMode === "person") {
    patch.accentMode = "custom";
  }
  // AccentMode: "auto" → "dual" (banner + picked colour replaced the old
  // banner-only option; "dual" with the default accent still reads banner-led
  // while keeping a defined interactive accent).
  if (value.accentMode === "auto") {
    patch.accentMode = "dual";
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
  const personality =
    legacy.personality ??
    (isOneOf(PERSONALITY_VALUES)(value.personality)
      ? value.personality
      : DEFAULT_STUDIO_CONFIG.personality);

  return {
    starterId:
      typeof value.starterId === "string"
        ? STARTER_IDS.has(value.starterId as StarterId)
          ? (value.starterId as StarterId)
          : (LEGACY_STARTERS[value.starterId] ?? null)
        : null,
    structure:
      legacy.structure ??
      (isOneOf(STRUCTURE_VALUES)(value.structure)
        ? value.structure
        : DEFAULT_STUDIO_CONFIG.structure),
    personality,
    headingFont: isFontId(value.headingFont)
      ? value.headingFont
      : value.fontModel === 2
        ? undefined
        : (PERSONALITY_HEADING_FONT[personality] ?? undefined),
    bodyFont: isFontId(value.bodyFont) ? value.bodyFont : undefined,
    fontModel: 2,
    density: isOneOf(DENSITY_VALUES)(value.density) ? value.density : DEFAULT_STUDIO_CONFIG.density,
    radius: normalizeRadius(value.radius),
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
    cardBorderWidth: isOneOf(CARD_BORDER_WIDTH_VALUES)(value.cardBorderWidth)
      ? value.cardBorderWidth
      : DEFAULT_STUDIO_CONFIG.cardBorderWidth,
    cardColor:
      typeof value.cardColor === "string" && /^#([0-9a-f]{6})$/i.test(value.cardColor)
        ? value.cardColor
        : DEFAULT_STUDIO_CONFIG.cardColor,
    blockTitles: isOneOf(BLOCK_TITLE_VALUES)(value.blockTitles) ? value.blockTitles : undefined,
    cardShadow: isOneOf(SHADOW_VALUES)(value.cardShadow) ? value.cardShadow : undefined,
    motion: value.motion === "rise" ? "rise" : undefined,
    colorMode: value.colorMode === "theme" ? "theme" : undefined,
    visualLanguage: visualLanguage(value.visualLanguage as string | undefined)?.id ?? null,
    look: normalizeLook(value.look),
    cardOpacity:
      typeof value.cardOpacity === "number" &&
      Number.isFinite(value.cardOpacity) &&
      value.cardOpacity >= 0 &&
      value.cardOpacity <= 100
        ? Math.round(value.cardOpacity)
        : DEFAULT_STUDIO_CONFIG.cardOpacity,
  };
}

// ── Structure → Canvas Width ──────────────────────────────────────────────────

/**
 * Width for each structure mode, as a CSS length: the smaller of the option's
 * pixel ceiling and a fraction of the available canvas. The fractions are
 * strictly ordered (82% < 90% < 100%) and each pixel ceiling only bites where
 * its fraction has already grown past it, so the three options render at three
 * different widths at EVERY canvas size — the previous fixed caps (768/1024/
 * 1200) exceeded the ~944px canvas a 1440×900 laptop leaves after app nav +
 * builder chrome, which rendered Balanced and Wide identically and made two
 * thirds of the setting look dead. Used by the editor, whose canvas is what
 * remains after the builder chrome; full-width surfaces (owner view, published
 * page) use the numeric `structureMaxWidth` instead.
 */
export function structureMaxWidthCss(config: StudioConfig): string {
  if (config.structure === "single") return "min(768px, 82%)";
  if (config.structure === "sidebar") return "min(1024px, 90%)";
  if (config.structure === "full") return "100%";
  return "min(1200px, 100%)";
}

/**
 * Numeric cap (px) for each structure mode on surfaces that size themselves
 * from a measured container rather than CSS. Distinguishability comes from
 * `structureMaxWidthCss`; this mirrors its ceilings for those callers.
 */
export function structureMaxWidth(config: StudioConfig): number {
  if (config.structure === "single") return 768;
  if (config.structure === "sidebar") return 1024;
  if (config.structure === "full") return 1600;
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

/** The app's base radius scale (styles.css @theme), in px. */
const BASE_RADII: Record<string, number> = {
  sm: 2,
  md: 3,
  lg: 4,
  xl: 5,
  "2xl": 5,
  "3xl": 6,
  "4xl": 8,
};

/**
 * The --radius-* scale inside a Studio, from its corner slider: the app's own
 * scale at the default (12px), squarer below it, rounder above. These reach
 * every `rounded-*` element in the Studio's blocks (chips, buttons, images),
 * while the block frames themselves use the slider value directly
 * (--studio-radius) — so a Studio's small parts stay in proportion to its
 * cards and existing Studios at the default look exactly as before.
 */
function radiusScale(radius: number): Record<string, string> {
  const factor = normalizeRadius(radius) / DEFAULT_RADIUS;
  return Object.fromEntries(
    Object.entries(BASE_RADII).map(([key, px]) => [key, `${Math.round(px * factor * 10) / 10}px`]),
  );
}

/** The heading face each personality pairs with. Modern has none: it keeps
 *  the theme's own face. */
export const PERSONALITY_HEADING_FONT: Readonly<Record<PersonalityId, FontId | null>> = {
  editorial: "space-grotesk",
  modern: null,
  technical: "jetbrains-mono",
};

/** The config patch for choosing a personality: its heading scale plus its
 *  paired heading face, written into Typeface where the member can change it. */
export function personalityPatch(
  personality: PersonalityId,
): Pick<StudioConfig, "personality" | "headingFont" | "fontModel"> {
  return { personality, headingFont: PERSONALITY_HEADING_FONT[personality], fontModel: 2 };
}

const DENSITY_SECTION: Record<DensityId, string> = {
  compact: "2.5rem",
  comfortable: "4rem",
  spacious: "6rem",
};

/**
 * The display face a config resolves to: the chosen heading typeface, or null
 * to keep whatever the theme sets. Shared by the theme tokens and the Studio
 * surface style so a canvas and the published page can never render different
 * faces. Callers pass a normalized config, so pre-split saves already carry
 * the face their personality implied.
 */
export function resolvedHeadingFont(config: StudioConfig): string | null {
  return (
    fontStack(config.headingFont) ?? fontStack(typePairing(resolveLook(config).typePairing).heading)
  );
}

/** The body face: a hand-picked one, else the type pairing's. */
export function resolvedBodyFont(config: StudioConfig): string | null {
  return fontStack(config.bodyFont) ?? fontStack(typePairing(resolveLook(config).typePairing).body);
}

/**
 * Translate the config's visual treatments into ThemeTokens that can be
 * deep-merged over the page theme. This keeps radius, typography, and section
 * rhythm in the same pipeline as every other theme token.
 *
 * The personality supplies the heading scale; the chosen heading face drives
 * the display face and a chosen body face drives --font-sans. A modern Studio
 * that chooses no face leaves typography untouched.
 */
export function studioConfigToThemeTokens(config: StudioConfig): ThemeTokens {
  const tokens: ThemeTokens = {
    borders: { radius: radiusScale(config.radius) },
    spacing: { section: DENSITY_SECTION[config.density] },
  };

  // Type size and hierarchy come from the look's type scale (data-vl-scale
  // in styles.css); the personality's old heading1 tokens were never read.
  const headingFont = resolvedHeadingFont(config);
  const bodyFont = resolvedBodyFont(config);
  if (headingFont || bodyFont) {
    tokens.typography = {
      ...(headingFont ? { headingFont } : {}),
      ...(bodyFont ? { bodyFont } : {}),
    };
  }

  // Colour atmosphere: a canvas palette through the same theme pipeline.
  const colors = atmosphereColors(
    resolveLook(config).atmosphere,
    config.accentMode === "none" ? null : config.accentColor,
  );
  if (colors) tokens.colors = colors;

  return tokens;
}
