import { describe, expect, it } from "vitest";
import {
  insertDuplicateGridItem,
  makeHistoryEntry,
  sectionGrid,
  seedGridFromLayout,
} from "@/components/tethyr/studio/creation-studio";
import type { StudioConfig } from "@/lib/studio-config";
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

const studioConfig: StudioConfig = {
  starterId: null,
  structure: "wide",
  personality: "modern",
  density: "comfortable",
  radius: "soft",
  accentMode: "auto",
  accentColor: "#3f8f8a",
  appBackground: "surface",
  publicBackground: "default",
};

describe("Creation Studio history snapshots", () => {
  it("captures appearance before the next config is applied", () => {
    const previous = { ...studioConfig, radius: "sharp" as const };
    const next = { ...studioConfig, radius: "soft" as const };
    const entry = makeHistoryEntry({ sections: [] }, previous);

    expect(entry.config).toEqual(previous);
    expect(entry.config).not.toEqual(next);
  });
});

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

describe("Creation Studio layout seeding", () => {
  it("seeds two-column sections with two half-width columns", () => {
    const section = makeSection();

    const grid = seedGridFromLayout(section, "two_column");

    expect(grid.map(({ i, x, y, w }) => ({ i, x, y, w }))).toEqual([
      { i: "a", x: 0, y: 0, w: 6 },
      { i: "b", x: 6, y: 0, w: 6 },
    ]);
  });

  it("seeds left-sidebar sections with a narrow rail and wide main column", () => {
    const section = makeSection({ layout: "sidebar_left" });

    const grid = seedGridFromLayout(section, "sidebar_left");

    expect(grid.map(({ i, x, w }) => ({ i, x, w }))).toEqual([
      { i: "a", x: 0, w: 3 },
      { i: "b", x: 3, w: 9 },
    ]);
  });

  it("seeds full sections with full-width blocks stacked by position", () => {
    const section = makeSection({ layout: "full" });

    const grid = seedGridFromLayout(section, "full");

    expect(grid.map(({ i, x, y, w }) => ({ i, x, y, w }))).toEqual([
      { i: "a", x: 0, y: 0, w: 12 },
      { i: "b", x: 0, y: 3, w: 12 },
    ]);
  });

  it("seeds three-column sections across three tracks", () => {
    const section = makeSection({
      layout: "three_column",
      blocks: [
        { id: "a", position: 0, type: "content-text", config: {}, visible: true },
        { id: "b", position: 1, type: "content-text", config: {}, visible: true },
        { id: "c", position: 2, type: "content-text", config: {}, visible: true },
      ],
    });

    const grid = seedGridFromLayout(section, "three_column");

    expect(grid.map(({ i, x, y, w }) => ({ i, x, y, w }))).toEqual([
      { i: "a", x: 0, y: 0, w: 4 },
      { i: "b", x: 4, y: 0, w: 4 },
      { i: "c", x: 8, y: 0, w: 4 },
    ]);
  });
});
