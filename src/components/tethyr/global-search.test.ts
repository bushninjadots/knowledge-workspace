import { describe, expect, it } from "vitest";
import { ACTIONS, actionHitsFor } from "./global-search";

describe("palette actions", () => {
  it("keeps action kinds unique", () => {
    const kinds = ACTIONS.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("lists every action in the zero state", () => {
    expect(actionHitsFor("")).toEqual(ACTIONS.slice(0, 4));
  });

  it("finds actions by label, description, and keywords", () => {
    expect(actionHitsFor("create").map((a) => a.kind)).toContain("createProject");
    expect(actionHitsFor("schedule").map((a) => a.kind)).toContain("scheduleSession");
    expect(actionHitsFor("shar").map((a) => a.kind)).toContain("communityPost");
    expect(actionHitsFor("upload").map((a) => a.kind)).toContain("addToLibrary");
  });

  it("returns no actions for an unrelated term", () => {
    expect(actionHitsFor("zzzzznope")).toEqual([]);
  });

  it("limits action hits like other result sections", () => {
    expect(actionHitsFor("pr", 2).length).toBeLessThanOrEqual(2);
  });
});
