import { describe, expect, it } from "vitest";
import { getProjectPresentationOption, PROJECT_PRESENTATION_OPTIONS } from "./project-presentation";

describe("project presentation presets", () => {
  it("keeps the README overview first while changing the supporting section flow", () => {
    const orders = PROJECT_PRESENTATION_OPTIONS.map((option) => option.sectionOrder.join(","));

    expect(new Set(orders).size).toBe(PROJECT_PRESENTATION_OPTIONS.length);
    expect(
      PROJECT_PRESENTATION_OPTIONS.every((option) => option.sectionOrder[0] === "overview"),
    ).toBe(true);
    expect(getProjectPresentationOption("collaboration-first").sectionOrder).toEqual([
      "overview",
      "people",
      "conversation",
      "work",
      "evidence",
    ]);
  });

  it("falls back safely for an unknown or missing preset", () => {
    expect(getProjectPresentationOption("unknown").id).toBe("story-first");
    expect(getProjectPresentationOption(null).id).toBe("story-first");
  });
});
