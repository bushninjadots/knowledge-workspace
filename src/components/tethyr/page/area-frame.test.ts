import { describe, expect, it } from "vitest";
import type { LayoutBlockInstance, LayoutSection } from "@/lib/page-blocks";
import { areaOverlapped, overlapAttr } from "./area-frame";

const block = (id: string, patch: Partial<LayoutBlockInstance> = {}): LayoutBlockInstance => ({
  id,
  type: "profile-bio",
  config: {},
  position: 0,
  visible: true,
  ...patch,
});

const area = (patch: Partial<LayoutSection> = {}): LayoutSection => ({
  id: "a",
  layout: "full",
  position: 1,
  visible: true,
  blocks: [block("top"), block("below")],
  grid: [
    { i: "top", x: 0, y: 0, w: 6, h: 4 },
    { i: "below", x: 0, y: 4, w: 6, h: 4 },
  ],
  ...patch,
});

describe("overlapping the piece above", () => {
  const up = { overlap: "up" as const };
  const before = area({ id: "before" });

  it("is off unless the block asks", () => {
    expect(overlapAttr({}, { y: 0 }, area(), before)).toBeUndefined();
  });

  it("reaches across the row gap from a later row", () => {
    expect(overlapAttr(up, { y: 4 }, area(), null)).toBe("row");
  });

  it("reaches into the area before from the first row", () => {
    expect(overlapAttr(up, { y: 0 }, area(), before)).toBe("area");
  });

  it("never covers an area title or climbs out of the first area", () => {
    expect(overlapAttr(up, { y: 0 }, area({ title: "Selected work" }), before)).toBeUndefined();
    expect(overlapAttr(up, { y: 0 }, area(), null)).toBeUndefined();
    // Placeholder titles don't show, so they don't block it.
    expect(overlapAttr(up, { y: 0 }, area({ title: "Area 3" }), before)).toBe("area");
  });

  it("never reaches over a profile header, which can't make room", () => {
    const header = area({ blocks: [block("top", { type: "profile-header" }), block("below")] });
    expect(overlapAttr(up, { y: 0 }, area(), header)).toBeUndefined();
    expect(overlapAttr(up, { y: 4 }, header, null)).toBeUndefined();
  });
});

describe("making room for it", () => {
  const shown = (b: LayoutBlockInstance) => b.visible !== false;
  const layered = (patch: Partial<LayoutSection> = {}) =>
    area({ blocks: [block("top", { overlap: "up" }), block("below")], ...patch });

  it("happens in the area a piece reaches into", () => {
    expect(areaOverlapped(area(), layered(), shown)).toBe(true);
    expect(areaOverlapped(area(), area(), shown)).toBe(false);
    expect(areaOverlapped(area(), null, shown)).toBe(false);
  });

  it("happens within an area for a later row", () => {
    const rowed = area({ blocks: [block("top"), block("below", { overlap: "up" })] });
    expect(areaOverlapped(rowed, null, shown)).toBe(true);
  });

  it("doesn't happen for a piece that won't show", () => {
    const hidden = area({
      blocks: [block("top", { overlap: "up", visible: false }), block("below")],
    });
    expect(areaOverlapped(area(), hidden, shown)).toBe(false);
  });
});
