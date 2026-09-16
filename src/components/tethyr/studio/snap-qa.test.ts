import { describe, expect, it } from "vitest";
import { snapGridPlacement } from "@/components/tethyr/studio/g-studio-surface";

// Replicates the onDragStop flow: RGL commits a collision-free drop cell
// (preventCollision), then settleGridSnap nudges onto the nearest neighbour
// edge when snapping is enabled. Inputs below are all realizable drops.
describe("drag-stop snap simulation", () => {
  const grid = [
    { i: "header", x: 0, y: 0, w: 12, h: 4 },
    { i: "bio", x: 0, y: 4, w: 7, h: 3 },
  ];
  const collides = (col: number, row: number, w: number, h: number) =>
    grid.some(
      (item) =>
        col < item.x + item.w && col + w > item.x && row < item.y + item.h && row + h > item.y,
    );

  it("glues a block dropped near bio's right rail onto its right edge", () => {
    const result = snapGridPlacement({ sectionId: "", col: 7, row: 5 }, 5, 3, grid, true, "new");
    expect(result).toMatchObject({ col: 7, row: 4 });
    expect(collides(result!.col, result!.row, 5, 3)).toBe(false);
  });

  it("stacks a block dropped just below the row onto bio's bottom edge", () => {
    const result = snapGridPlacement({ sectionId: "", col: 0, row: 8 }, 7, 3, grid, true, "new");
    expect(result).toMatchObject({ col: 0, row: 7 });
    expect(collides(result!.col, result!.row, 7, 3)).toBe(false);
  });

  it("snaps diagonally-near drops within the threshold", () => {
    const result = snapGridPlacement({ sectionId: "", col: 1, row: 8 }, 7, 3, grid, true, "new");
    expect(result).toMatchObject({ col: 0, row: 7 });
    expect(collides(result!.col, result!.row, 7, 3)).toBe(false);
  });

  it("keeps a deliberate far placement unsnapped", () => {
    const result = snapGridPlacement({ sectionId: "", col: 0, row: 20 }, 7, 3, grid, true, "new");
    expect(result).toMatchObject({ col: 0, row: 20 });
  });

  it("never moves a free drop into an occupied cell", () => {
    // All targets are collision-free at their clamped position (as RGL
    // produces with preventCollision) — widths fit their column.
    for (const [target, w, h] of [
      [{ sectionId: "", col: 0, row: 8 }, 7, 3],
      [{ sectionId: "", col: 1, row: 8 }, 7, 3],
      [{ sectionId: "", col: 7, row: 5 }, 5, 3],
      [{ sectionId: "", col: 0, row: 7 }, 7, 3],
      [{ sectionId: "", col: 5, row: 7 }, 7, 3],
    ] as const) {
      const result = snapGridPlacement(target, w, h, grid, true, "new");
      expect(collides(result!.col, result!.row, w, h)).toBe(false);
    }
  });
});
