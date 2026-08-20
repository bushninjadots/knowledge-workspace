import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundLayer } from "./background-layer";
import { appearanceStyle, hasAppearanceSettings } from "@/lib/background-themes";

describe("BackgroundLayer", () => {
  it("renders nothing when there is no active background", () => {
    const { container } = render(<BackgroundLayer background={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a tinted backdrop for a colour choice", () => {
    const { container } = render(
      <BackgroundLayer
        background={{ mode: "color", color: "#38bdf8", pattern: null, image_url: null }}
      />,
    );
    const layer = container.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.className).toContain("pointer-events-none");
    expect(layer.style.backgroundColor).toContain("color-mix");
  });

  it("renders the pattern layers for a pattern choice", () => {
    const { container } = render(
      <BackgroundLayer
        background={{ mode: "pattern", color: "#a78bfa", pattern: "diagonal", image_url: null }}
      />,
    );
    const layer = container.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(layer.style.backgroundImage).toContain("repeating-linear-gradient");
  });

  it("renders the gradient for a gradient choice", () => {
    const { container } = render(
      <BackgroundLayer
        background={{
          mode: "gradient",
          color: null,
          pattern: null,
          gradient: "ocean",
          image_url: null,
        }}
      />,
    );
    const layer = container.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(layer.style.backgroundImage).toContain("linear-gradient(135deg");
    // jsdom normalises the color-mix ends to rgb.
    expect(layer.style.backgroundImage).toContain("rgb(56, 189, 248)");
    expect(layer.style.backgroundColor).toBe("var(--background)");
  });

  it("dims uploaded images to wallpaper level", () => {
    const { container } = render(
      <BackgroundLayer
        background={{ mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" }}
        imageUrl="https://cdn.example/bg.jpg"
      />,
    );
    const layer = container.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(layer.style.backgroundImage).toContain("https://cdn.example/bg.jpg");
    expect(layer.style.backgroundSize).toBe("cover");
    expect(layer.style.opacity).toBe("0.55");
  });

  it("scales image dimming with the chosen strength", () => {
    const { container } = render(
      <BackgroundLayer
        background={{
          mode: "image",
          color: null,
          pattern: null,
          image_url: "u/bg.jpg",
          strength: 60,
        }}
        imageUrl="https://cdn.example/bg.jpg"
      />,
    );
    const layer = container.querySelector("[aria-hidden=true]") as HTMLElement;
    expect(layer.style.opacity).toBe("0.75");
  });

  it("persists and applies card border and custom accent preferences", () => {
    const appearance = {
      mode: null,
      color: null,
      pattern: null,
      image_url: null,
      cardBorders: "none" as const,
      accentMode: "custom" as const,
      accentColor: "#ff006e",
    };
    expect(hasAppearanceSettings(appearance)).toBe(true);
    const style = appearanceStyle(appearance) as Record<string, string>;
    expect(style["--card-border-color"]).toBe("transparent");
    expect(style["--user-accent"]).toBe("#ff006e");
    expect(style["--user-accent-foreground"]).toBe("#ffffff");
  });

  it("keeps default appearance quiet for older background rows", () => {
    const appearance = { mode: null, color: null, pattern: null, image_url: null };
    expect(hasAppearanceSettings(appearance)).toBe(false);
    expect(
      (appearanceStyle(appearance) as Record<string, string>)["--card-border-color"],
    ).toBeDefined();
  });

  it("renders nothing when an image has no resolved URL", () => {
    const { container } = render(
      <BackgroundLayer
        background={{ mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
