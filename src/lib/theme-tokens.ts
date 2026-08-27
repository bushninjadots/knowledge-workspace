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
 * Given a ThemeTokens object, return a CSS style object suitable for a
 * React `style` prop.
 */
export function themeTokensToStyle(tokens: ThemeTokens): React.CSSProperties {
  const vars = themeTokensToVars(tokens);
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
