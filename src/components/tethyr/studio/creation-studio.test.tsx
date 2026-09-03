import { describe, expect, it } from "vitest";
import { insertDuplicateGridItem, sectionGrid } from "@/components/tethyr/studio/creation-studio";
import type { LayoutSection } from "@/lib/page-blocks";

function makeSection(overrides: Partial<LayoutSection> = {}): LayoutSection {
  return {
    id: "section-1",
    position: 0,
    layout: "two_column",
    blocks: [
      { id: "a", position: 0, type: "content-text", config: {}, visible: true },
      { id: "b", position: 1, type: "content-text", config: {}, visible: true },
    ],
    ...overrides,
  };
}

describe("Creation Studio grid adapter", () => {
  it("creates stable positions for legacy sections", () => {
    const section = makeSection();
    const first = sectionGrid(section, section.blocks);
    const second = sectionGrid(section, section.blocks);

    expect(first).toEqual(second);
    expect(first.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))).toEqual([
      // Compact default heights (content-text default is 3 rows).
      { i: "a", x: 0, y: 0, w: 6, h: 3 },
      { i: "b", x: 6, y: 0, w: 6, h: 3 },
    ]);
  });

  it("preserves persisted coordinates instead of rebuilding from block order", () => {
    const section = makeSection({
      grid: [
        { i: "a", x: 4, y: 9, w: 3, h: 7 },
        { i: "b", x: 0, y: 0, w: 12, h: 5 },
      ],
    });

    expect(sectionGrid(section, section.blocks)).toEqual([
      { ...section.grid![0], minW: 2, minH: 2 },
      { ...section.grid![1], minW: 2, minH: 2 },
    ]);
  });

  it("adds a duplicate as a separate grid item beside its source", () => {
    const grid = [{ i: "a", x: 0, y: 2, w: 4, h: 6, minW: 2, minH: 2 }];

    expect(insertDuplicateGridItem(grid, "a", "copy")).toEqual([
      grid[0],
      { i: "copy", x: 4, y: 2, w: 4, h: 6, minW: 2, minH: 2 },
    ]);
  });
});
