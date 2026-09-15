import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProjectCoverFallback } from "./project-cover-fallback";

/**
 * This treatment is shared by every surface that shows a project image, and it
 * has drifted twice: a shelf peek card re-implemented it as a gradient, and the
 * community feed used a trust-tinted tile with a different glyph. These
 * assertions pin the contract — quiet surface, one muted glyph, no decoration —
 * so a new consumer has to change the primitive or visibly fail.
 */
describe("ProjectCoverFallback", () => {
  it("fills its container with the sunken theme surface", () => {
    const { container } = render(
      <div className="relative h-10 w-10">
        <ProjectCoverFallback />
      </div>,
    );

    const surface = container.querySelector(".bg-surface-sunken") as HTMLElement;
    expect(surface).not.toBeNull();
    // Absolute so it fills the cover slot its consumer defines the size of.
    expect(surface.className).toContain("absolute");
    expect(surface.className).toContain("inset-0");
  });

  it("shows one muted project glyph, hidden from assistive tech", () => {
    const { container } = render(<ProjectCoverFallback />);

    const glyphs = container.querySelectorAll("svg");
    expect(glyphs).toHaveLength(1);

    const glyph = glyphs[0];
    expect(glyph.getAttribute("class")).toContain("lucide-folder-kanban");
    expect(glyph.getAttribute("class")).toContain("text-muted-foreground/30");
    // Decorative only — the surrounding card carries the project's name.
    expect(glyph.getAttribute("aria-hidden")).toBe("true");
  });

  it("defaults to the card-sized glyph and accepts a size override", () => {
    const { container: byDefault } = render(<ProjectCoverFallback />);
    expect(byDefault.querySelector("svg")?.getAttribute("class")).toContain("h-6");
    expect(byDefault.querySelector("svg")?.getAttribute("class")).toContain("w-6");

    const { container: small } = render(<ProjectCoverFallback iconClassName="h-4 w-4" />);
    const smallClass = small.querySelector("svg")?.getAttribute("class");
    expect(smallClass).toContain("h-4");
    expect(smallClass).toContain("w-4");
    expect(smallClass).not.toContain("h-6");
  });

  it("stays free of gradients and images", () => {
    const { container } = render(<ProjectCoverFallback />);

    // The fallback must not reintroduce the saturated/animated covers it
    // replaced, nor a fake image slot.
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.innerHTML).not.toContain("bg-gradient");
  });
});
