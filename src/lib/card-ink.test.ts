import { describe, expect, it } from "vitest";
import { cardInk, contrast, hexToRgb, type Rgb } from "./card-ink";

const PAPER: Rgb = [251, 251, 249];
const NIGHT: Rgb = [18, 21, 24];
const rgb = (hex: string) => hexToRgb(hex) as Rgb;

describe("cardInk", () => {
  it("leaves Auto (no custom fill) to the theme", () => {
    expect(cardInk("", 30, PAPER)).toBeNull();
    expect(cardInk(undefined, 100, PAPER)).toBeNull();
  });

  it("switches to light ink on a dark fill over a light page", () => {
    const result = cardInk("#1f2328", 100, PAPER)!;
    expect(contrast(rgb(result.ink), rgb(result.surface))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(result.muted), rgb(result.surface))).toBeGreaterThanOrEqual(4.5);
    expect(rgb(result.ink)[0]).toBeGreaterThan(200);
  });

  it("keeps AA on mid-tone fills where the soft inks fall short", () => {
    const result = cardInk("#3f8f8a", 100, PAPER)!;
    expect(contrast(rgb(result.ink), rgb(result.surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("holds AA for translucent fills in both page modes", () => {
    for (const [fill, opacity, page] of [
      ["#0d1117", 30, PAPER],
      ["#1f2328", 30, PAPER],
      ["#ffffff", 30, NIGHT],
      ["#3f8f8a", 60, NIGHT],
      ["#f6f8fa", 100, NIGHT],
    ] as const) {
      const result = cardInk(fill, opacity, page)!;
      const surface = rgb(result.surface);
      expect(contrast(rgb(result.ink), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(result.muted), surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
