// ── Per-block frame ──────────────────────────────────────────────────────────────
// A block's own frame on top of the page look: shape and radius, inset, fill and
// border. blockFrameStyle turns a block instance into its inline style.

import type { BlockShape, LayoutBlockInstance } from "@/lib/page-blocks";
import { SHADOWS } from "./studio-config";
import { blockTitleOverride } from "./studio-config-style";

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
  if (padding) {
    style["--studio-block-padding"] = padding;
    // The bottom side alone, for frames that add room at their foot.
    style["--studio-block-pb"] =
      `calc(var(--studio-block-inset, 1rem) + ${SHAPE_PADDING[shape!]![2]})`;
  }
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
