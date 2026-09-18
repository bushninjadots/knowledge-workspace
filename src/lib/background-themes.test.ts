import { describe, expect, it } from "vitest";
import {
  backgroundStyle,
  clampStrength,
  imageOpacityFor,
  isBackgroundActive,
  accentVarsFromColor,
  ownerAccentStyle,
  appearanceStyle,
  BANNER_OVERLAYS,
  bannerOverlayStyle,
  normalizeBannerOverlay,
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
    expect(
      isBackgroundActive({
        mode: "gradient",
        color: null,
        pattern: null,
        gradient: "ocean",
        image_url: null,
      }),
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

  it("follows the banner colour when the tint source is the banner", () => {
    const style = backgroundStyle(
      { mode: "color", color: null, colorSource: "banner", pattern: null, image_url: null },
      null,
      "rgb(20, 40, 60)",
    );
    expect(style.backgroundColor).toContain(
      `color-mix(in oklab, rgb(20, 40, 60) ${BACKGROUND_DEFAULT_STRENGTH}%, var(--background))`,
    );
  });

  it("falls back to the stored colour until the banner colour resolves", () => {
    const style = backgroundStyle(
      { mode: "color", color: "#38bdf8", colorSource: "banner", pattern: null, image_url: null },
      null,
      null,
    );
    expect(style.backgroundColor).toContain("#38bdf8");
  });

  it("uses the plain theme background for a banner tint with no colour to fall back on", () => {
    const style = backgroundStyle({
      mode: "color",
      color: null,
      colorSource: "banner",
      pattern: null,
      image_url: null,
    });
    expect(style.backgroundColor).toBe("var(--background)");
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

  it("renders a gradient over the theme background at the chosen strength", () => {
    const style = backgroundStyle({
      mode: "gradient",
      color: null,
      pattern: null,
      gradient: "ocean",
      image_url: null,
    });
    expect(style.backgroundColor).toBe("var(--background)");
    expect(style.backgroundImage).toContain("linear-gradient(135deg");
    expect(style.backgroundImage).toContain("#38bdf8");
    expect(style.backgroundImage).toContain("#2dd4bf");
    expect(style.backgroundImage).toContain(`${BACKGROUND_DEFAULT_STRENGTH}%`);
  });

  it("scales a gradient with the chosen strength", () => {
    const bold = backgroundStyle({
      mode: "gradient",
      color: null,
      pattern: null,
      gradient: "tethyr",
      image_url: null,
      strength: BACKGROUND_MAX_STRENGTH,
    });
    expect(bold.backgroundImage).toContain("#8250df");
    expect(bold.backgroundImage).toContain(`${BACKGROUND_MAX_STRENGTH}%`);
  });

  it("falls back to the tinted base when a gradient id is unknown", () => {
    const style = backgroundStyle({
      mode: "gradient",
      color: "#38bdf8",
      pattern: null,
      gradient: "not-a-gradient",
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

describe("accentVarsFromColor", () => {
  it("derives the full accent variable family from a hex colour", () => {
    const vars = accentVarsFromColor("#2dd4bf");
    expect(vars["--user-accent"]).toBe("#2dd4bf");
    expect(vars["--user-accent-subtle"]).toBe("color-mix(in oklab, #2dd4bf 10%, transparent)");
    expect(vars["--user-accent-border"]).toBe("color-mix(in oklab, #2dd4bf 30%, transparent)");
    expect(vars["--user-accent-glow"]).toBe("color-mix(in oklab, #2dd4bf 6%, transparent)");
    expect(vars["--user-accent-foreground"]).toBeTruthy();
  });

  it("returns no styles for an invalid colour", () => {
    expect(accentVarsFromColor("#fff")).toEqual({});
    expect(accentVarsFromColor("grey")).toEqual({});
    expect(accentVarsFromColor("")).toEqual({});
  });
});

describe("ownerAccentStyle", () => {
  it("prefers an explicit custom accent over the background colour", () => {
    const style = ownerAccentStyle({
      mode: "color",
      color: "#38bdf8",
      accentMode: "custom",
      accentColor: "#6d28d9",
      pattern: null,
      image_url: null,
    });
    expect(style["--user-accent"]).toBe("#6d28d9");
  });

  it("falls back to the background colour for the owner's signature", () => {
    const style = ownerAccentStyle({
      mode: "color",
      color: "#2dd4bf",
      pattern: null,
      image_url: null,
    });
    expect(style["--user-accent"]).toBe("#2dd4bf");
  });

  it("returns no styles without a background or colour", () => {
    expect(ownerAccentStyle(null)).toEqual({});
    expect(ownerAccentStyle(undefined)).toEqual({});
    expect(ownerAccentStyle({ mode: null, color: null, pattern: null, image_url: null })).toEqual(
      {},
    );
  });
});

describe("appearanceStyle accent fallback", () => {
  it("keeps an explicit custom accent untouched", () => {
    const style = appearanceStyle({
      mode: "color",
      color: "#38bdf8",
      accentMode: "custom",
      accentColor: "#6d28d9",
      pattern: null,
      image_url: null,
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#6d28d9");
  });

  it("adopts the member's own colour when no accent preference is set", () => {
    const style = appearanceStyle({
      mode: "color",
      color: "#2dd4bf",
      pattern: null,
      image_url: null,
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBe("#2dd4bf");
  });

  it("skips the fallback when the tint follows the banner", () => {
    const style = appearanceStyle({
      mode: "color",
      color: "#38bdf8",
      colorSource: "banner",
      pattern: null,
      image_url: null,
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBeUndefined();
  });

  it("skips the fallback when an explicit accent mode is set", () => {
    const style = appearanceStyle({
      mode: "color",
      color: "#38bdf8",
      accentMode: "dynamic",
      pattern: null,
      image_url: null,
    }) as Record<string, string>;
    expect(style["--user-accent"]).toBeUndefined();
  });

  it("returns no styles for a cleared background", () => {
    expect(appearanceStyle(null)).toEqual({});
    expect(appearanceStyle(undefined)).toEqual({});
  });
});

describe("bannerOverlayStyle", () => {
  it("returns null only for the none treatment", () => {
    expect(bannerOverlayStyle("none")).toBeNull();
    for (const option of BANNER_OVERLAYS) {
      if (option.id === "none") continue;
      expect(bannerOverlayStyle(option.id), option.id).not.toBeNull();
    }
  });

  it("carries a bottom-anchored caption zone in every non-none treatment", () => {
    // Captions can sit left/center/right near the bottom edge — every
    // treatment must darken that zone, not just the treatments designed for it.
    for (const option of BANNER_OVERLAYS) {
      if (option.id === "none") continue;
      const style = bannerOverlayStyle(option.id) as Record<string, string>;
      const layers = [style.backgroundImage, style.backgroundColor].filter(Boolean).join(", ");
      expect(layers, option.id).toMatch(/background/);
      expect(layers, option.id).toContain("to top");
    }
  });

  it("stacks layered treatments so their effects compose", () => {
    const duotone = bannerOverlayStyle("duotone") as Record<string, string>;
    expect(duotone.backgroundImage?.split("), linear")).not.toBeNull();
    // duotone = bottom anchor over the accent gradient, plus a faint wash
    expect(duotone.backgroundImage).toMatch(/^linear-gradient\(to top/);
    expect(duotone.backgroundColor).toBeTruthy();

    const spotlight = bannerOverlayStyle("spotlight") as Record<string, string>;
    // spotlight = bottom anchor layered over the radial lift
    expect(spotlight.backgroundImage).toMatch(/radial-gradient\(/);
    expect(spotlight.backgroundImage?.split("radial-gradient").length).toBe(2);
  });

  it("keeps the scrim purely a bottom fade (no extra wash needed)", () => {
    const scrim = bannerOverlayStyle("scrim") as Record<string, string>;
    expect(scrim.backgroundColor).toBeUndefined();
    expect(scrim.backgroundImage).toMatch(/to top/);
  });

  it("falls back to soft for unknown or legacy values", () => {
    expect(normalizeBannerOverlay("mysterious-2019")).toBe("soft");
    expect(normalizeBannerOverlay(null)).toBe("soft");
    const style = bannerOverlayStyle("mysterious-2019") as Record<string, string>;
    expect(style.backgroundColor).toContain("20%");
  });
});
