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
  const vars = themeTokensToVars(ensureReadableTheme(tokens));
  return vars as unknown as React.CSSProperties;
}

/** Ensure theme tokens keep the basic foreground/surface relationships readable. */
export function ensureReadableTheme(tokens: ThemeTokens): ThemeTokens {
  const colors = tokens.colors;
  if (!colors) return tokens;
  const background = colors.background;
  const foreground = colors.foreground;
  const surface = colors.surface ?? background;
  if (!background || !foreground || !surface) return tokens;
  if (contrastRatio(background, foreground) >= 4.5 && contrastRatio(surface, foreground) >= 4.5) {
    return tokens;
  }
  const darkBackground = relativeLuminance(background) < 0.45;
  const readableForeground = darkBackground ? "#f8fafc" : "#111827";
  return {
    ...tokens,
    colors: {
      ...colors,
      foreground: readableForeground,
      "card-foreground": readableForeground,
      surface: surface,
      card: colors.card ?? surface,
      "muted-foreground": darkBackground ? "#cbd5e1" : "#475569",
      "primary-foreground": darkBackground ? "#0f172a" : "#ffffff",
      "secondary-foreground": readableForeground,
    },
  };
}

function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function relativeLuminance(value: string): number {
  const match = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return 0.5;
  const hex =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((char) => char + char)
          .join("")
      : match[1];
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
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
