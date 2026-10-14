import { describe, expect, it } from "vitest";
import {
  countdownLabel,
  readyToRelease,
  recentlyShipped,
  releaseState,
  toLocalInput,
} from "./release";

const now = Date.parse("2026-10-14T12:00:00Z");

describe("release", () => {
  it("knows upcoming from shipped", () => {
    expect(releaseState(null, now)).toBe("none");
    expect(releaseState("2026-10-15T12:00:00Z", now)).toBe("upcoming");
    expect(releaseState("2026-10-14T11:59:59Z", now)).toBe("shipped");
  });

  it("counts down", () => {
    expect(countdownLabel("2026-10-17T16:12:09Z", now)).toBe("3d 04:12:09");
    expect(countdownLabel("2026-10-14T12:00:30Z", now)).toBe("00:00:30");
    expect(countdownLabel("2026-10-13T00:00:00Z", now)).toBe("00:00:00");
  });

  it("celebrates for a week, and knows when the work is done", () => {
    expect(recentlyShipped("2026-10-10T12:00:00Z", 7, now)).toBe(true);
    expect(recentlyShipped("2026-10-01T12:00:00Z", 7, now)).toBe(false);
    expect(recentlyShipped("2026-10-20T12:00:00Z", 7, now)).toBe(false);
    expect(readyToRelease({ status: "completed" })).toBe(true);
    expect(readyToRelease({ progress_percent: 100 })).toBe(true);
    expect(readyToRelease({ milestonesTotal: 3, milestonesDone: 3 })).toBe(true);
    expect(readyToRelease({ milestonesTotal: 3, milestonesDone: 2, progress_percent: 80 })).toBe(
      false,
    );
    expect(readyToRelease({ milestonesTotal: 0 })).toBe(false);
  });

  it("formats a local input value", () => {
    expect(toLocalInput("2026-10-14T12:05:00Z")).toMatch(/^2026-10-14T\d\d:05$/);
  });
});
