import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_APPEARANCE,
  normalizeAccountSiteAppearance,
  normalizeSiteAppearance,
  siteAppearanceVars,
} from "./site-appearance";

describe("site appearance", () => {
  it("changes nothing at its defaults", () => {
    expect(siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE })).toEqual({});
  });

  it("scales the spacing step for density, never type", () => {
    expect(siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, density: "compact" })).toEqual({
      "--spacing": "0.225rem",
    });
    const spacious = siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, density: "spacious" });
    expect(Object.keys(spacious)).toEqual(["--spacing"]);
  });

  it("sets one coherent radius scale for a shape", () => {
    const sharp = siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, shape: "sharp" });
    const rounded = siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, shape: "rounded" });
    for (const key of ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]) {
      expect(parseFloat(sharp[`--radius-${key}`])).toBeLessThan(
        parseFloat(rounded[`--radius-${key}`]),
      );
    }
  });

  it("derives a whole, readable accent family from one colour", () => {
    const light = siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, accent: "#f5d90a" });
    expect(light["--primary"]).toBe("#f5d90a");
    expect(light["--primary-foreground"]).toBe("#111827");
    expect(light["--ring"]).toBe("#f5d90a");
    const dark = siteAppearanceVars({ ...DEFAULT_SITE_APPEARANCE, accent: "#1f2328" });
    expect(dark["--primary-foreground"]).toBe("#ffffff");
    expect(dark["--user-accent-subtle"]).toContain("#1f2328");
  });

  it("drops anything it doesn't recognise", () => {
    expect(
      normalizeSiteAppearance({ density: "tiny", shape: "blob", accent: "red", motion: "fast" }),
    ).toEqual(DEFAULT_SITE_APPEARANCE);
    expect(normalizeSiteAppearance(null)).toEqual(DEFAULT_SITE_APPEARANCE);
  });
});

describe("the account copy", () => {
  it("is null until the member has set something", () => {
    expect(normalizeAccountSiteAppearance(null)).toBeNull();
    expect(normalizeAccountSiteAppearance("x")).toBeNull();
  });

  it("keeps the preset with the appearance and cleans the rest", () => {
    expect(
      normalizeAccountSiteAppearance({ preset: "p1", density: "compact", shape: "blob" }),
    ).toEqual({ ...DEFAULT_SITE_APPEARANCE, density: "compact", preset: "p1" });
    expect(normalizeAccountSiteAppearance({ preset: "" })?.preset).toBeNull();
  });
});
