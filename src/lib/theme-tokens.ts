// ── Theme Token Applicator ────────────────────────────────────────────────────
// Converts a ThemeTokens object into a flat map of CSS custom properties that
// directly override the base design tokens from styles.css.
//
// The page container uses `style={themeTokensToStyle(tokens)}` to set
// `--background`, `--foreground`, etc., and every Tailwind utility and
// component references those variables.
//
// Only non-empty values are emitted; empty/undefined values are skipped so
// the page falls back to the default styles.css tokens.

import type { ThemeTokens } from "@/lib/page-blocks";

/**
 * The active light/dark scheme from the app theme toggle. When passed, a full
 * custom palette adapts to it instead of hard-locking to the palette's authored
 * mode — so toggling light/dark stays fluid and consistent across themed pages.
 */
type ThemeScheme = "light" | "dark";

/** Top-level color keys — emitted as `--key: value`. */
const COLOR_KEYS = [
  "background",
  "foreground",
  "muted",
  "muted-foreground",
  "surface",
  "surface-elevated",
  "surface-sunken",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "border",
  "border-strong",
  "input",
  "ring",
  "destructive",
  "destructive-foreground",
  "trust",
  "learning",
  "teaching",
  "ai",
  "warning",
] as const;

/**
 * Flatten theme tokens into a Record<string, string> of CSS custom properties
 * that map directly to the base design tokens.
 *
 * Colors:   "--background": "#fafafa"
 * Typography: "--font-sans": "..."
 * Spacing:   "--spacing-section": "2rem"
 * Borders:   "--radius-lg": "12px"
 * Shadows:   "--shadow-soft": "..."
 */
export function themeTokensToVars(
  tokens: ThemeTokens,
  scheme?: ThemeScheme,
): Record<string, string> {
  const vars: Record<string, string> = {};

  // ── Colors ────────────────────────────────────────────────────────────
  if (tokens.colors) {
    for (const key of COLOR_KEYS) {
      const val = tokens.colors[key];
      if (val && val.length > 0) {
        vars[`--${key}`] = val;
      }
    }
    // Also emit any custom color keys not in the standard set.
    for (const [key, value] of Object.entries(tokens.colors)) {
      if (!(COLOR_KEYS as readonly string[]).includes(key) && value && value.length > 0) {
        vars[`--${key}`] = value;
      }
    }
    deriveContrastVars(vars, scheme);
  }

  // ── Typography ────────────────────────────────────────────────────────
  if (tokens.typography) {
    if (tokens.typography.headingFont && tokens.typography.headingFont.length > 0) {
      vars["--font-display"] = tokens.typography.headingFont;
      vars["--font-title"] = tokens.typography.headingFont;
    }
    if (tokens.typography.bodyFont && tokens.typography.bodyFont.length > 0) {
      vars["--font-sans"] = tokens.typography.bodyFont;
    }
    if (tokens.typography.monoFont && tokens.typography.monoFont.length > 0) {
      vars["--font-mono"] = tokens.typography.monoFont;
    }
  }

  // ── Borders: radius ───────────────────────────────────────────────────
  if (tokens.borders?.radius) {
    const radiusMap: Record<string, string> = {
      sm: "--radius-sm",
      md: "--radius-md",
      lg: "--radius-lg",
      xl: "--radius-xl",
      "2xl": "--radius-2xl",
      "3xl": "--radius-3xl",
      "4xl": "--radius-4xl",
    };
    for (const [key, cssVar] of Object.entries(radiusMap)) {
      const val = tokens.borders.radius[key];
      if (val && val.length > 0) vars[cssVar] = val;
    }
    // Also emit any custom radius keys.
    for (const [key, value] of Object.entries(tokens.borders.radius)) {
      if (!(key in radiusMap) && value && value.length > 0) {
        vars[`--radius-${key}`] = value;
      }
    }
  }

  // ── Borders: style ─────────────────────────────────────────────────────
  if (tokens.borders?.style) {
    vars["--theme-border-style"] = tokens.borders.style;
  }

  // ── Spacing ────────────────────────────────────────────────────────────
  if (tokens.spacing) {
    for (const [key, value] of Object.entries(tokens.spacing)) {
      if (value && value.length > 0) {
        vars[`--spacing-${key}`] = value;
      }
    }
  }

  // ── Shadows ────────────────────────────────────────────────────────────
  if (tokens.shadows) {
    for (const [key, value] of Object.entries(tokens.shadows)) {
      if (value && value.length > 0) {
        vars[`--shadow-${key}`] = value;
      }
    }
  }

  return vars;
}

/**
 * Themes only declare a handful of colors (background, foreground, card…).
 * Every other token would otherwise fall back to the app's light-mode value,
 * which produces unreadable pairings on dark or tinted themes (grey-on-black
 * secondary text, white-on-white borders, near-black primary buttons).
 *
 * This fills in every missing contrast-critical token by mixing the theme's
 * own foreground and background, so any palette stays legible.
 *
 * When `scheme` is supplied (the active light/dark toggle), a full palette also
 * becomes toggle-aware:
 *   - If the palette's natural scheme matches the toggle, it renders exactly as
 *     the creator authored it.
 *   - If they differ, the *canvas* (background / foreground and every derived
 *     neutral: cards, surfaces, muted text, borders) is rebuilt for the active
 *     scheme, while the creator's *identity* (declared primary, accent and the
 *     semantic hues) is preserved and blended in as a tint. So a dark studio
 *     theme gets a matching light counterpart — and vice versa — instead of
 *     hard-locking one mode and fighting the toggle.
 * With no `scheme`, behaviour is unchanged: the authored palette is respected.
 */
function deriveContrastVars(vars: Record<string, string>, scheme?: ThemeScheme): void {
  const bg = vars["--background"];
  const fg = vars["--foreground"];
  // No palette declared — inherit the active light/dark scheme entirely, so
  // accent-only / typography-only themes stay in sync with the theme toggle.
  if (!bg && !fg) return;

  // Background and foreground travel as a pair. When a theme declares only one,
  // derive its partner from *that colour* — never from the app default, which
  // flips with the light/dark toggle and would leave the pair mismatched
  // (dark-on-dark or white-on-light) in one of the two schemes.
  const authoredBg = bg ?? readableCounterpart(fg, "var(--background)");
  const authoredFg = fg ?? readableCounterpart(bg, "var(--foreground)");

  // Does the active toggle disagree with the palette's authored mode?
  const natural = colorScheme(authoredBg);
  const flip = scheme != null && natural != null && scheme !== natural;

  // Canvas anchors. In matching (or scheme-less) mode they are the authored
  // colours. When flipping, rebuild the canvas for the active scheme, tinted by
  // the creator's identity colour so the counterpart still reads as their studio.
  let BG = authoredBg;
  let FG = authoredFg;
  if (flip) {
    const tint = vars["--primary"] ?? vars["--accent"] ?? authoredBg;
    if (scheme === "dark") {
      BG = `color-mix(in oklab, ${tint} 8%, ${DARK_CANVAS})`;
      FG = PAPER_NEUTRAL;
    } else {
      BG = `color-mix(in oklab, ${tint} 8%, ${LIGHT_CANVAS})`;
      FG = INK_NEUTRAL;
    }
  }

  const mix = (pct: number) => `color-mix(in oklab, ${FG} ${pct}%, ${BG})`;
  // Structural (canvas) tokens: rebuilt when flipping, otherwise only filled
  // when the theme didn't declare them.
  const putStructural = (key: string, value: string) => {
    if (flip || !vars[key]) vars[key] = value;
  };
  // Identity tokens: always keep an explicitly declared value; only supply a
  // default when the theme left it out.
  const putIdentity = (key: string, value: string) => {
    if (!vars[key]) vars[key] = value;
  };

  // Emit both anchors so the themed container never borrows a half of the pair
  // from the toggle-driven default (the source of unreadable text on switch).
  putStructural("--background", BG);
  putStructural("--foreground", FG);

  const card = flip ? BG : (vars["--card"] ?? BG);
  putStructural("--card", card);
  putStructural("--card-foreground", FG);
  putStructural("--popover", card);
  putStructural("--popover-foreground", FG);
  putStructural("--surface", card);
  putStructural("--surface-elevated", card);
  putStructural("--surface-sunken", mix(6));

  putStructural("--muted", mix(8));
  putStructural("--muted-foreground", mix(70));
  putStructural("--muted-foreground-subtle", mix(55));
  putStructural("--secondary", mix(8));
  putStructural("--secondary-foreground", FG);
  putStructural("--accent", mix(10));
  putStructural("--accent-foreground", FG);

  // Keep boundaries visible in both directions. A very dark canvas needs a
  // brighter rule, while a paper canvas needs a quieter rule; the mix remains
  // tied to the active foreground so themed panels never borrow the wrong mode.
  putStructural("--border", mix(scheme === "dark" || colorScheme(BG) === "dark" ? 24 : 18));
  putStructural("--border-strong", mix(scheme === "dark" || colorScheme(BG) === "dark" ? 42 : 32));
  putStructural("--input", mix(18));

  // Primary is identity: keep a declared brand colour, else fall back to the
  // canvas ink. Its foreground is always derived so button labels stay legible
  // against whichever primary is in play.
  putIdentity("--primary", FG);
  vars["--primary-foreground"] = readableCounterpart(vars["--primary"], BG);
  putIdentity("--ring", vars["--primary"]);

  // Runtime accents inherit the same contrast-safe canvas. This keeps focused
  // controls and active template states readable even when a custom theme flips.
  putStructural("--user-accent-foreground", readableCounterpart(vars["--primary"], BG));
  putStructural("--user-accent-subtle", `color-mix(in oklab, var(--primary) 12%, ${BG})`);
  putStructural("--user-accent-border", `color-mix(in oklab, var(--primary) 42%, ${BG})`);
  putStructural("--destructive-foreground", BG);

  // Semantic hue tints must sit on the active canvas, not on white.
  for (const hue of ["trust", "learning", "teaching", "ai", "warning", "caution"]) {
    putStructural(`--${hue}-subtle`, `color-mix(in oklab, var(--${hue}) 16%, ${BG})`);
    putStructural(`--${hue}-foreground`, BG);
  }
}

/**
 * Neutral ink / paper anchors used when a theme declares only one half of the
 * background/foreground pair, and as the canvas text colour when flipping a
 * palette to the opposite scheme. They match the app's own light-mode ink and a
 * near-white paper, so a derived partner reads like Tethyr rather than a raw
 * black/white.
 */
const INK_NEUTRAL = "#1f2328";
const PAPER_NEUTRAL = "#f5f6f8";

/**
 * Canvas bases used when flipping a palette to the scheme it wasn't authored
 * for. They are near-neutral so the creator's identity colour (blended in at a
 * low percentage) defines the character, not a flat black/white.
 */
const DARK_CANVAS = "#101319";
const LIGHT_CANVAS = "#f7f8fa";

/**
 * Relative luminance (0–1) of a 6-digit hex colour, or null for any other
 * format (e.g. oklch / var()) where we can't safely infer brightness.
 */
function hexLuminance(color: string): number | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Return a neutral that contrasts against `color` (dark ink for light colours,
 * light paper for dark colours). Works on 6-digit hex, which is what the colour
 * pickers emit. For any other format (e.g. oklch), fall back to `fallback` so a
 * partial non-hex palette never produces a wrong-contrast guess.
 */
function readableCounterpart(color: string, fallback: string): string {
  const luminance = hexLuminance(color);
  if (luminance == null) return fallback;
  return luminance > 0.56 ? INK_NEUTRAL : PAPER_NEUTRAL;
}

/**
 * Classify a colour as belonging to a "light" or "dark" palette, or null when
 * brightness can't be inferred (non-hex). Used to decide whether the active
 * toggle agrees with a palette's authored mode.
 */
function colorScheme(color: string): ThemeScheme | null {
  const luminance = hexLuminance(color);
  if (luminance == null) return null;
  return luminance > 0.5 ? "light" : "dark";
}

/**
 * Given a ThemeTokens object, return a CSS style object suitable for a
 * React `style` prop.
 */
export function themeTokensToStyle(tokens: ThemeTokens, scheme?: ThemeScheme): React.CSSProperties {
  const vars = themeTokensToVars(tokens, scheme);
  const fg = vars["--foreground"];
  if (typeof fg === "string" && fg.trim() !== "") {
    // Inherited text must adopt the theme's foreground color, not the app
    // default (which is dark ink). Elements with no explicit text color
    // (project card titles, bio copy, direction note, achievement rows)
    // would otherwise read dark-on-dark on dark/tinted themes.
    (vars as Record<string, string>)["color"] = fg;
  }
  return vars as unknown as React.CSSProperties;
}

/** Recursively merge `overrides` over `base`. Plain objects merge key-by-key;
 * arrays and primitives are replaced by the override value. */
export function deepMergeTokens<T>(base: T, overrides: T): T {
  if (isPlainObject(base) && isPlainObject(overrides)) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(overrides)) {
      out[key] = deepMergeTokens((base as Record<string, unknown>)[key], value);
    }
    return out as T;
  }
  return overrides === undefined ? base : overrides;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
