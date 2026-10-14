import { describe, expect, it } from "vitest";
import { notificationBodyText } from "./notification-text";

describe("notificationBodyText", () => {
  it("reads a recognition kind as words, with its project", () => {
    expect(
      notificationBodyText({
        type: "project_recognition",
        body: "made_clearer",
        metadata: { project_title: "Kindling" },
      }),
    ).toBe("Made the project clearer · Kindling");
  });

  it("leaves other bodies alone", () => {
    expect(notificationBodyText({ type: "message", body: "hi_there" })).toBe("hi_there");
  });
});
