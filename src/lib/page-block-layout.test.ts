import { describe, expect, it } from "vitest";
import type { PageLayout } from "@/lib/page-blocks";
import { groupSections, normalizeComposition, placeSection } from "./page-block-layout";

const layout: PageLayout = {
  sections: [
    { id: "a", position: 0, layout: "full", blocks: [] },
    { id: "b", position: 1, layout: "full", blocks: [] },
    { id: "c", position: 2, layout: "full", blocks: [] },
  ],
};

describe("page section composition", () => {
  it("preserves legacy layouts as sequential section groups", () => {
    expect(groupSections(layout).map((group) => group.map((section) => section.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
  });

  it("groups sections into side-by-side rows", () => {
    const composed = normalizeComposition(layout, 2);
    expect(composed.composition?.columns).toBe(2);
    expect(groupSections(composed).map((group) => group.map((section) => section.id))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("clamps invalid column counts and removes one-column metadata", () => {
    expect(normalizeComposition(layout, 0).composition).toBeUndefined();
    expect(normalizeComposition(layout, 8).composition?.columns).toBe(3);
  });

  it("swaps sections into independently selected slots", () => {
    const composed = normalizeComposition(layout, 2);
    const moved = placeSection(composed, "c", 0, 0);
    expect(groupSections(moved).map((group) => group.map((section) => section.id))).toEqual([
      ["c", "b"],
      ["a"],
    ]);
  });
});
