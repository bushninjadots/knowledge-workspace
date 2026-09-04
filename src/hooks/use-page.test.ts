import { describe, expect, it } from "vitest";
import { parseVersionLayoutSections } from "@/hooks/use-page";
import type { LayoutSection, PageLayout } from "@/lib/page-blocks";

function makeSection(id: string): LayoutSection {
  return {
    id,
    position: 0,
    layout: "full",
    blocks: [],
  };
}

describe("parseVersionLayoutSections", () => {
  it("passes a bare sections array through unchanged", () => {
    const sections = [makeSection("a"), makeSection("b")];
    const raw = sections as unknown;

    expect(parseVersionLayoutSections(raw)).toEqual(sections);
  });

  it("unwraps an object layout into its sections array", () => {
    const layout: PageLayout = {
      sections: [makeSection("a"), makeSection("b")],
    };
    const raw = layout as unknown;

    expect(parseVersionLayoutSections(raw)).toEqual(layout.sections);
  });

  it("returns an empty array for a nullish or empty payload", () => {
    expect(parseVersionLayoutSections(null)).toEqual([]);
    expect(parseVersionLayoutSections(undefined)).toEqual([]);
    expect(parseVersionLayoutSections({})).toEqual([]);
    expect(parseVersionLayoutSections([])).toEqual([]);
  });
});
