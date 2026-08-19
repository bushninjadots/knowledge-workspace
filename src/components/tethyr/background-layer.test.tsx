import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BackgroundLayer } from "./background-layer";

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

  it("renders nothing when an image has no resolved URL", () => {
    const { container } = render(
      <BackgroundLayer
        background={{ mode: "image", color: null, pattern: null, image_url: "u/bg.jpg" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
