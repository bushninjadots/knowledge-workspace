import { describe, expect, it } from "vitest";
import { contrastingForeground } from "./dominant-color";

describe("contrastingForeground", () => {
  it("returns white text on a dark colour", () => {
    expect(contrastingForeground("rgb(0, 0, 0)")).toBe("rgb(255, 255, 255)");
  });

  it("returns dark text on a light colour", () => {
    expect(contrastingForeground("rgb(255, 255, 255)")).toBe("rgb(31, 35, 40)");
  });

  it("returns dark text on a mid-luminance accent (light-mode banner case)", () => {
    // ~100 relative luminance — the floor ensureVisible keeps accents at in
    // light mode. Dark text must win here, otherwise white text would fail WCAG.
    expect(contrastingForeground("rgb(96, 100, 104)")).toBe("rgb(31, 35, 40)");
  });

  it("returns null for a missing or unparseable colour", () => {
    expect(contrastingForeground(null)).toBeNull();
    expect(contrastingForeground("not-a-color")).toBeNull();
  });
});
