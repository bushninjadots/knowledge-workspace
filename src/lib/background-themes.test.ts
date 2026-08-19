import { describe, expect, it } from "vitest";
import { backgroundStyle, isBackgroundActive } from "./background-themes";

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

  it("mixes a colour choice into the theme background", () => {
    const style = backgroundStyle({
      mode: "color",
      color: "#38bdf8",
      pattern: null,
      image_url: null,
    });
    expect(style.backgroundColor).toContain("color-mix(in oklab, #38bdf8 14%, var(--background))");
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
