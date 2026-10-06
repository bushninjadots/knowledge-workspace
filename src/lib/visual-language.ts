// ── Visual Language ───────────────────────────────────────────────────────────
// How a Studio *feels*: one coordinated set of visual decisions (type, surfaces,
// borders, dividers, grid, colour, accent, shapes, rhythm, images, header,
// details, motion) that a member picks as a direction and then fine-tunes.
//
// It is not a second theme engine. It lives on StudioConfig (pages.config) as
//   visualLanguage — the chosen direction (unset = "Original", the look every
//                    Studio had before languages existed)
//   look           — the member's own choices, each one overriding the
//                    direction's default for that setting
// and resolves into the same outputs the Studio already has: ThemeTokens
// (fonts, colours) through studioConfigToThemeTokens, CSS custom properties
// through studioSurfaceStyle, and data-vl-* attributes read by the shared
// `.studio-block` / `.studio-area` CSS. The editor, the owner view and the
// public page all render from those, so they can't drift apart.
//
// Choosing a direction never touches content or composition (blocks, areas,
// order, visibility, per-block styling). It replaces the page-wide look and
// clears the page-wide fine-tunes that belong to it; undo brings them back.

import type { FontId } from "@/lib/fonts";

export type VisualLanguageId =
  "minimal" | "editorial" | "portfolio" | "technical" | "experimental" | "personal";

export type TypePairingId =
  "theme" | "swiss" | "contemporary" | "technical" | "editorial" | "art" | "experimental";
export type TypeScaleId = "compact" | "standard" | "expressive" | "display";
export type SurfaceId = "flat" | "paper" | "raised" | "inset" | "outline" | "open";
export type BorderId =
  "solid" | "none" | "dashed" | "dotted" | "double" | "offset" | "underline" | "corners";
export type DividerId =
  | "none"
  | "line"
  | "double"
  | "dotted"
  | "dashed"
  | "fade"
  | "short"
  | "numbered"
  | "crosshair"
  | "marker";
export type TransitionId = "none" | "space" | "band";
export type GridId = "invisible" | "subtle" | "editorial" | "technical" | "modular" | "baseline";
export type AtmosphereId = "theme" | "warm" | "cool" | "muted" | "vivid" | "contrast";
export type AccentBehaviourId = "signature" | "minimal" | "structural" | "bold" | "monochrome";
export type ShapeId = "soft" | "geometric" | "organic" | "mixed";
export type RhythmId = "regular" | "editorial" | "asymmetric" | "compressed" | "breathing";
export type ImageTreatmentId =
  | "natural"
  | "square"
  | "soft"
  | "rounded"
  | "monochrome"
  | "duotone"
  | "contrast"
  | "faded"
  | "grain"
  | "crop";
export type HeaderTreatmentId =
  "classic" | "editorial" | "signature" | "split" | "minimal" | "poster";
export type DetailsId = "none" | "minimal" | "editorial" | "technical" | "expressive";
export type MotionId = "still" | "subtle" | "reveal" | "editorial" | "playful";
export type TitleStyleId = "label" | "heading" | "hidden";

/** Every page-wide visual decision, fully resolved. */
export interface Look {
  typePairing: TypePairingId;
  typeScale: TypeScaleId;
  surface: SurfaceId;
  borders: BorderId;
  dividers: DividerId;
  transitions: TransitionId;
  grid: GridId;
  atmosphere: AtmosphereId;
  accent: AccentBehaviourId;
  shapes: ShapeId;
  rhythm: RhythmId;
  images: ImageTreatmentId;
  header: HeaderTreatmentId;
  details: DetailsId;
  motion: MotionId;
}
export type LookKey = keyof Look;

/** A direction: its look, plus the existing Studio settings it stamps. */
export interface VisualLanguage {
  id: VisualLanguageId;
  label: string;
  /** One line on how it feels. */
  feels: string;
  look: Look;
  /** Block title treatment (StudioConfig.blockTitles is its fine-tune). */
  titles: TitleStyleId;
}

/**
 * The look every Studio had before visual languages: each value here renders
 * exactly as the Studio did, so existing pages are untouched until their owner
 * chooses a direction (or changes one setting).
 */
export const ORIGINAL_LOOK: Readonly<Look> = {
  typePairing: "theme",
  typeScale: "standard",
  surface: "flat",
  borders: "solid",
  dividers: "none",
  transitions: "none",
  grid: "invisible",
  atmosphere: "theme",
  accent: "signature",
  shapes: "soft",
  rhythm: "regular",
  images: "natural",
  header: "classic",
  details: "none",
  motion: "still",
};

export const VISUAL_LANGUAGES: readonly VisualLanguage[] = [
  {
    id: "minimal",
    label: "Minimal",
    feels: "Quiet, restrained, spacious.",
    titles: "label",
    look: {
      typePairing: "swiss",
      typeScale: "standard",
      surface: "open",
      borders: "none",
      dividers: "line",
      transitions: "space",
      grid: "invisible",
      atmosphere: "theme",
      accent: "minimal",
      shapes: "geometric",
      rhythm: "breathing",
      images: "natural",
      header: "minimal",
      details: "none",
      motion: "subtle",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    feels: "Type-led, ruled, with a strong hierarchy.",
    titles: "heading",
    look: {
      typePairing: "editorial",
      typeScale: "expressive",
      surface: "open",
      borders: "underline",
      dividers: "line",
      transitions: "space",
      grid: "editorial",
      atmosphere: "warm",
      accent: "structural",
      shapes: "geometric",
      rhythm: "editorial",
      images: "crop",
      header: "editorial",
      details: "editorial",
      motion: "editorial",
    },
  },
  {
    id: "portfolio",
    label: "Portfolio",
    feels: "Image-forward, with big moments for the work.",
    titles: "heading",
    look: {
      typePairing: "contemporary",
      typeScale: "display",
      surface: "flat",
      borders: "none",
      dividers: "none",
      transitions: "space",
      grid: "invisible",
      atmosphere: "theme",
      accent: "signature",
      shapes: "soft",
      rhythm: "regular",
      images: "rounded",
      header: "poster",
      details: "minimal",
      motion: "reveal",
    },
  },
  {
    id: "technical",
    label: "Technical",
    feels: "Gridded, precise, with monospace metadata.",
    titles: "label",
    look: {
      typePairing: "technical",
      typeScale: "compact",
      surface: "outline",
      borders: "solid",
      dividers: "crosshair",
      transitions: "none",
      grid: "technical",
      atmosphere: "cool",
      accent: "structural",
      shapes: "geometric",
      rhythm: "regular",
      images: "square",
      header: "split",
      details: "technical",
      motion: "still",
    },
  },
  {
    id: "experimental",
    label: "Experimental",
    feels: "Asymmetric, bold, a little unexpected.",
    titles: "heading",
    look: {
      typePairing: "experimental",
      typeScale: "display",
      surface: "flat",
      borders: "offset",
      dividers: "marker",
      transitions: "band",
      grid: "modular",
      atmosphere: "vivid",
      accent: "bold",
      shapes: "mixed",
      rhythm: "asymmetric",
      images: "duotone",
      header: "signature",
      details: "expressive",
      motion: "playful",
    },
  },
  {
    id: "personal",
    label: "Personal",
    feels: "Warm, expressive and approachable.",
    titles: "heading",
    look: {
      typePairing: "art",
      typeScale: "expressive",
      surface: "paper",
      borders: "none",
      dividers: "short",
      transitions: "none",
      grid: "invisible",
      atmosphere: "warm",
      accent: "signature",
      shapes: "organic",
      rhythm: "regular",
      images: "soft",
      header: "classic",
      details: "minimal",
      motion: "subtle",
    },
  },
];

const LANGUAGE_BY_ID = new Map(VISUAL_LANGUAGES.map((language) => [language.id, language]));

export function visualLanguage(id: string | null | undefined): VisualLanguage | null {
  return (id && LANGUAGE_BY_ID.get(id as VisualLanguageId)) || null;
}

// ── Option catalogs (labels the panel shows; order is display order) ────────

export const TYPE_PAIRINGS: ReadonlyArray<{
  id: TypePairingId;
  label: string;
  heading: FontId | null;
  body: FontId | null;
  /** Labels, metadata and section numbers. */
  meta: FontId | null;
}> = [
  { id: "theme", label: "Theme", heading: null, body: null, meta: null },
  { id: "swiss", label: "Swiss", heading: "inter", body: "inter", meta: "inter" },
  {
    id: "contemporary",
    label: "Contemporary",
    heading: "space-grotesk",
    body: "inter",
    meta: "inter",
  },
  {
    id: "technical",
    label: "Technical",
    heading: "space-grotesk",
    body: "inter",
    meta: "jetbrains-mono",
  },
  { id: "editorial", label: "Editorial", heading: "fraunces", body: "inter", meta: "inter" },
  { id: "art", label: "Art", heading: "playfair-display", body: "dm-sans", meta: "dm-sans" },
  {
    id: "experimental",
    label: "Experimental",
    heading: "sora",
    body: "inter",
    meta: "jetbrains-mono",
  },
];

export function typePairing(id: TypePairingId) {
  return TYPE_PAIRINGS.find((pairing) => pairing.id === id) ?? TYPE_PAIRINGS[0];
}

type Options<T extends string> = ReadonlyArray<{ id: T; label: string }>;

export const LOOK_OPTIONS: { [K in LookKey]: Options<Look[K]> } = {
  typePairing: TYPE_PAIRINGS.map(({ id, label }) => ({ id, label })),
  typeScale: [
    { id: "compact", label: "Compact" },
    { id: "standard", label: "Standard" },
    { id: "expressive", label: "Expressive" },
    { id: "display", label: "Display" },
  ],
  surface: [
    { id: "flat", label: "Flat" },
    { id: "paper", label: "Paper" },
    { id: "raised", label: "Raised" },
    { id: "inset", label: "Inset" },
    { id: "outline", label: "Outline" },
    { id: "open", label: "Open" },
  ],
  borders: [
    { id: "solid", label: "Solid" },
    { id: "none", label: "None" },
    { id: "dashed", label: "Dashed" },
    { id: "dotted", label: "Dotted" },
    { id: "double", label: "Double" },
    { id: "offset", label: "Offset" },
    { id: "underline", label: "Underline" },
    { id: "corners", label: "Corners" },
  ],
  dividers: [
    { id: "none", label: "None" },
    { id: "line", label: "Line" },
    { id: "double", label: "Double" },
    { id: "dotted", label: "Dotted" },
    { id: "dashed", label: "Dashed" },
    { id: "fade", label: "Fade" },
    { id: "short", label: "Short rule" },
    { id: "numbered", label: "Numbered" },
    { id: "crosshair", label: "Crosshair" },
    { id: "marker", label: "Marker" },
  ],
  transitions: [
    { id: "none", label: "Even" },
    { id: "space", label: "Pauses" },
    { id: "band", label: "Bands" },
  ],
  grid: [
    { id: "invisible", label: "Invisible" },
    { id: "subtle", label: "Subtle" },
    { id: "editorial", label: "Editorial" },
    { id: "technical", label: "Technical" },
    { id: "modular", label: "Modular" },
    { id: "baseline", label: "Baseline" },
  ],
  atmosphere: [
    { id: "theme", label: "Theme" },
    { id: "warm", label: "Warm" },
    { id: "cool", label: "Cool" },
    { id: "muted", label: "Muted" },
    { id: "vivid", label: "Vivid" },
    { id: "contrast", label: "High contrast" },
  ],
  accent: [
    { id: "signature", label: "Signature" },
    { id: "minimal", label: "Minimal" },
    { id: "structural", label: "Structural" },
    { id: "bold", label: "Bold" },
    { id: "monochrome", label: "Monochrome" },
  ],
  shapes: [
    { id: "soft", label: "Soft" },
    { id: "geometric", label: "Geometric" },
    { id: "organic", label: "Organic" },
    { id: "mixed", label: "Mixed" },
  ],
  rhythm: [
    { id: "regular", label: "Regular" },
    { id: "editorial", label: "Editorial" },
    { id: "asymmetric", label: "Asymmetric" },
    { id: "compressed", label: "Compressed" },
    { id: "breathing", label: "Breathing" },
  ],
  images: [
    { id: "natural", label: "Natural" },
    { id: "square", label: "Square" },
    { id: "soft", label: "Soft" },
    { id: "rounded", label: "Rounded" },
    { id: "crop", label: "Editorial crop" },
    { id: "monochrome", label: "Mono" },
    { id: "duotone", label: "Duotone" },
    { id: "contrast", label: "Contrast" },
    { id: "faded", label: "Faded" },
    { id: "grain", label: "Grain" },
  ],
  header: [
    { id: "classic", label: "Classic" },
    { id: "editorial", label: "Editorial" },
    { id: "signature", label: "Signature" },
    { id: "split", label: "Split" },
    { id: "minimal", label: "Minimal" },
    { id: "poster", label: "Poster" },
  ],
  details: [
    { id: "none", label: "None" },
    { id: "minimal", label: "Minimal" },
    { id: "editorial", label: "Editorial" },
    { id: "technical", label: "Technical" },
    { id: "expressive", label: "Expressive" },
  ],
  motion: [
    { id: "still", label: "Still" },
    { id: "subtle", label: "Subtle" },
    { id: "reveal", label: "Reveal" },
    { id: "editorial", label: "Editorial" },
    { id: "playful", label: "Playful" },
  ],
};

const LOOK_KEYS = Object.keys(ORIGINAL_LOOK) as LookKey[];

// ── Groups: what a Reset restores ──────────────────────────────────────────

/** Settings a group owns: look keys plus the existing StudioConfig fields that
 *  fine-tune them (cleared on reset so the direction's value shows again). */
export const LOOK_GROUPS = {
  typography: {
    label: "Typography",
    keys: ["typePairing", "typeScale"],
    fineTune: ["headingFont", "bodyFont", "blockTitles"],
  },
  colour: { label: "Colour", keys: ["atmosphere", "accent"], fineTune: [] },
  header: { label: "Header", keys: ["header"], fineTune: [] },
  surfaces: { label: "Surfaces", keys: ["surface"], fineTune: ["cardShadow"] },
  borders: { label: "Borders", keys: ["borders"], fineTune: [] },
  dividers: { label: "Dividers", keys: ["dividers", "transitions"], fineTune: [] },
  grid: { label: "Grid", keys: ["grid"], fineTune: [] },
  shapes: { label: "Shapes", keys: ["shapes"], fineTune: ["radius"] },
  images: { label: "Images", keys: ["images"], fineTune: [] },
  rhythm: { label: "Rhythm", keys: ["rhythm"], fineTune: [] },
  details: { label: "Details", keys: ["details"], fineTune: [] },
  motion: { label: "Motion", keys: ["motion"], fineTune: ["motion"] },
} as const satisfies Record<
  string,
  { label: string; keys: readonly LookKey[]; fineTune: readonly string[] }
>;
export type LookGroupId = keyof typeof LOOK_GROUPS;

// ── Resolution ──────────────────────────────────────────────────────────────

/** The slice of StudioConfig this module reads and writes. */
export interface LookConfig {
  visualLanguage?: VisualLanguageId | null;
  look?: Partial<Look>;
  headingFont?: FontId | null;
  bodyFont?: FontId | null;
  blockTitles?: TitleStyleId;
  cardShadow?: "none" | "soft" | "lifted";
  radius: number;
  /** Legacy motion switch, from before Motion had personalities. */
  motion?: "none" | "rise";
}

/** The direction's defaults (Original when none is chosen). */
export function baseLook(config: Pick<LookConfig, "visualLanguage" | "motion">): Look {
  const language = visualLanguage(config.visualLanguage);
  if (language) return language.look;
  // Original keeps the old "Rise in" switch working as the Reveal motion.
  return config.motion === "rise" ? { ...ORIGINAL_LOOK, motion: "reveal" } : ORIGINAL_LOOK;
}

/** Every page-wide decision: the member's own choices over the direction's. */
export function resolveLook(config: LookConfig): Look {
  return { ...baseLook(config), ...normalizeLook(config.look) };
}

/** Block titles: the member's setting, else the direction's, else labels. */
export function resolveTitles(config: LookConfig): TitleStyleId {
  return config.blockTitles ?? visualLanguage(config.visualLanguage)?.titles ?? "label";
}

/** Corner radius (px) each shape language starts the Studio's corners at. */
export const SHAPE_RADIUS: Record<ShapeId, number> = {
  soft: 12,
  geometric: 0,
  organic: 20,
  mixed: 0,
};

/** Keep only known keys with known values, so a hand-edited row can't crash. */
export function normalizeLook(raw: unknown): Partial<Look> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<LookKey, string>> = {};
  for (const key of LOOK_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && LOOK_OPTIONS[key].some((option) => option.id === value)) {
      out[key] = value;
    }
  }
  return out as Partial<Look>;
}

/** Whether the member has changed anything the direction set. */
export function isLookModified(config: LookConfig): boolean {
  const own = normalizeLook(config.look);
  const base = baseLook(config);
  if (LOOK_KEYS.some((key) => own[key] !== undefined && own[key] !== base[key])) return true;
  const language = visualLanguage(config.visualLanguage);
  if (!language) return false;
  return (
    !!config.headingFont ||
    !!config.bodyFont ||
    (config.blockTitles !== undefined && config.blockTitles !== language.titles) ||
    config.cardShadow !== undefined ||
    config.radius !== SHAPE_RADIUS[language.look.shapes]
  );
}

/** Whether one group differs from the direction. */
export function isGroupModified(config: LookConfig, group: LookGroupId): boolean {
  const { keys, fineTune } = LOOK_GROUPS[group];
  const own = normalizeLook(config.look);
  const base = baseLook(config);
  if (keys.some((key) => own[key] !== undefined && own[key] !== base[key])) return true;
  const language = visualLanguage(config.visualLanguage);
  // Original has no direction to differ from: its fine-tunes are just settings.
  if (!language) return false;
  return (fineTune as readonly string[]).some((field) => {
    if (field === "radius") return config.radius !== SHAPE_RADIUS[language.look.shapes];
    if (field === "motion") return false;
    if (field === "blockTitles")
      return (
        config.blockTitles !== undefined &&
        config.blockTitles !== resolveTitles({ ...config, blockTitles: undefined })
      );
    return (
      config[field as keyof LookConfig] !== undefined && config[field as keyof LookConfig] !== null
    );
  });
}

// ── Edits (each returns a StudioConfig patch) ────────────────────────────────

/** Choose a direction: its whole look, with the page-wide fine-tunes cleared.
 *  `null` returns to Original. Content and per-block styling are untouched. */
export function chooseVisualLanguage(id: VisualLanguageId | null): Partial<LookConfig> {
  const language = visualLanguage(id);
  return {
    visualLanguage: language?.id ?? null,
    look: {},
    headingFont: null,
    bodyFont: null,
    blockTitles: undefined,
    cardShadow: undefined,
    motion: undefined,
    radius: SHAPE_RADIUS[language?.look.shapes ?? "soft"],
  };
}

/** Change one setting. Broad choices clear the fine-tunes beneath them, so
 *  the new choice shows (a pairing replaces hand-picked faces, a surface its
 *  shadow, a shape language its corner radius). */
export function setLookValue<K extends LookKey>(
  config: LookConfig,
  key: K,
  value: Look[K],
): Partial<LookConfig> {
  const patch: Partial<LookConfig> = { look: { ...normalizeLook(config.look), [key]: value } };
  if (key === "typePairing") {
    patch.headingFont = null;
    patch.bodyFont = null;
  }
  if (key === "surface") patch.cardShadow = undefined;
  if (key === "shapes") patch.radius = SHAPE_RADIUS[value as ShapeId];
  if (key === "motion") patch.motion = undefined;
  return patch;
}

/** Put one group back to the direction's values. */
export function resetLookGroup(config: LookConfig, group: LookGroupId): Partial<LookConfig> {
  const { keys, fineTune } = LOOK_GROUPS[group];
  const look = { ...normalizeLook(config.look) };
  for (const key of keys) delete look[key];
  const patch: Partial<LookConfig> = { look };
  for (const field of fineTune as readonly string[]) {
    if (field === "radius") {
      patch.radius = SHAPE_RADIUS[baseLook(config).shapes];
    } else if (field === "headingFont" || field === "bodyFont") {
      patch[field] = null;
    } else {
      (patch as Record<string, unknown>)[field] = undefined;
    }
  }
  return patch;
}

/** Put every page-wide setting back to the direction's values. */
export function resetLook(config: LookConfig): Partial<LookConfig> {
  return chooseVisualLanguage(config.visualLanguage ?? null);
}

/** "Editorial", "Editorial · Modified", "Original". */
export function lookLabel(config: LookConfig): string {
  const name = visualLanguage(config.visualLanguage)?.label ?? "Original";
  return isLookModified(config) ? `${name} · Modified` : name;
}

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * data-vl-* attributes for a Studio's canvas root. The shared CSS keys its
 * borders, dividers, grid, images, header and details off these, so every
 * surface (editor, owner view, public page) renders one look. Original's
 * values produce no rules, which is what keeps old pages unchanged.
 */
export function lookAttributes(look: Look): Record<string, string> {
  return {
    "data-vl-scale": look.typeScale,
    "data-vl-surface": look.surface,
    "data-vl-border": look.borders,
    "data-vl-divider": look.dividers,
    "data-vl-transition": look.transitions,
    "data-vl-grid": look.grid,
    "data-vl-accent": look.accent,
    "data-vl-shapes": look.shapes,
    "data-vl-rhythm": look.rhythm,
    "data-vl-images": look.images,
    "data-vl-header": look.header,
    "data-vl-details": look.details,
  };
}

/** Each motion personality's entrance (keyframes live in styles.css). */
export const MOTION_ANIMATION: Record<MotionId, string | null> = {
  still: null,
  subtle: "studio-fade linear both",
  reveal: "studio-rise linear both",
  editorial: "studio-slide linear both",
  playful: "studio-pop linear both",
};

const SURFACE_SHADOW: Partial<Record<SurfaceId, string>> = {
  paper: "0 1px 0 rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.05)",
  raised: "0 2px 4px rgb(0 0 0 / 0.06), 0 14px 36px rgb(0 0 0 / 0.14)",
  inset: "inset 0 1px 3px rgb(0 0 0 / 0.08)",
};

/** The surface's own shadow, or undefined to keep the Studio's card shadow. */
export function surfaceShadow(surface: SurfaceId): string | undefined {
  return SURFACE_SHADOW[surface];
}

// ── Colour atmosphere ───────────────────────────────────────────────────────

type Palette = { background: string; foreground: string; card: string; border?: string };

const ATMOSPHERES: Partial<Record<AtmosphereId, Palette>> = {
  warm: { background: "#f7f2ea", foreground: "#2b2520", card: "#fcf9f4" },
  cool: { background: "#f1f4f8", foreground: "#18202b", card: "#f9fbfd" },
  muted: { background: "#f2f1ee", foreground: "#3a3835", card: "#f8f7f5" },
  contrast: { background: "#ffffff", foreground: "#000000", card: "#ffffff", border: "#3a3a3a" },
};

/** Mix two #rrggbb colours (`amount` of `b`, 0–1). */
export function mixHex(a: string, b: string, amount: number): string {
  const parse = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

/**
 * The canvas palette an atmosphere sets, as ThemeTokens colours. These go
 * through the existing theme pipeline (deriveContrastVars), which fills in
 * every neutral from the anchors and rebuilds the palette for whichever
 * light/dark mode the visitor uses. The primary is the member's accent so the
 * palette never drops their colour. Null for "theme": the theme's own palette.
 */
export function atmosphereColors(
  atmosphere: AtmosphereId,
  accentHex: string | null,
): Record<string, string> | null {
  const accent = accentHex && /^#[0-9a-f]{6}$/i.test(accentHex) ? accentHex : null;
  let palette = ATMOSPHERES[atmosphere];
  if (atmosphere === "vivid") {
    const tint = accent ?? "#3f8f8a";
    palette = {
      background: mixHex("#fbfbfa", tint, 0.07),
      foreground: "#14161a",
      card: mixHex("#ffffff", tint, 0.03),
    };
  }
  if (!palette) return null;
  return {
    background: palette.background,
    foreground: palette.foreground,
    card: palette.card,
    ...(palette.border ? { border: palette.border } : {}),
    ...(accent
      ? { primary: atmosphere === "muted" ? mixHex(accent, "#8a8885", 0.35) : accent }
      : {}),
  };
}
