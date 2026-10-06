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
//   • studioConfigToStyle        → page-local custom properties (--user-accent-*
//     family, density gap, structure max-width, studio radius/gap/pad, and the
//     Studio-owned --card-border-width). Card border *colour* is the member's
//     appearance (ProfileBackground.cardBorders), not a Studio decision.
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

import type { BlockShape, LayoutBlockInstance, ThemeTokens } from "@/lib/page-blocks";
import { fontStack, isFontId, type FontId } from "@/lib/fonts";
import {
  MOTION_ANIMATION,
  atmosphereColors,
  normalizeLook,
  resolveLook,
  resolveTitles,
  surfaceShadow,
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

// ── Per-block frame ───────────────────────────────────────────────────────────

/** Per-block frame border choice. Default follows the member's card-border
 *  appearance; "frame" forces the border on, "none" removes it. */
/** A block's own outline: "default" follows the page's Borders setting;
 *  "frame" is a solid outline. */
export type BlockFrameBorder = "default" | "frame" | "none" | "dashed" | "dotted" | "double";

/** Inner-spacing bounds for the per-block frame, in px. */
export const BLOCK_INSET_MIN = 0;
export const BLOCK_INSET_MAX = 40;
/** The frame's default inset — must match the CSS fallback in
 *  `.studio-block` (`--studio-block-inset`, 1rem) so "default" is a no-op. */
export const BLOCK_INSET_DEFAULT_PX = 16;

/** Per-block radius slider bounds, in px. */
export const BLOCK_RADIUS_MIN = 0;
export const BLOCK_RADIUS_MAX = 48;

/** Shape preset → CSS border-radius value. Percentage-based shapes adapt to
 *  the block's aspect ratio so they look right at any content size. */
const SHAPE_RADIUS: Record<Exclude<BlockShape, "default">, string> = {
  square: "0px",
  rounded: "var(--studio-block-radius, 8px)",
  soft: "var(--studio-block-radius, 20px)",
  pill: "9999px",
  organic: "42% 58% 58% 42% / 42% 42% 58% 58%",
  blob: "63% 37% 30% 70% / 60% 30% 70% 40%",
  leaf: "0 50% 50% 0",
};

/**
 * A block's own fill. Resolved on the block itself (inline custom properties
 * outrank the card-ink rule), and a picked colour brings a readable ink so a
 * dark fill on a light Studio never leaves dark text on it.
 */
export function blockFillVars(fill: string | undefined): Record<string, string> {
  if (!fill) return {};
  // Transparent: the block sits on the page, so it takes the page's ink, not
  // the card ink a dark card fill would give it (light text on a light page).
  if (fill === "none")
    return {
      "--studio-block-bg": "transparent",
      // No surface, so no shadow outlining an invisible card (a block-level
      // shadow choice still wins: it is applied after this).
      "--studio-block-shadow": "none",
      "--foreground": "inherit",
      "--muted-foreground": "inherit",
      "--muted-foreground-subtle": "inherit",
      "--border": "inherit",
      color: "inherit",
    };
  if (fill === "tint")
    return { "--studio-block-bg": "color-mix(in oklab, var(--foreground) 5%, var(--surface))" };
  if (fill === "gradient")
    return {
      "--studio-block-bg":
        "linear-gradient(135deg, color-mix(in oklab, var(--user-accent, var(--primary)) 28%, var(--surface)), var(--surface) 75%)",
    };
  if (fill === "accent")
    return {
      "--studio-block-bg":
        "color-mix(in oklab, var(--user-accent, var(--primary)) 14%, var(--surface))",
    };
  const hex = /^#([0-9a-f]{6})$/i.exec(fill);
  if (!hex) return {};
  const n = parseInt(hex[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  const light = luminance > 0.4;
  return {
    "--studio-block-bg": fill,
    "--foreground": light ? "#111827" : "#f8fafc",
    "--muted-foreground": light ? "#4b5563" : "#cbd5e1",
    "--muted-foreground-subtle": light ? "#4b5563" : "#cbd5e1",
    "--border": light ? "rgb(17 24 39 / 0.14)" : "rgb(248 250 252 / 0.18)",
    color: light ? "#111827" : "#f8fafc",
  };
}

/**
 * Extra room each shape needs so content stays inside its curves (added to
 * the block's own inset). Horizontal values in % follow the frame's width —
 * percentage padding is width-relative, which is exactly how these radii
 * scale. A rounded corner's safe point sits ~29% of the radius in from each
 * edge, so curvier shapes push content further in, on the sides that curve.
 * Order: top right bottom left.
 */
const SHAPE_PADDING: Partial<Record<BlockShape, [string, string, string, string]>> = {
  pill: ["0.5rem", "max(1.25rem, 4%)", "0.5rem", "max(1.25rem, 4%)"],
  // Tall, narrow frames (phones, sidebars) curve deeper, so the top and
  // bottom also grow with the width.
  organic: ["max(2rem, 12%)", "12%", "max(2rem, 12%)", "13%"],
  blob: ["max(2.5rem, 13%)", "12%", "max(2.5rem, 14%)", "14%"],
  leaf: ["0.25rem", "16%", "0.25rem", "0px"],
};

/** The padding shorthand for a shaped frame, or null for plain corners. */
export function shapePadding(shape: BlockShape | undefined): string | null {
  const extra = shape ? SHAPE_PADDING[shape] : undefined;
  if (!extra) return null;
  return extra.map((side) => `calc(var(--studio-block-inset, 1rem) + ${side})`).join(" ");
}

/**
 * Per-block frame style from the block instance's optional `frame` fields:
 * `border` (default/frame/none) and `inset` (px). Returns CSS custom
 * properties scoped to this block; the shared `.studio-block` utility
 * consumes them, so the editor canvas, the owner Studio view, and the public
 * page all render the identical frame. Blocks without overrides get `{}` —
 * exactly the global look.
 */
export function blockFrameStyle(
  block: Pick<
    LayoutBlockInstance,
    | "frameBorder"
    | "frameInset"
    | "frameShape"
    | "frameRadius"
    | "frameFill"
    | "frameShadow"
    | "frameAlign"
    | "titleStyle"
  >,
): React.CSSProperties {
  const style = {} as React.CSSProperties & Record<string, string>;
  // Outline overrides set the --sb-border-* longhands `.studio-block` reads
  // before the page's Borders setting (--vl-border-*), and switch off the
  // page-wide corner marks so the block's own outline is the only one.
  const border = block.frameBorder;
  if (border === "none") {
    style["--sb-border-style"] = "none";
    style["--sb-corners"] = "none";
  } else if (border && border !== "default") {
    // An explicit outline paints the member's own card-border colour (the
    // --card-border-force-color set by appearanceStyle) so it can never
    // disagree with the Card borders setting — including its weight. With
    // the global choice set to "none" that variable falls back to the theme
    // rule, because the block explicitly asked for an outline.
    style["--sb-border-style"] = border === "frame" ? "solid" : border;
    style["--sb-border-width"] = border === "double" ? "3px" : "var(--card-border-width, 1px)";
    style["--sb-border-color"] = "var(--card-border-force-color, var(--border))";
    style["--sb-corners"] = "none";
  }
  const inset = block.frameInset;
  if (typeof inset === "number" && Number.isFinite(inset)) {
    style["--studio-block-inset"] = `${Math.round(inset)}px`;
  }
  // Per-block shape: emit the shape's border-radius so the `.studio-block`
  // utility can consume it. Percentage-based shapes (organic, blob, leaf)
  // adapt to the block's dimensions; uniform shapes use the per-block
  // radius slider value when provided.
  const shape = block.frameShape;
  if (shape && shape !== "default" && SHAPE_RADIUS[shape]) {
    style["--studio-block-radius"] = SHAPE_RADIUS[shape];
  }
  // Curved shapes move content in so it never runs under the curve.
  const padding = shapePadding(shape);
  if (padding) style["--studio-block-padding"] = padding;
  Object.assign(style, blockFillVars(block.frameFill));
  if (block.frameShadow) style["--studio-block-shadow"] = SHADOWS[block.frameShadow];
  if (block.titleStyle) Object.assign(style, blockTitleOverride(block.titleStyle));
  if (block.frameAlign === "center") {
    style["--studio-block-align"] = "center";
    style["--studio-block-justify"] = "center";
  }
  const radius = block.frameRadius;
  if (typeof radius === "number" && Number.isFinite(radius)) {
    style["--studio-block-radius"] = `${Math.round(radius)}px`;
  }
  return style;
}

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
  { value: "dual", label: "Banner + colour" },
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

/**
 * Derive the full --radius-* scale from the corner-roundness slider value so
 * the tile/card/panel systems stay coherent with the Studio block frames:
 * lg (the surface radius) matches the slider exactly; smaller elements scale
 * down proportionally, larger overlays grow a notch per step.
 */
function radiusScale(radius: number): Record<string, string> {
  const n = normalizeRadius(radius);
  return {
    sm: `${Math.round(n * 0.3)}px`,
    md: `${Math.round(n * 0.45)}px`,
    lg: `${n}px`,
    xl: `${n + 1}px`,
    "2xl": `${n + 2}px`,
    "3xl": `${n + 3}px`,
    "4xl": `${n + 4}px`,
  };
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
function resolvedHeadingFont(config: StudioConfig): string | null {
  return (
    fontStack(config.headingFont) ?? fontStack(typePairing(resolveLook(config).typePairing).heading)
  );
}

/** The body face: a hand-picked one, else the type pairing's. */
function resolvedBodyFont(config: StudioConfig): string | null {
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

// ── Config → Page-Level CSS Variables ─────────────────────────────────────────

/**
 * Emit the page-local custom properties that don't fit the token pipeline:
 * density gutters, studio radius/gap/pad, structure max-width, and the
 * `--user-accent-*` family (used by rings, borders, active states, and
 * selection across the whole studio).
 */
export function studioConfigToStyle(
  config: StudioConfig,
  secondaryColor?: string | null,
): React.CSSProperties {
  const style = {} as React.CSSProperties & Record<string, string>;

  const { gap, pad } = densityMetrics(config.density);

  // Density
  const densityGap =
    config.density === "compact" ? "0.75rem" : config.density === "spacious" ? "1.5rem" : "1rem";
  style["--content-density-gap"] = densityGap;
  style["--content-density-padding"] = densityGap;

  // Studio-specific tokens (used by g-studio-surface)
  style["--studio-radius"] = `${config.radius}px`;
  style["--studio-gap"] = `${gap}px`;
  style["--studio-pad"] = `${pad}px`;

  // Accent
  if (config.accentMode === "custom" || config.accentMode === "dual") {
    // "custom" AND "dual" scope the interactive accent to the picked hex.
    const foreground = contrastingHexForeground(config.accentColor);
    emitAccentFamily(style, "user-accent", config.accentColor, foreground);
  } else {
    // Accent "none" resolves to the page primary so the --user-accent-*
    // family always has a defined value (no dangling var()).
    emitAccentFamily(style, "user-accent", "var(--primary)", "var(--primary-foreground)");
  }

  if (config.accentMode === "dual") {
    // Secondary tone = the creator's banner colour (opts into the member's
    // real background); falls back to the picked accent when no banner colour
    // is in scope. Drives background tints and subtle surfaces.
    const secondary = secondaryColor ?? config.accentColor;
    emitAccentFamily(
      style,
      "user-accent-secondary",
      secondary,
      contrastingAccentForeground(secondary),
    );
  }

  // Border weight shared by cards and panels. The border colour itself is
  // owned by the member's appearance (ProfileBackground) so the same choice
  // drives the dashboard, editor, and public Studio.
  style["--card-border-width"] =
    config.cardBorderWidth === "thick"
      ? "2px"
      : config.cardBorderWidth === "medium"
        ? "1.5px"
        : "1px";

  return style;
}

/**
 * Write one accent family (interactive `user-accent` or tonal
 * `user-accent-secondary`) into the style object.
 */
function emitAccentFamily(
  style: Record<string, string>,
  prefix: string,
  source: string,
  foreground: string,
): void {
  style[`--${prefix}`] = source;
  // As text the raw accent can fail contrast (a light violet on paper is
  // ~2.3:1); pulling it toward the foreground keeps AA in light and dark.
  style[`--${prefix}-text`] = `color-mix(in oklab, ${source} 60%, var(--foreground))`;
  style[`--${prefix}-foreground`] = foreground;
  style[`--${prefix}-subtle`] = `color-mix(in oklab, ${source} 10%, transparent)`;
  style[`--${prefix}-border`] = `color-mix(in oklab, ${source} 30%, transparent)`;
  style[`--${prefix}-glow`] = `color-mix(in oklab, ${source} 6%, transparent)`;
}

/** The full `--user-accent-*` family for one colour, e.g. an area's own
 *  accent. Null when the value isn't a #rrggbb colour. */
export function accentFamilyVars(hex: string | undefined): Record<string, string> | null {
  if (!hex || !/^#([0-9a-f]{6})$/i.test(hex)) return null;
  const style: Record<string, string> = {};
  emitAccentFamily(style, "user-accent", hex, contrastingHexForeground(hex));
  return style;
}

/**
 * Page-local style for a Studio surface: the config's custom properties plus
 * the personality font hints. Shared by the owner Studio view, the editor
 * canvas, and any other surface that must render the Studio's look exactly as
 * the published page does — one source of truth so they can't drift.
 */
export function studioSurfaceStyle(
  config: StudioConfig,
  secondaryColor?: string | null,
): React.CSSProperties {
  const style = studioConfigToStyle(config, secondaryColor) as React.CSSProperties &
    Record<string, string>;
  const look = resolveLook(config);
  Object.assign(style, blockTitleVars(resolveTitles(config)));
  // A hand-picked card shadow wins; else the surface brings its own depth.
  const shadow =
    config.cardShadow !== undefined ? SHADOWS[config.cardShadow] : surfaceShadow(look.surface);
  if (shadow && shadow !== "none") style["--studio-card-shadow"] = shadow;
  const enter = MOTION_ANIMATION[look.motion];
  if (enter) style["--studio-enter"] = enter;
  // Labels and metadata: the pairing's meta face; else monospace alongside
  // monospace headings (Technical's original pairing).
  style["--studio-label-font"] =
    fontStack(typePairing(look.typePairing).meta) ??
    (config.headingFont === "jetbrains-mono" ? "JetBrains Mono" : "Inter");
  // Monochrome keeps hierarchy but drops colour: the accent becomes ink.
  if (look.accent === "monochrome") {
    emitAccentFamily(style, "user-accent", "var(--foreground)", "var(--background)");
  }
  // Match the public page's font mapping (studioConfigToThemeTokens) exactly:
  // the chosen heading face drives --font-display/title and a chosen body face
  // drives --font-sans, so every canvas renders the face the published page will.
  const headingFont = resolvedHeadingFont(config);
  if (headingFont) {
    style["--font-display"] = headingFont;
    style["--font-title"] = headingFont;
  }
  const bodyFont = resolvedBodyFont(config);
  if (bodyFont) style["--font-sans"] = bodyFont;
  return style;
}

/**
 * Custom properties the shared `.block-title` reads (src/styles.css), so one
 * Studio setting restyles every block's title on every surface. "hidden"
 * collapses the title visually but keeps it in the accessibility tree.
 */
export function blockTitleVars(style: BlockTitleStyle): Record<string, string> {
  if (style === "heading") {
    return {
      "--bt-size": "0.9375rem",
      "--bt-weight": "600",
      "--bt-transform": "none",
      "--bt-tracking": "-0.01em",
      "--bt-family": "var(--font-title)",
      "--bt-strength": "100%",
      "--bt-gap": "0.75rem",
      "--bt-height": "auto",
    };
  }
  if (style === "hidden") {
    return { "--bt-height": "0px", "--bt-gap": "0px", "--bt-size": "0px" };
  }
  return {};
}

/** One block's own title treatment (overrides the Studio-wide setting). */
export function blockTitleOverride(style: "label" | "heading" | "display"): Record<string, string> {
  if (style === "label")
    return {
      "--bt-size": "0.6875rem",
      "--bt-weight": "600",
      "--bt-transform": "uppercase",
      "--bt-tracking": "0.08em",
      "--bt-strength": "0%",
      "--bt-family": "var(--studio-label-font, var(--font-sans))",
      "--bt-height": "auto",
      "--bt-gap": "0.625rem",
    };
  return {
    ...blockTitleVars("heading"),
    ...(style === "display"
      ? { "--bt-size": "1.5rem", "--bt-tracking": "-0.02em", "--bt-gap": "1rem" }
      : {}),
  };
}

/** Card fill swatches; "" means "follow the page surface". */
export const CARD_FILL_SWATCHES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Auto" },
  { value: "#ffffff", label: "Paper" },
  { value: "#f6f8fa", label: "Mist" },
  { value: "#1f2328", label: "Ink" },
  { value: "#0d1117", label: "Midnight" },
  { value: "#3f8f8a", label: "Teal" },
];

// ── Background Scope → Backdrop ─────────────────────────────────────────────

/** Which backdrop a surface wants: the editor shell or the published page. */
type StudioBackgroundScope = "app" | "public";

/**
 * The Studio's backdrop as a single custom property, `--studio-bg`, resolved
 * from the config's BackgroundId (stamped by every starter and preserved by
 * normalization). One mapping shared by the picker previews, the owner
 * canvases, and the public page, so a template's Paper/Surface/Sunken choice
 * is the same colour everywhere it renders — and the same on every load,
 * because it is a pure function of the stored config.
 *
 * Consumers paint `backgroundColor: var(--studio-bg)` on their canvas root;
 * the member's own backdrop layer (BackgroundLayer) still composes above it.
 */
export function studioBackgroundVars(
  config: Pick<StudioConfig, "appBackground" | "publicBackground">,
  scope: StudioBackgroundScope,
): React.CSSProperties {
  const id = scope === "public" ? config.publicBackground : config.appBackground;
  const surface =
    id === "sunken"
      ? "var(--surface-sunken)"
      : id === "surface"
        ? "var(--surface)"
        : "var(--background)";
  return { "--studio-bg": surface } as React.CSSProperties;
}

/**
 * Card fill → a single resolved colour. Emitted on the *outer* Studio surface
 * so the canvas can point --surface/--card at it without a self-referencing
 * custom property (which CSS drops as a cycle).
 */
export function cardFillStyle(config: StudioConfig): React.CSSProperties {
  const cardColor = config.cardColor ?? "";
  const base = /^#([0-9a-f]{6})$/i.test(cardColor) ? cardColor : "var(--surface-elevated)";
  const opacity = Math.min(100, Math.max(0, Math.round(config.cardOpacity ?? 100)));
  const fill = opacity >= 100 ? base : `color-mix(in oklab, ${base} ${opacity}%, transparent)`;
  return { "--studio-card-fill": fill } as React.CSSProperties;
}

/**
 * Applied to the canvas/content container. Blocks use `bg-surface`,
 * `bg-surface-elevated` and `--card`, so pointing all three at the resolved
 * fill is what makes a Studio block read like a Dashboard panel.
 */
export const CARD_SURFACE_STYLE = {
  "--surface": "var(--studio-card-fill, var(--surface-elevated))",
  "--surface-elevated": "var(--studio-card-fill, var(--surface-elevated))",
  "--card": "var(--studio-card-fill, var(--surface-elevated))",
} as React.CSSProperties;

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

/**
 * Like {@link contrastingHexForeground}, but also parses `rgb(r, g, b)`
 * colours — the format the banner palette extractor returns — so the
 * secondary accent's foreground stays readable when it comes from a banner.
 */
function contrastingAccentForeground(color: string): string {
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    r = (value >> 16) & 255;
    g = (value >> 8) & 255;
    b = value & 255;
  } else {
    const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgb) {
      r = Number(rgb[1]);
      g = Number(rgb[2]);
      b = Number(rgb[3]);
    }
  }
  if (r === null || g === null || b === null) return "var(--background)";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.56 ? "#1f2328" : "#ffffff";
}
