// ── Studio Config Tests ───────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  DEFAULT_STUDIO_CONFIG,
  normalizeStudioConfig,
  studioConfigToStyle,
  studioConfigToThemeTokens,
  RADIUS_OPTIONS,
  TYPOGRAPHY_OPTIONS,
  DENSITY_OPTIONS,
  ACCENT_OPTIONS,
} from "@/lib/studio-config";

describe("normalizeStudioConfig", () => {
  it("returns the full default config for null / garbage input", () => {
    expect(normalizeStudioConfig(null)).toEqual(DEFAULT_STUDIO_CONFIG);
    expect(normalizeStudioConfig(undefined)).toEqual(DEFAULT_STUDIO_CONFIG);
    expect(normalizeStudioConfig("nope")).toEqual(DEFAULT_STUDIO_CONFIG);
    expect(normalizeStudioConfig(42)).toEqual(DEFAULT_STUDIO_CONFIG);
  });

  it("keeps valid values and drops invalid ones to defaults", () => {
    const raw: Record<string, unknown> = {
      personalityId: "minimal",
      radius: "rounded",
      typography: "bogus", // invalid → default
      density: "compact",
      accentMode: "person",
      accentColor: "#123456",
    };
    expect(normalizeStudioConfig(raw)).toEqual({
      personalityId: "minimal",
      radius: "rounded",
      typography: DEFAULT_STUDIO_CONFIG.typography,
      density: "compact",
      accentMode: "person",
      accentColor: "#123456",
    });
  });

  it("rejects malformed accent colors and empty personality ids", () => {
    const raw = { accentColor: "not-a-color", personalityId: "" };
    expect(normalizeStudioConfig(raw).accentColor).toBeNull();
    expect(normalizeStudioConfig(raw).personalityId).toBeNull();
  });
});

describe("studioConfigToThemeTokens", () => {
  it("maps every radius treatment to the full radius scale", () => {
    expect(studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, radius: "sharp" }).borders?.radius)
      .toMatchInlineSnapshot(`
        {
          "2xl": "4px",
          "3xl": "5px",
          "4xl": "6px",
          "lg": "3px",
          "md": "2px",
          "sm": "1px",
          "xl": "4px",
        }
      `);
    expect(
      studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, radius: "rounded" }).borders?.radius,
    ).toMatchInlineSnapshot(`
        {
          "2xl": "14px",
          "3xl": "16px",
          "4xl": "18px",
          "lg": "8px",
          "md": "6px",
          "sm": "4px",
          "xl": "12px",
        }
      `);
  });

  it("maps density to a section spacing token", () => {
    expect(
      studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, density: "spacious" }).spacing,
    ).toEqual({ section: "6rem" });
    expect(
      studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, density: "compact" }).spacing,
    ).toEqual({ section: "2.5rem" });
  });

  it("editorial enables the Space Grotesk display stack and display-scale heading", () => {
    const tokens = studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, typography: "editorial" });
    expect(tokens.typography?.headingFont).toContain("Space Grotesk");
    expect(tokens.typography?.scale?.heading1).toEqual({
      fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
      lineHeight: "1.05",
      fontWeight: "600",
    });
  });

  it("classic down-shifts the display scale without changing fonts", () => {
    const tokens = studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, typography: "classic" });
    expect(tokens.typography?.headingFont).toBeUndefined();
    expect(tokens.typography?.scale?.heading1?.fontSize).toBe("clamp(1.875rem, 3.5vw, 2.5rem)");
  });

  it("modern leaves typography untouched", () => {
    expect(
      studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, typography: "modern" }).typography,
    ).toBeUndefined();
  });
});

describe("studioConfigToStyle", () => {
  it("sets density gutters per density", () => {
    const style = studioConfigToStyle({ ...DEFAULT_STUDIO_CONFIG, density: "spacious" }) as Record<
      string,
      string
    >;
    expect(style["--content-density-gap"]).toBe("1.5rem");
    expect(style["--content-density-padding"]).toBe("1.5rem");
  });

  it("emits the accent family for person mode with readable foreground", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      accentMode: "person",
      accentColor: "#6d28d9",
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#6d28d9");
    expect(style["--user-accent-foreground"]).toBe("#ffffff");
    expect(style["--user-accent-subtle"]).toContain("6d28d9");
  });

  it("light accents get a dark foreground", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      accentMode: "person",
      accentColor: "#e2e8f0",
    }) as Record<string, string>;
    expect(style["--user-accent-foreground"]).toBe("#1f2328");
  });

  it("'none' neutralizes the accent family on primary", () => {
    const style = studioConfigToStyle({ ...DEFAULT_STUDIO_CONFIG, accentMode: "none" }) as Record<
      string,
      string
    >;
    expect(style["--user-accent"]).toBe("var(--primary)");
  });

  it("'auto' leaves the accent family untouched", () => {
    const style = studioConfigToStyle({ ...DEFAULT_STUDIO_CONFIG }) as Record<string, string>;
    expect(style["--user-accent"]).toBeUndefined();
  });
});

describe("option catalogs", () => {
  it("enumerate every treatment value exactly once", () => {
    const values = <T extends string>(opts: ReadonlyArray<{ value: T; label: string }>) =>
      opts.map((o) => o.value);
    expect(values(RADIUS_OPTIONS)).toEqual(["sharp", "soft", "rounded"]);
    expect(values(TYPOGRAPHY_OPTIONS)).toEqual(["editorial", "modern", "classic"]);
    expect(values(DENSITY_OPTIONS)).toEqual(["compact", "comfortable", "spacious"]);
    expect(values(ACCENT_OPTIONS)).toEqual(["auto", "person", "none"]);
  });
});
