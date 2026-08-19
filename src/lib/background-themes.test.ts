import { describe, expect, it } from "vitest";
import {
  backgroundStyle,
  clampStrength,
  imageOpacityFor,
  isBackgroundActive,
  BACKGROUND_DEFAULT_STRENGTH,
  BACKGROUND_MAX_STRENGTH,
  BACKGROUND_MIN_STRENGTH,
} from "./background-themes";

describe("isBackgroundActive", () => {
  it("returns false for null, undefined, or a cleared background", () => {
    expect(isBackgroundActive(null)).toBe(false);
    expect(isBackgroundActive(undefined)).toBe(false);
    expect(isBackgroundActive({ mode: null, color: null, pattern: null, image_url: null })).toBe(
      false,
    );
  });

  it("returns true for any active mode", () => {
    expect(
      isBackgroundActive({ mode: "color", color: "#38bdf8", pattern: null, image_url: null }),
    ).toBe(true);
    expect(
      isBackgroundActive({ mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" }),
    ).toBe(true);
  });
});

describe("backgroundStyle", () => {
  it("returns no styles for an inactive background", () => {
    expect(backgroundStyle(null)).toEqual({});
    expect(backgroundStyle({ mode: null, color: null, pattern: null, image_url: null })).toEqual(
      {},
    );
  });

  it("mixes a colour choice into the theme background at the default strength", () => {
    const style = backgroundStyle({
      mode: "color",
      color: "#38bdf8",
      pattern: null,
      image_url: null,
    });
    expect(style.backgroundColor).toContain(
      `color-mix(in oklab, #38bdf8 ${BACKGROUND_DEFAULT_STRENGTH}%, var(--background))`,
    );
  });

  it("scales the tint with the chosen strength", () => {
    const subtle = backgroundStyle({
      mode: "color",
      color: "#38bdf8",
      pattern: null,
      image_url: null,
      strength: BACKGROUND_MIN_STRENGTH,
    });
    const bold = backgroundStyle({
      mode: "color",
      color: "#38bdf8",
      pattern: null,
      image_url: null,
      strength: BACKGROUND_MAX_STRENGTH,
    });
    expect(subtle.backgroundColor).toContain(
      `color-mix(in oklab, #38bdf8 ${BACKGROUND_MIN_STRENGTH}%, var(--background))`,
    );
    expect(bold.backgroundColor).toContain(
      `color-mix(in oklab, #38bdf8 ${BACKGROUND_MAX_STRENGTH}%, var(--background))`,
    );
  });

  it("clamps out-of-range strengths into the allowed band", () => {
    expect(clampStrength(5)).toBe(BACKGROUND_MIN_STRENGTH);
    expect(clampStrength(200)).toBe(BACKGROUND_MAX_STRENGTH);
    expect(clampStrength(undefined)).toBe(BACKGROUND_DEFAULT_STRENGTH);
    expect(clampStrength(null)).toBe(BACKGROUND_DEFAULT_STRENGTH);
  });

  it("scales image dimming with strength while never going fully opaque", () => {
    expect(imageOpacityFor(undefined)).toBe(0.55);
    expect(imageOpacityFor(BACKGROUND_MAX_STRENGTH)).toBe(0.75);
    expect(imageOpacityFor(BACKGROUND_MIN_STRENGTH)).toBe(0.35);
    const mid = imageOpacityFor((BACKGROUND_MIN_STRENGTH + BACKGROUND_MAX_STRENGTH) / 2);
    expect(mid).toBeGreaterThan(0.35);
    expect(mid).toBeLessThan(0.75);
  });

  it("renders a pattern over the tinted base", () => {
    const style = backgroundStyle({
      mode: "pattern",
      color: "#a78bfa",
      pattern: "dots",
      image_url: null,
    });
    expect(style.backgroundImage).toContain("radial-gradient");
    expect(style.backgroundSize).toBe("22px 22px");
    expect((style as Record<string, string>)["--bg-pattern-color"]).toBeTruthy();
  });

  it("uses the plain theme background for a pattern without a colour", () => {
    const style = backgroundStyle({
      mode: "pattern",
      color: null,
      pattern: "grid",
      image_url: null,
    });
    expect(style.backgroundColor).toBe("var(--background)");
  });

  it("falls back to the tinted base when a pattern id is unknown", () => {
    const style = backgroundStyle({
      mode: "pattern",
      color: "#38bdf8",
      pattern: "not-a-pattern",
      image_url: null,
    });
    expect(style.backgroundColor).toContain("color-mix");
    expect(style.backgroundImage).toBeUndefined();
  });

  it("renders an image as a cover background", () => {
    const style = backgroundStyle(
      { mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" },
      "https://cdn.example/u/bg.jpg",
    );
    expect(style.backgroundImage).toBe('url("https://cdn.example/u/bg.jpg")');
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundRepeat).toBe("no-repeat");
  });

  it("returns no styles for an image without a resolved URL", () => {
    expect(
      backgroundStyle({ mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" }),
    ).toEqual({});
  });
});
