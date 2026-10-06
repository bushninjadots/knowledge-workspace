import { describe, expect, it } from "vitest";
import { suggestBlocks, type SuggestionFacts } from "./block-suggestions";

const facts: SuggestionFacts = {
  projectCount: 0,
  skillCount: 0,
  hasBio: false,
  linkCount: 0,
  toolCount: 0,
  yearsExperience: null,
  availability: null,
};
const layout = (...types: string[]) => ({
  sections: [
    {
      id: "s",
      position: 0,
      layout: "full" as const,
      blocks: types.map((type, i) => ({ id: type, type, position: i, config: {}, visible: true })),
    },
  ],
});

describe("suggestBlocks", () => {
  it("leads with work the member has but isn't showing", () => {
    const [first] = suggestBlocks(layout(), { ...facts, projectCount: 3 });
    expect(first).toEqual({
      type: "profile-projects",
      reason: "You have 3 projects visitors can't see yet.",
    });
  });

  it("never suggests a block that's already on the page", () => {
    const types = suggestBlocks(layout("call-to-action", "highlights"), facts, 10).map(
      (s) => s.type,
    );
    expect(types).not.toContain("call-to-action");
    expect(types).not.toContain("highlights");
  });

  it("only suggests data blocks when there is data to show", () => {
    const types = suggestBlocks(layout(), facts, 20).map((s) => s.type);
    expect(types).not.toContain("profile-projects");
    expect(types).not.toContain("services");
    expect(types).toContain("call-to-action");
  });

  it("respects the limit", () => {
    expect(suggestBlocks(layout(), { ...facts, projectCount: 1, skillCount: 2 }, 2)).toHaveLength(
      2,
    );
  });
});
