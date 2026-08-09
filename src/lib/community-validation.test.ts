import { describe, expect, it } from "vitest";
import { validateFeedbackRequest, validatePollDraft } from "./community-validation";

describe("community validation", () => {
  it("requires two unique poll options", () => {
    expect(validatePollDraft(["Only one"], "")).toBe("A poll needs at least 2 options");
    expect(validatePollDraft(["Yes", " yes "], "")).toBe("Poll options must be unique");
    expect(validatePollDraft(["Yes", "No"], "")).toBeNull();
  });

  it("rejects poll end times that are not in the future", () => {
    expect(validatePollDraft(["Yes", "No"], "2026-01-01T00:00", Date.parse("2026-02-01"))).toBe(
      "Poll end time must be in the future",
    );
  });

  it("requires a focused feedback area", () => {
    expect(validateFeedbackRequest([])).toBe("Choose at least one feedback area");
    expect(validateFeedbackRequest(["UI Design"])).toBeNull();
  });
});
