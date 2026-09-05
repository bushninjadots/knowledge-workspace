import { describe, expect, it } from "vitest";

import { TIMEZONES, formatTimezone, getUserTimezone, zonedDateTimeToUtcIso } from "./timezones";

describe("getUserTimezone", () => {
  it("returns a known timezone from the catalog", () => {
    expect(TIMEZONES).toContain(getUserTimezone());
  });
});

describe("formatTimezone", () => {
  it("replaces underscores with spaces", () => {
    expect(formatTimezone("America/New_York")).toBe("America/New York");
  });
});

describe("zonedDateTimeToUtcIso", () => {
  it("converts a July wall-clock in New York (EDT, UTC-4)", () => {
    expect(zonedDateTimeToUtcIso("2026-07-15", "12:00", "America/New_York")).toBe(
      "2026-07-15T16:00:00.000Z",
    );
  });

  it("converts a January wall-clock in New York (EST, UTC-5)", () => {
    expect(zonedDateTimeToUtcIso("2026-01-15", "12:00", "America/New_York")).toBe(
      "2026-01-15T17:00:00.000Z",
    );
  });

  it("respects the chosen zone, not the machine zone (Paris CEST, UTC+2)", () => {
    expect(zonedDateTimeToUtcIso("2026-07-15", "12:00", "Europe/Paris")).toBe(
      "2026-07-15T10:00:00.000Z",
    );
  });

  it("keeps UTC as-is", () => {
    expect(zonedDateTimeToUtcIso("2026-07-15", "12:00", "UTC")).toBe("2026-07-15T12:00:00.000Z");
  });

  it("handles a non-zero minute time", () => {
    expect(zonedDateTimeToUtcIso("2026-07-15", "14:30", "America/New_York")).toBe(
      "2026-07-15T18:30:00.000Z",
    );
  });

  it("throws on an invalid wall-clock", () => {
    expect(() => zonedDateTimeToUtcIso("not-a-date", "12:00", "UTC")).toThrow();
  });
});
