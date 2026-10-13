// ── Studio config → CSS ──────────────────────────────────────────────────────────
// Page-level custom properties, surface and card styles, block-title variables,
// backdrop scope and the profile's light/dark scheme, all derived from a
// normalized StudioConfig (studio-config.ts).

import type { ThemeTokens } from "@/lib/page-blocks";
import { fontStack } from "@/lib/fonts";
import { naturalScheme } from "@/lib/theme-tokens";
import {
  MOTION_ANIMATION,
  resolveLook,
  resolveTitles,
  surfaceShadow,
  typePairing,
} from "@/lib/visual-language";
import {
  SHADOWS,
  densityMetrics,
  resolvedBodyFont,
  resolvedHeadingFont,
  studioConfigToThemeTokens,
  type BlockTitleStyle,
  type StudioConfig,
} from "./studio-config";

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

  // A profile keeps its own spacing scale whatever density the viewer picked
  // for Tethyr itself (Site appearance scales --spacing on <html>).
  style["--spacing"] = "0.25rem";

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

/**
 * The light/dark mode a profile renders in. Following the visitor is the
 * default; "theme" keeps the palette in its own mode — the atmosphere's if
 * one is set, else the page theme's. A profile with no palette of its own
 * (Tethyr Default, no atmosphere) always follows the visitor.
 */
export function profileScheme(
  config: StudioConfig | null | undefined,
  pageThemeTokens: ThemeTokens | null | undefined,
  visitor: "light" | "dark",
): "light" | "dark" {
  if (!config || config.colorMode !== "theme") return visitor;
  return (
    naturalScheme(studioConfigToThemeTokens(config)) ?? naturalScheme(pageThemeTokens) ?? visitor
  );
}
