import { describe, expect, it } from "vitest";
import type { LayoutSection } from "@/lib/page-blocks";
import { fitGridItemToContent, sectionLabel } from "./studio-grid";

const section = (patch: Partial<LayoutSection>) =>
  ({ id: "s1", layout: "full", blocks: [], ...patch }) as LayoutSection;

describe("sectionLabel", () => {
  it("uses the section's own title", () => {
    expect(sectionLabel(section({ title: "Featured Work" }))).toBe("Featured Work");
  });

  it("names untitled sections in words, never by layout id", () => {
    expect(sectionLabel(section({ layout: "feature" }))).toBe("Featured area");
    expect(sectionLabel(section({ layout: "two_column" }))).toBe("Two-column area");
  });

  it("treats a blank title as untitled", () => {
    expect(sectionLabel(section({ title: "   ", layout: "full" }))).toBe("Full-width area");
  });
});

describe("fitGridItemToContent", () => {
  // rowHeight 24 + margin 14: a row is 38px, so n rows hold (38n - 14)px.
  const grid = [
    { i: "a", x: 0, y: 0, w: 6, h: 10, minH: 2 },
    { i: "b", x: 0, y: 10, w: 6, h: 3, minH: 2 },
  ];

  it("shrinks a frame taller than its content", () => {
    expect(fitGridItemToContent(grid, "a", 100, 24, 14)?.[0].h).toBe(3);
  });

  it("grows a frame and pushes the block below out of the way", () => {
    const fitted = fitGridItemToContent(grid, "a", 600, 24, 14);
    expect(fitted?.[0].h).toBe(17);
    expect(fitted?.[1].y).toBe(17);
  });

  it("returns null when the frame already fits", () => {
    expect(fitGridItemToContent(grid, "a", 38 * 10 - 14, 24, 14)).toBeNull();
  });

  it("never shrinks below the block's minimum", () => {
    expect(fitGridItemToContent(grid, "a", 5, 24, 14)?.[0].h).toBe(2);
  });
});
