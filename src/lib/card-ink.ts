// Readable text on a member-chosen card fill.
//
// The Studio's Card fill can be any swatch at any opacity, but block text uses
// the theme's --foreground / --muted-foreground. On a light theme an Ink or
// Midnight fill left dark text on a dark card (contrast as low as 1.6:1). These
// helpers composite the fill over the page's actual backdrop and pick the ink
// (and a muted ink) that stays readable on the result.

export type Rgb = [number, number, number];

// Theme-like inks first; pure black and white reach mid-tone fills (Teal)
// where the softer inks fall just short of AA.
const INKS: Rgb[] = [
  [31, 35, 40], // #1f2328
  [246, 247, 248], // #f6f7f8
  [0, 0, 0],
  [255, 255, 255],
];
/** WCAG AA for body text. */
const MIN_CONTRAST = 4.5;

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: Rgb) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` at `alpha` (0–1) painted over an opaque `bottom`. */
export function composite(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(top[i] * alpha + bottom[i] * (1 - alpha))) as Rgb;
}

function toHex(rgb: Rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The text colours for a card whose fill is `fillHex` at `opacityPercent`,
 * painted over `backdrop`. Returns null when the fill isn't a custom colour
 * (Auto follows the theme, which already pairs its own text colours).
 */
export function cardInk(
  fillHex: string | undefined,
  opacityPercent: number,
  backdrop: Rgb,
): { ink: string; muted: string; surface: string; border: string } | null {
  const fill = fillHex ? hexToRgb(fillHex) : null;
  if (!fill) return null;
  const alpha = Math.min(100, Math.max(0, opacityPercent)) / 100;
  const surface = composite(fill, alpha, backdrop);
  const score = (color: Rgb) => contrast(color, surface);
  const ink = INKS.reduce((best, candidate) =>
    score(candidate) > score(best) + 0.01 ? candidate : best,
  );
  // Muted text: the ink softened toward the surface, as far as AA allows.
  let muted = ink;
  for (const weight of [0.7, 0.78, 0.86]) {
    const candidate = composite(ink, weight, surface);
    if (score(candidate) >= MIN_CONTRAST) {
      muted = candidate;
      break;
    }
  }
  return {
    ink: toHex(ink),
    muted: toHex(muted),
    // Controls inside the card (outline buttons, inputs) paint --background;
    // give them the card's own surface and a border tuned to the ink.
    surface: toHex(surface),
    border: toHex(composite(ink, 0.22, surface)),
  };
}
