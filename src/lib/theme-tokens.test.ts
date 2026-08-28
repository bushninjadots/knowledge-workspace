import { describe, it, expect } from "vitest";
import { themeTokensToVars, themeTokensToStyle } from "@/lib/theme-tokens";
import type { ThemeTokens } from "@/lib/page-blocks";

describe("themeTokensToVars", () => {
  it("returns empty object for empty tokens", () => {
    expect(themeTokensToVars({})).toEqual({});
  });

  it("emits standard color tokens directly", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#ffffff", foreground: "#1a1a1a" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--background"]).toBe("#ffffff");
    expect(vars["--foreground"]).toBe("#1a1a1a");
  });

  it("skips empty color values", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#ffffff", foreground: "" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--background"]).toBe("#ffffff");
    expect(vars["--foreground"]).toBeUndefined();
  });

  it("emits custom color keys not in the standard set", () => {
    const tokens: ThemeTokens = {
      colors: { "my-custom": "#ff0000" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--my-custom"]).toBe("#ff0000");
  });

  it("maps heading font to --font-display and --font-title", () => {
    const tokens: ThemeTokens = {
      typography: { headingFont: "Space Grotesk" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--font-display"]).toBe("Space Grotesk");
    expect(vars["--font-title"]).toBe("Space Grotesk");
  });

  it("maps body font to --font-sans", () => {
    const tokens: ThemeTokens = {
      typography: { bodyFont: "Inter" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--font-sans"]).toBe("Inter");
  });

  it("maps mono font to --font-mono", () => {
    const tokens: ThemeTokens = {
      typography: { monoFont: "JetBrains Mono" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--font-mono"]).toBe("JetBrains Mono");
  });

  it("emits spacing tokens with --spacing- prefix", () => {
    const tokens: ThemeTokens = {
      spacing: { section: "2rem", block: "1rem" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--spacing-section"]).toBe("2rem");
    expect(vars["--spacing-block"]).toBe("1rem");
  });

  it("emits radius tokens mapped to correct CSS vars", () => {
    const tokens: ThemeTokens = {
      borders: { radius: { sm: "2px", md: "4px", lg: "8px" } },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--radius-sm"]).toBe("2px");
    expect(vars["--radius-md"]).toBe("4px");
    expect(vars["--radius-lg"]).toBe("8px");
  });

  it("emits shadow tokens with --shadow- prefix", () => {
    const tokens: ThemeTokens = {
      shadows: { card: "0 1px 3px rgba(0,0,0,0.1)" },
    };
    const vars = themeTokensToVars(tokens);
    expect(vars["--shadow-card"]).toBe("0 1px 3px rgba(0,0,0,0.1)");
  });

  it("derives contrast tokens from a dark theme palette", () => {
    const vars = themeTokensToVars({
      colors: { background: "#0d0221", foreground: "#f0e6ff" },
    });

    expect(vars["--muted"]).toBe(
      "color-mix(in oklab, #f0e6ff 8%, #0d0221)",
    );
    expect(vars["--muted-foreground"]).toBe(
      "color-mix(in oklab, #f0e6ff 70%, #0d0221)",
    );
    expect(vars["--card"]).toBe("#0d0221");
    expect(vars["--card-foreground"]).toBe("#f0e6ff");
    expect(vars["--primary"]).toBe("#f0e6ff");
    expect(vars["--primary-foreground"]).toBe("#0d0221");
    expect(vars["--input"]).toBe(
      "color-mix(in oklab, #f0e6ff 18%, #0d0221)",
    );
    expect(vars["--trust-subtle"]).toBe(
      "color-mix(in oklab, var(--trust) 16%, #0d0221)",
    );
  });

  it("preserves explicitly supplied contrast tokens", () => {
    const vars = themeTokensToVars({
      colors: {
        background: "#111111",
        foreground: "#eeeeee",
        card: "#222222",
        muted: "#333333",
        primary: "#ff00aa",
      },
    });

    expect(vars["--card"]).toBe("#222222");
    expect(vars["--muted"]).toBe("#333333");
    expect(vars["--primary"]).toBe("#ff00aa");
    expect(vars["--primary-foreground"]).toBe("#111111");
  });

  it("handles full token set with all categories", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#000", foreground: "#fff" },
      typography: { bodyFont: "Inter" },
      spacing: { gap: "1rem" },
      borders: { radius: { lg: "8px" } },
      shadows: { lift: "0 4px 12px" },
    };
    const vars = themeTokensToVars(tokens);
    expect(Object.keys(vars).length).toBeGreaterThanOrEqual(5);
  });
});

describe("themeTokensToStyle", () => {
  it("returns a CSSProperties-compatible object", () => {
    const tokens: ThemeTokens = {
      colors: { background: "#fff" },
    };
    const style = themeTokensToStyle(tokens);
    expect(style).toHaveProperty("--background", "#fff");
  });
});
