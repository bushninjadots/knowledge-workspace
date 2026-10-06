import { describe, expect, it } from "vitest";
import "@/components/tethyr/blocks/register-all";
import type { LayoutSection } from "@/lib/page-blocks";
import { fitGridItemToContent, reflowAroundHidden, sectionLabel } from "./studio-grid";

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

  it("names an untitled section after its first block", () => {
    expect(
      sectionLabel(
        section({
          blocks: [
            { id: "b", type: "profile-tools", position: 1, config: {}, visible: true },
            { id: "a", type: "profile-gallery", position: 0, config: {}, visible: true },
          ],
        }),
      ),
    ).toBe("Gallery area");
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

describe("reflowAroundHidden", () => {
  const row = [
    { i: "a", x: 0, y: 0, w: 6, h: 3 },
    { i: "b", x: 6, y: 0, w: 6, h: 3 },
    { i: "c", x: 0, y: 3, w: 4, h: 3 },
    { i: "d", x: 4, y: 3, w: 4, h: 3 },
    { i: "e", x: 8, y: 3, w: 4, h: 3 },
    { i: "f", x: 0, y: 6, w: 6, h: 3 },
  ];

  it("lets a lone survivor take the whole row", () => {
    expect(reflowAroundHidden(row, new Set(["b"])).get("a")).toEqual({ x: 0, w: 12 });
  });

  it("shares a row between survivors by their widths", () => {
    const out = reflowAroundHidden(row, new Set(["d"]));
    expect(out.get("c")).toEqual({ x: 0, w: 6 });
    expect(out.get("e")).toEqual({ x: 6, w: 6 });
  });

  it("keeps rows that lost nothing, gaps included", () => {
    const out = reflowAroundHidden(row, new Set(["b"]));
    expect(out.get("f")).toEqual({ x: 0, w: 6 });
    expect(out.get("d")).toEqual({ x: 4, w: 4 });
  });
});
