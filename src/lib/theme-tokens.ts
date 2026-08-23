// ── Theme Token Applicator ────────────────────────────────────────────────────
// Converts a ThemeTokens object into a flat map of CSS custom properties that
// can be set on a container element's style attribute to override the default
// design tokens from styles.css.

import type { ThemeTokens } from "@/lib/page-blocks";

/** Prefix for all theme-applied CSS variables. */
const PREFIX = "--tethyr-theme";

/**
 * Flatten theme tokens into a Record<string, string> of CSS custom properties.
 * Only non-empty values are emitted; empty or undefined values are skipped so
 * the page falls back to the default styles.css tokens.
 *
 * Example output:
 *   { "--tethyr-theme-colors-background": "#fafafa", ... }
 */
export function themeTokensToVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  if (tokens.colors) {
    for (const [key, value] of Object.entries(tokens.colors)) {
      if (value && value.length > 0) {
        vars[`${PREFIX}-colors-${key}`] = value;
      }
    }
  }

  if (tokens.typography) {
    if (tokens.typography.headingFont) {
      vars[`${PREFIX}-typography-heading-font`] = tokens.typography.headingFont;
    }
    if (tokens.typography.bodyFont) {
      vars[`${PREFIX}-typography-body-font`] = tokens.typography.bodyFont;
    }
    if (tokens.typography.monoFont) {
      vars[`${PREFIX}-typography-mono-font`] = tokens.typography.monoFont;
    }
  }

  if (tokens.spacing) {
    for (const [key, value] of Object.entries(tokens.spacing)) {
      if (value && value.length > 0) {
        vars[`${PREFIX}-spacing-${key}`] = value;
      }
    }
  }

  if (tokens.borders) {
    if (tokens.borders.style) {
      vars[`${PREFIX}-borders-style`] = tokens.borders.style;
    }
    if (tokens.borders.radius) {
      for (const [key, value] of Object.entries(tokens.borders.radius)) {
        if (value && value.length > 0) {
          vars[`${PREFIX}-borders-radius-${key}`] = value;
        }
      }
    }
  }

  if (tokens.shadows) {
    for (const [key, value] of Object.entries(tokens.shadows)) {
      if (value && value.length > 0) {
        vars[`${PREFIX}-shadows-${key}`] = value;
      }
    }
  }

  return vars;
}

/**
 * Given a ThemeTokens object, return a CSS style string suitable for a
 * style attribute or a CSS-in-JS `style` prop.
 */
export function themeTokensToStyle(tokens: ThemeTokens): React.CSSProperties {
  const vars = themeTokensToVars(tokens);
  return vars as unknown as React.CSSProperties;
}