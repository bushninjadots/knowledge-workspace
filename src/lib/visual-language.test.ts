import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_CONFIG,
  normalizeStudioConfig,
  profileScheme,
  studioConfigToThemeTokens,
  studioSurfaceStyle,
  type StudioConfig,
} from "./studio-config";
import {
  ORIGINAL_LOOK,
  SHAPE_RADIUS,
  VISUAL_LANGUAGES,
  atmosphereColors,
  chooseVisualLanguage,
  isGroupModified,
  isLookModified,
  lookLabel,
  mixHex,
  normalizeLook,
  resetLookGroup,
  resolveLook,
  resolveTitles,
  setLookValue,
} from "./visual-language";
import { naturalScheme } from "./theme-tokens";

const base = (patch: Partial<StudioConfig> = {}): StudioConfig => ({
  ...DEFAULT_STUDIO_CONFIG,
  ...patch,
});
const apply = (config: StudioConfig, patch: Partial<StudioConfig>): StudioConfig => ({
  ...config,
  ...patch,
});

describe("Original (no direction chosen)", () => {
  it("resolves to the look Studios had before visual languages", () => {
    expect(resolveLook(base())).toEqual(ORIGINAL_LOOK);
    expect(lookLabel(base())).toBe("Original");
    expect(isLookModified(base({ radius: 4, blockTitles: "heading" }))).toBe(false);
  });

  it("adds no colours, faces or entrance to an existing Studio", () => {
    const config = normalizeStudioConfig({ personality: "modern", density: "compact" });
    const tokens = studioConfigToThemeTokens(config);
    expect(tokens.colors).toBeUndefined();
    expect(tokens.typography).toBeUndefined();
    const style = studioSurfaceStyle(config) as Record<string, string>;
    expect(style["--studio-enter"]).toBeUndefined();
    expect(style["--studio-card-shadow"]).toBeUndefined();
    expect(style["--studio-label-font"]).toBe("Inter");
  });

  it("keeps the old Rise in switch working as Reveal", () => {
    const config = base({ motion: "rise" });
    expect(resolveLook(config).motion).toBe("reveal");
    expect((studioSurfaceStyle(config) as Record<string, string>)["--studio-enter"]).toContain(
      "studio-rise",
    );
  });
});

describe("choosing a direction", () => {
  it("changes many systems together and stamps the shape's corners", () => {
    const config = apply(base(), chooseVisualLanguage("editorial"));
    const look = resolveLook(config);
    expect(look.typePairing).toBe("editorial");
    expect(look.borders).toBe("underline");
    expect(look.dividers).toBe("line");
    expect(look.details).toBe("editorial");
    expect(config.radius).toBe(SHAPE_RADIUS.geometric);
    expect(resolveTitles(config)).toBe("heading");
    expect(lookLabel(config)).toBe("Editorial");
    expect(studioConfigToThemeTokens(config).typography?.headingFont).toContain("Fraunces");
  });

  it("clears page-wide fine-tunes so the direction shows", () => {
    const tuned = base({ headingFont: "sora", cardShadow: "lifted", look: { borders: "dotted" } });
    const config = apply(tuned, chooseVisualLanguage("technical"));
    expect(config.headingFont).toBeNull();
    expect(config.cardShadow).toBeUndefined();
    expect(config.look).toEqual({});
    expect(isLookModified(config)).toBe(false);
  });

  it("gives every direction a complete, valid look", () => {
    for (const language of VISUAL_LANGUAGES) {
      expect(normalizeLook(language.look)).toEqual(language.look);
    }
  });
});

describe("overrides and resets (Flow 3)", () => {
  it("marks the direction modified and resets one group back to it", () => {
    let config = apply(base(), chooseVisualLanguage("editorial"));
    config = apply(config, setLookValue(config, "borders", "none"));
    expect(resolveLook(config).borders).toBe("none");
    expect(lookLabel(config)).toBe("Editorial · Modified");
    expect(isGroupModified(config, "borders")).toBe(true);
    expect(isGroupModified(config, "typography")).toBe(false);

    config = apply(config, resetLookGroup(config, "borders"));
    expect(resolveLook(config).borders).toBe("underline");
    expect(lookLabel(config)).toBe("Editorial");
  });

  it("choosing the direction's own value is not a modification", () => {
    let config = apply(base(), chooseVisualLanguage("technical"));
    config = apply(config, setLookValue(config, "grid", "technical"));
    expect(isLookModified(config)).toBe(false);
  });

  it("a pairing replaces hand-picked faces; a shape language resets corners", () => {
    let config = apply(base({ headingFont: "sora" }), chooseVisualLanguage("personal"));
    config = apply(config, { headingFont: "manrope" });
    expect(isGroupModified(config, "typography")).toBe(true);
    config = apply(config, setLookValue(config, "typePairing", "swiss"));
    expect(config.headingFont).toBeNull();
    config = apply(config, setLookValue(config, "shapes", "geometric"));
    expect(config.radius).toBe(0);
    config = apply(config, resetLookGroup(config, "shapes"));
    expect(config.radius).toBe(SHAPE_RADIUS.organic);
  });

  it("survives a save and reload", () => {
    let config = apply(base(), chooseVisualLanguage("experimental"));
    config = apply(config, setLookValue(config, "images", "monochrome"));
    const reloaded = normalizeStudioConfig(JSON.parse(JSON.stringify(config)));
    expect(reloaded.visualLanguage).toBe("experimental");
    expect(resolveLook(reloaded).images).toBe("monochrome");
    expect(lookLabel(reloaded)).toBe("Experimental · Modified");
  });

  it("drops unknown values from a stored look", () => {
    expect(normalizeLook({ borders: "zigzag", grid: "technical", nonsense: 1 })).toEqual({
      grid: "technical",
    });
    expect(normalizeStudioConfig({ visualLanguage: "baroque" }).visualLanguage).toBeNull();
  });
});

describe("colour atmosphere", () => {
  it("is a palette through the theme pipeline, carrying the member's accent", () => {
    const config = base({ look: { atmosphere: "warm" }, accentColor: "#2f6fd0" });
    expect(studioConfigToThemeTokens(config).colors).toMatchObject({
      background: "#f7f2ea",
      primary: "#2f6fd0",
    });
  });

  it("leaves the theme's palette alone on Theme", () => {
    expect(atmosphereColors("theme", "#2f6fd0")).toBeNull();
  });

  it("tints Vivid with the accent and quiets Muted's accent", () => {
    expect(atmosphereColors("vivid", "#ff0000")?.background).not.toBe("#fbfbfa");
    expect(atmosphereColors("muted", "#ff0000")?.primary).not.toBe("#ff0000");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("surfaces and motion", () => {
  it("a surface brings its depth unless a shadow was hand-picked", () => {
    const raised = base({ look: { surface: "raised" } });
    expect((studioSurfaceStyle(raised) as Record<string, string>)["--studio-card-shadow"]).toBe(
      "0 2px 4px rgb(0 0 0 / 0.06), 0 14px 36px rgb(0 0 0 / 0.14)",
    );
    const flat = base({ look: { surface: "raised" }, cardShadow: "none" });
    expect(
      (studioSurfaceStyle(flat) as Record<string, string>)["--studio-card-shadow"],
    ).toBeUndefined();
  });

  it("monochrome turns the accent into ink", () => {
    const style = studioSurfaceStyle(base({ look: { accent: "monochrome" } })) as Record<
      string,
      string
    >;
    expect(style["--user-accent"]).toBe("var(--foreground)");
  });
});

describe("a profile's light and dark", () => {
  const obsidian = { colors: { background: "#0b0c0e", foreground: "#e7e9ec" } };
  it("follows each visitor by default", () => {
    expect(profileScheme(base(), obsidian, "light")).toBe("light");
    expect(profileScheme(normalizeStudioConfig({}), obsidian, "dark")).toBe("dark");
  });

  it("keeps the theme's own mode when the owner asks", () => {
    const always = base({ colorMode: "theme" });
    expect(profileScheme(always, obsidian, "light")).toBe("dark");
    // An atmosphere is the palette, so its mode wins over the page theme's.
    expect(profileScheme({ ...always, look: { atmosphere: "warm" } }, obsidian, "dark")).toBe(
      "light",
    );
  });

  it("follows the visitor when there is no palette of its own", () => {
    expect(profileScheme(base({ colorMode: "theme" }), {}, "dark")).toBe("dark");
    expect(naturalScheme({ colors: { background: "#ffffff" } })).toBe("light");
  });

  it("survives a save and reload, and drops junk", () => {
    expect(normalizeStudioConfig({ colorMode: "theme" }).colorMode).toBe("theme");
    expect(normalizeStudioConfig({ colorMode: "night" }).colorMode).toBeUndefined();
  });
});
