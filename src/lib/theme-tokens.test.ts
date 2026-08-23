import { describe, it, expect } from "vitest";
import { themeTokensToVars, themeTokensToStyle } from "@/lib/theme-tokens";
import type { ThemeTokens } from "@/lib/page-blocks";

describe("themeTokensToVars", () => {
  it("returns empty object for empty tokens", () => {
    expect(themeTokensToVars({})).toEqual({});
  });

  it("flattens color tokens", () => {
    const tokens: ThemeTokens = {
      colors: {
        background: "#ffffff",
        foreground: "#1a1a1a",
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-colors-background": "#ffffff",
      "--tethyr-theme-colors-foreground": "#1a1a1a",
    });
  });

  it("skips empty color values", () => {
    const tokens: ThemeTokens = {
      colors: {
        background: "#ffffff",
        foreground: "",
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-colors-background": "#ffffff",
    });
  });

  it("flattens typography tokens", () => {
    const tokens: ThemeTokens = {
      typography: {
        headingFont: "Space Grotesk",
        bodyFont: "Inter",
        monoFont: "JetBrains Mono",
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-typography-heading-font": "Space Grotesk",
      "--tethyr-theme-typography-body-font": "Inter",
      "--tethyr-theme-typography-mono-font": "JetBrains Mono",
    });
  });

  it("flattens spacing tokens", () => {
    const tokens: ThemeTokens = {
      spacing: {
        section: "2rem",
        block: "1rem",
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-spacing-section": "2rem",
      "--tethyr-theme-spacing-block": "1rem",
    });
  });

  it("flattens border tokens", () => {
    const tokens: ThemeTokens = {
      borders: {
        style: "solid",
        radius: {
          sm: "2px",
          md: "4px",
        },
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-borders-style": "solid",
      "--tethyr-theme-borders-radius-sm": "2px",
      "--tethyr-theme-borders-radius-md": "4px",
    });
  });

  it("flattens shadow tokens", () => {
    const tokens: ThemeTokens = {
      shadows: {
        card: "0 1px 3px rgba(0,0,0,0.1)",
      },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars).toEqual({
      "--tethyr-theme-shadows-card": "0 1px 3px rgba(0,0,0,0.1)",
    });
  });

  it("handles full token set", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#000" },
      typography: { bodyFont: "Inter" },
      spacing: { gap: "1rem" },
      borders: { radius: { lg: "8px" } },
      shadows: { lift: "0 4px 12px" },
    };
    const vars = themeTokensToVars(tokens);
    expect(Object.keys(vars)).toHaveLength(5);
  });
});

describe("themeTokensToStyle", () => {
  it("returns a CSSProperties-compatible object", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#fff" },
    };
    const style = themeTokensToStyle(tokens);
    expect(style).toHaveProperty("--tethyr-theme-colors-background", "#fff");
  });
});