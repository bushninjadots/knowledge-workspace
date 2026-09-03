// ── Studio Config Tests ───────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  DEFAULT_STUDIO_CONFIG,
  normalizeStudioConfig,
  studioConfigToStyle,
  studioConfigToThemeTokens,
  structureMaxWidth,
  densityMetrics,
  RADIUS_OPTIONS,
  PERSONALITY_OPTIONS,
  STRUCTURE_OPTIONS,
  DENSITY_OPTIONS,
  ACCENT_OPTIONS,
  BACKGROUND_OPTIONS,
  type StudioConfig,
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
      structure: "single",
      personality: "editorial",
      density: "compact",
      radius: "soft",
      accentMode: "custom",
      accentColor: "#123456",
      appBackground: "sunken",
      publicBackground: "surface",
      starterId: "focused",
    };
    expect(normalizeStudioConfig(raw)).toEqual({
      ...raw,
      starterId: "focused",
    });
  });

  it("migrates legacy compositionId → structure, vibeId/personalityId → personality", () => {
    const raw: Record<string, unknown> = {
      compositionId: "sidebar",
      vibeId: "technical",
      accentMode: "person",
      radius: "rounded",
    };
    const config = normalizeStudioConfig(raw);
    expect(config.structure).toBe("sidebar");
    expect(config.personality).toBe("technical");
    expect(config.accentMode).toBe("custom");
    expect(config.radius).toBe("soft");
  });

  it("migrates legacy typography classic → technical", () => {
    const config = normalizeStudioConfig({ typography: "classic" });
    expect(config.personality).toBe("technical");
  });

  it("migrates legacy accentMode person → custom but keeps the color", () => {
    const config = normalizeStudioConfig({ accentMode: "person", accentColor: "#6d28d9" });
    expect(config.accentMode).toBe("custom");
    expect(config.accentColor).toBe("#6d28d9");
  });

  it("rejects malformed accent colors", () => {
    expect(normalizeStudioConfig({ accentColor: "not-a-color" }).accentColor).toBe(
      DEFAULT_STUDIO_CONFIG.accentColor,
    );
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
    expect(studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, radius: "soft" }).borders?.radius)
      .toMatchInlineSnapshot(`
      {
        "2xl": "5px",
        "3xl": "6px",
        "4xl": "8px",
        "lg": "4px",
        "md": "3px",
        "sm": "2px",
        "xl": "5px",
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
    const tokens = studioConfigToThemeTokens({
      ...DEFAULT_STUDIO_CONFIG,
      personality: "editorial",
    });
    expect(tokens.typography?.headingFont).toContain("Space Grotesk");
    expect(tokens.typography?.scale?.heading1).toEqual({
      fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
      lineHeight: "1.05",
      fontWeight: "600",
    });
  });

  it("technical down-shifts the display scale without changing fonts", () => {
    const tokens = studioConfigToThemeTokens({
      ...DEFAULT_STUDIO_CONFIG,
      personality: "technical",
    });
    expect(tokens.typography?.headingFont).toBeUndefined();
    expect(tokens.typography?.scale?.heading1?.fontSize).toBe("clamp(1.875rem, 3.5vw, 2.5rem)");
  });

  it("modern leaves typography untouched", () => {
    expect(
      studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, personality: "modern" }).typography,
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

  it("emits the accent family for custom mode with readable foreground", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      accentMode: "custom",
      accentColor: "#6d28d9",
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#6d28d9");
    expect(style["--user-accent-foreground"]).toBe("#ffffff");
    expect(style["--user-accent-subtle"]).toContain("6d28d9");
  });

  it("light accents get a dark foreground", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      accentMode: "custom",
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

  it("'auto' falls back to primary so the accent family always resolves", () => {
    const style = studioConfigToStyle({ ...DEFAULT_STUDIO_CONFIG }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("var(--primary)");
  });

  it("emits studio tokens for density and radius", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      density: "comfortable",
      radius: "soft",
    }) as Record<string, string>;
    expect(style["--studio-radius"]).toBe("5px");
    expect(style["--studio-gap"]).toBe("14px");
    expect(style["--studio-pad"]).toBe("16px");
  });
});

describe("structureMaxWidth", () => {
  it("caps each structure under the site-wide max-w-7xl so the builder fits alongside chrome", () => {
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "single" })).toBe(768);
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "sidebar" })).toBe(1024);
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "wide" })).toBe(1200);
  });
});

describe("densityMetrics", () => {
  it("returns concrete spacing metrics per density", () => {
    expect(densityMetrics("compact")).toEqual({ gap: 10, pad: 12, rowHeight: 20 });
    expect(densityMetrics("comfortable")).toEqual({ gap: 14, pad: 16, rowHeight: 24 });
    expect(densityMetrics("spacious")).toEqual({ gap: 20, pad: 22, rowHeight: 28 });
  });
});

describe("option catalogs", () => {
  it("enumerate every treatment value exactly once", () => {
    const values = <T extends string>(opts: ReadonlyArray<{ value: T; label: string }>) =>
      opts.map((o) => o.value);
    expect(values(RADIUS_OPTIONS)).toEqual(["sharp", "soft"]);
    expect(values(PERSONALITY_OPTIONS)).toEqual(["editorial", "modern", "technical"]);
    expect(values(STRUCTURE_OPTIONS)).toEqual(["single", "sidebar", "wide"]);
    expect(values(DENSITY_OPTIONS)).toEqual(["compact", "comfortable", "spacious"]);
    expect(values(ACCENT_OPTIONS)).toEqual(["auto", "custom", "none"]);
    expect(values(BACKGROUND_OPTIONS as ReadonlyArray<{ value: string; label: string }>)).toEqual([
      "default",
      "surface",
      "sunken",
    ]);
  });
});

// Keep the type import referenced so TS stays happy.
type _Config = StudioConfig;
void (null as unknown as _Config);
