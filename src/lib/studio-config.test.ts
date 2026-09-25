// ── Studio Config Tests ───────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  blockFrameStyle,
  BLOCK_INSET_DEFAULT_PX,
  DEFAULT_STUDIO_CONFIG,
  normalizeStudioConfig,
  studioConfigToStyle,
  studioConfigToThemeTokens,
  studioBackgroundVars,
  structureMaxWidth,
  densityMetrics,
  RADIUS_MAX,
  RADIUS_MIN,
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
      radius: 12,
      cardBorderWidth: "thin",
      cardColor: "",
      cardOpacity: 30,
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
    expect(config.radius).toBe(12);
  });

  it("normalizes the corner radius to a px number", () => {
    expect(normalizeStudioConfig({ radius: 8 }).radius).toBe(8);
    expect(normalizeStudioConfig({ radius: 99 }).radius).toBe(RADIUS_MAX);
    expect(normalizeStudioConfig({ radius: -5 }).radius).toBe(RADIUS_MIN);
    expect(normalizeStudioConfig({ radius: "sharp" }).radius).toBe(6);
    expect(normalizeStudioConfig({ radius: "soft" }).radius).toBe(12);
    expect(normalizeStudioConfig({ radius: "garbage" }).radius).toBe(DEFAULT_STUDIO_CONFIG.radius);
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
  it("maps every radius value to a proportional full radius scale", () => {
    expect(studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, radius: 6 }).borders?.radius)
      .toMatchInlineSnapshot(`
      {
        "2xl": "8px",
        "3xl": "9px",
        "4xl": "10px",
        "lg": "6px",
        "md": "3px",
        "sm": "2px",
        "xl": "7px",
      }
    `);
    expect(studioConfigToThemeTokens({ ...DEFAULT_STUDIO_CONFIG, radius: 12 }).borders?.radius)
      .toMatchInlineSnapshot(`
      {
        "2xl": "14px",
        "3xl": "15px",
        "4xl": "16px",
        "lg": "12px",
        "md": "5px",
        "sm": "4px",
        "xl": "13px",
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

  it("technical uses the JetBrains Mono display stack and a smaller display scale", () => {
    const tokens = studioConfigToThemeTokens({
      ...DEFAULT_STUDIO_CONFIG,
      personality: "technical",
    });
    expect(tokens.typography?.headingFont).toContain("JetBrains Mono");
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

  it("migrates legacy accentMode auto → dual so banner-led pages stay banner-led", () => {
    const config = normalizeStudioConfig({ accentMode: "auto" });
    expect(config.accentMode).toBe("dual");
  });

  it("'custom' scopes the interactive accent to the picked colour", () => {
    const style = studioConfigToStyle({ ...DEFAULT_STUDIO_CONFIG }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#3f8f8a");
  });

  it("'dual' keeps the picked interactive accent and adds a banner secondary", () => {
    const style = studioConfigToStyle(
      { ...DEFAULT_STUDIO_CONFIG, accentMode: "dual", accentColor: "#6d28d9" },
      "#a78bfa",
    ) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#6d28d9");
    expect(style["--user-accent-secondary"]).toBe("#a78bfa");
    expect(style["--user-accent-secondary-foreground"]).toBe("#1f2328");
    expect(style["--user-accent-secondary-subtle"]).toContain("a78bfa");
    expect(style["--user-accent-secondary-border"]).toContain("a78bfa");
    expect(style["--user-accent-secondary-glow"]).toContain("a78bfa");
  });

  it("'dual' falls back to the picked accent when no banner colour is in scope", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      accentMode: "dual",
      accentColor: "#6d28d9",
    }) as Record<string, string>;
    expect(style["--user-accent-secondary"]).toBe("#6d28d9");
  });

  it("'dual' derives the secondary foreground from an rgb() banner colour", () => {
    const style = studioConfigToStyle(
      { ...DEFAULT_STUDIO_CONFIG, accentMode: "dual", accentColor: "#1f2328" },
      "rgb(240, 245, 250)",
    ) as Record<string, string>;
    expect(style["--user-accent-secondary-foreground"]).toBe("#1f2328");
  });

  it("single-tone modes do not leak a secondary family", () => {
    for (const accentMode of ["custom", "none"] as const) {
      const style = studioConfigToStyle({
        ...DEFAULT_STUDIO_CONFIG,
        accentMode,
        accentColor: "#6d28d9",
      }) as Record<string, string>;
      expect(style["--user-accent-secondary"]).toBeUndefined();
    }
  });

  it("emits the selected card border width", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      cardBorderWidth: "thick",
    }) as Record<string, string>;
    expect(style["--card-border-width"]).toBe("2px");
  });

  it("does not emit a card border colour — that is owned by the member's appearance", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      cardBorderWidth: "thick",
    }) as Record<string, string>;
    expect(style["--card-border-color"]).toBeUndefined();
  });

  it("emits studio tokens for density and radius", () => {
    const style = studioConfigToStyle({
      ...DEFAULT_STUDIO_CONFIG,
      density: "comfortable",
      radius: 12,
    }) as Record<string, string>;
    expect(style["--studio-radius"]).toBe("12px");
    expect(style["--studio-gap"]).toBe("14px");
    expect(style["--studio-pad"]).toBe("16px");
  });
});

describe("studioBackgroundVars", () => {
  it("maps every BackgroundId to its surface variable in the public scope", () => {
    const varsOf = (id: string) =>
      (
        studioBackgroundVars(
          { appBackground: "default", publicBackground: id as StudioConfig["publicBackground"] },
          "public",
        ) as Record<string, string>
      )["--studio-bg"];
    expect(varsOf("default")).toBe("var(--background)");
    expect(varsOf("surface")).toBe("var(--surface)");
    expect(varsOf("sunken")).toBe("var(--surface-sunken)");
  });

  it("reads appBackground in the app scope and publicBackground in the public scope", () => {
    const config = {
      appBackground: "sunken",
      publicBackground: "surface",
    } as Pick<StudioConfig, "appBackground" | "publicBackground">;
    const app = studioBackgroundVars(config, "app") as Record<string, string>;
    const pub = studioBackgroundVars(config, "public") as Record<string, string>;
    expect(app["--studio-bg"]).toBe("var(--surface-sunken)");
    expect(pub["--studio-bg"]).toBe("var(--surface)");
  });

  it("is a pure function of the stored config — identical output on every call", () => {
    const config = {
      appBackground: "surface",
      publicBackground: "sunken",
    } as Pick<StudioConfig, "appBackground" | "publicBackground">;
    const first = JSON.stringify(studioBackgroundVars(config, "public"));
    for (let i = 0; i < 5; i++) {
      expect(JSON.stringify(studioBackgroundVars(config, "public"))).toBe(first);
    }
    // Surviving a persistence round-trip unchanged is what makes the rendered
    // backdrop deterministic: the same stored JSON paints the same colour.
    const roundTripped = JSON.parse(JSON.stringify(config));
    expect(JSON.stringify(studioBackgroundVars(roundTripped, "public"))).toBe(first);
  });
});

describe("structureMaxWidth", () => {
  it("caps each structure under the site-wide max-w-7xl so the builder fits alongside chrome", () => {
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "single" })).toBe(768);
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "sidebar" })).toBe(1024);
    expect(structureMaxWidth({ ...DEFAULT_STUDIO_CONFIG, structure: "wide" })).toBe(1200);
  });
});

describe("blockFrameStyle", () => {
  it("returns nothing for a block without frame overrides", () => {
    expect(blockFrameStyle({})).toEqual({});
    expect(blockFrameStyle({ frameBorder: "default", frameInset: undefined })).toEqual({});
  });

  it("emits the per-block border override", () => {
    const none = blockFrameStyle({ frameBorder: "none" }) as Record<string, string>;
    expect(none["--studio-block-border"]).toBe("none");

    const forced = blockFrameStyle({ frameBorder: "frame" }) as Record<string, string>;
    expect(forced["--studio-block-border"]).toBe(
      "var(--card-border-width, 1px) solid var(--border)",
    );
  });

  it("emits the per-block inset override in px", () => {
    const style = blockFrameStyle({ frameInset: 24 }) as Record<string, string>;
    expect(style["--studio-block-inset"]).toBe("24px");
  });

  it("ignores non-finite insets so the theme value survives", () => {
    expect(blockFrameStyle({ frameInset: Number.NaN })).toEqual({});
  });

  it("keeps the default inset aligned with the CSS fallback", () => {
    // The "Inner spacing" slider seeds from this constant; the CSS fallback in
    // .studio-block is 1rem. They must agree so the slider preview matches the
    // un-customised frame.
    expect(BLOCK_INSET_DEFAULT_PX).toBe(16);
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
    expect(values(PERSONALITY_OPTIONS)).toEqual(["editorial", "modern", "technical"]);
    expect(values(STRUCTURE_OPTIONS)).toEqual(["single", "sidebar", "wide"]);
    expect(values(DENSITY_OPTIONS)).toEqual(["compact", "comfortable", "spacious"]);
    expect(values(ACCENT_OPTIONS)).toEqual(["custom", "dual", "none"]);
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
