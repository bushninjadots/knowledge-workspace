import { describe, expect, it } from "vitest";
import { templateSketchRows } from "./starter-picker";
import type { LayoutSection } from "@/lib/page-blocks";

function section(layout: string, blockCount: number): LayoutSection {
  return {
    id: `s-${layout}-${blockCount}`,
    position: 0,
    layout: layout as LayoutSection["layout"],
    blocks: Array.from({ length: blockCount }, (_, i) => ({
      id: `b-${i}`,
      type: "heading" as LayoutSection["blocks"][number]["type"],
      position: i,
      config: {},
      visible: true,
    })),
  };
}

describe("templateSketchRows", () => {
  it("renders one full-width bar per full-layout section", () => {
    expect(templateSketchRows([section("full", 3), section("full", 1)])).toEqual([[1], [1]]);
  });

  it("splits multi-column layouts per block", () => {
    expect(templateSketchRows([section("two_column", 2)])).toEqual([[1, 1]]);
    expect(templateSketchRows([section("three_column", 3)])).toEqual([[1, 1, 1]]);
  });

  it("collapses a single block in a multi-column layout to a full-width bar", () => {
    expect(templateSketchRows([section("sidebar_left", 1)])).toEqual([[1]]);
  });

  it("caps the wireframe at four rows so long templates stay readable", () => {
    const many = Array.from({ length: 9 }, () => section("full", 1));
    expect(templateSketchRows(many)).toHaveLength(4);
  });

  it("treats unknown layouts as full-width (sanitize already healed real ones)", () => {
    expect(templateSketchRows([section("mystery_layout", 2)])).toEqual([[1]]);
  });
});
