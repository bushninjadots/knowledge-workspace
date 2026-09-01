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
export function themeTokensToVars(tokens: ThemeTokens): Record<string, string> {
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
    deriveContrastVars(vars);
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
 */
function deriveContrastVars(vars: Record<string, string>): void {
  const bg = vars["--background"];
  const fg = vars["--foreground"];
  // Only derive when the theme actually re-bases the surface or text color.
  if (!bg && !fg) return;

  const BG = bg ?? "var(--background)";
  const FG = fg ?? "var(--foreground)";
  const mix = (pct: number) => `color-mix(in oklab, ${FG} ${pct}%, ${BG})`;
  const setIf = (key: string, value: string) => {
    if (!vars[key]) vars[key] = value;
  };

  const card = vars["--card"] ?? BG;
  setIf("--card", card);
  setIf("--card-foreground", FG);
  setIf("--popover", card);
  setIf("--popover-foreground", FG);
  setIf("--surface", card);
  setIf("--surface-elevated", card);
  setIf("--surface-sunken", mix(6));

  setIf("--muted", mix(8));
  setIf("--muted-foreground", mix(70));
  setIf("--muted-foreground-subtle", mix(55));
  setIf("--secondary", mix(8));
  setIf("--secondary-foreground", FG);
  setIf("--accent", mix(10));
  setIf("--accent-foreground", FG);

  setIf("--border", mix(18));
  setIf("--border-strong", mix(32));
  setIf("--input", vars["--border"]);

  setIf("--primary", FG);
  setIf("--primary-foreground", BG);
  setIf("--ring", vars["--primary"]);
  setIf("--destructive-foreground", BG);

  // Semantic hue tints must sit on the theme background, not on white.
  for (const hue of ["trust", "learning", "teaching", "ai", "warning", "caution"]) {
    setIf(`--${hue}-subtle`, `color-mix(in oklab, var(--${hue}) 16%, ${BG})`);
    setIf(`--${hue}-foreground`, BG);
  }
}

/**
 * Given a ThemeTokens object, return a CSS style object suitable for a
 * React `style` prop.
 */
export function themeTokensToStyle(tokens: ThemeTokens): React.CSSProperties {
  const vars = themeTokensToVars(tokens);
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
