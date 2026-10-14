import { describe, expect, it } from "vitest";
import {
  draftShipFromEvents,
  safeHighlightUrl,
  shiftWeek,
  shipErrorMessage,
  shipWeekOf,
  streakLabel,
  weekLabel,
} from "./ship-log";
import type { RawEvent } from "./github-profile";

describe("shipWeekOf", () => {
  it("is the Monday of the UTC week", () => {
    expect(shipWeekOf(new Date("2026-10-14T12:00:00Z"))).toBe("2026-10-12"); // Wed
    expect(shipWeekOf(new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-12"); // Mon
    expect(shipWeekOf(new Date("2026-10-18T23:59:59Z"))).toBe("2026-10-12"); // Sun
    expect(shipWeekOf(new Date("2026-10-19T00:00:00Z"))).toBe("2026-10-19");
  });

  it("crosses month and year boundaries", () => {
    expect(shipWeekOf(new Date("2027-01-01T08:00:00Z"))).toBe("2026-12-28");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(shiftWeek("2026-10-05", -1)).toBe("2026-09-28");
  });
});

describe("labels", () => {
  it("names this week, last week, then dates", () => {
    expect(weekLabel("2026-10-12", "2026-10-12")).toBe("This week");
    expect(weekLabel("2026-10-05", "2026-10-12")).toBe("Last week");
    expect(weekLabel("2026-09-28", "2026-10-12")).toBe("Week of 28 Sept");
  });

  it("only shows streaks of two weeks or more", () => {
    expect(streakLabel(0)).toBeNull();
    expect(streakLabel(1)).toBeNull();
    expect(streakLabel(undefined)).toBeNull();
    expect(streakLabel(3)).toBe("3-week streak");
  });

  it("renders https links only", () => {
    expect(safeHighlightUrl("https://github.com/a/b")).toBe("https://github.com/a/b");
    expect(safeHighlightUrl("javascript:alert(1)")).toBeNull();
    expect(safeHighlightUrl("http://example.com")).toBeNull();
  });
});

const ev = (type: string, created_at: string, payload: Record<string, unknown> = {}): RawEvent => ({
  type,
  repo: { name: "bryce/tethyr" },
  created_at,
  payload,
});

describe("draftShipFromEvents", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");

  it("drafts notable work first and skips last week's events", () => {
    const draft = draftShipFromEvents(
      [
        ev("PushEvent", "2026-10-14T09:00:00Z", { size: 3 }),
        ev("PullRequestEvent", "2026-10-13T10:00:00Z", {
          action: "closed",
          pull_request: {
            title: "Ship log",
            html_url: "https://github.com/bryce/tethyr/pull/1",
            merged: true,
          },
        }),
        ev("ReleaseEvent", "2026-10-13T11:00:00Z", {
          action: "published",
          release: { tag_name: "v1.0", html_url: "https://github.com/bryce/tethyr/releases/v1.0" },
        }),
        ev("PushEvent", "2026-10-09T09:00:00Z", { size: 9 }), // last week
      ],
      "2026-10-12",
      now,
    );
    expect(draft.body.split("\n")).toEqual([
      "This week I:",
      "- Released v1.0 of tethyr",
      "- Merged “Ship log” in tethyr",
      "- Pushed 3 commits to tethyr",
    ]);
    expect(draft.highlights.map((h) => h.kind)).toEqual(["release", "pr_merged", "push"]);
    expect(draft.stats).toMatchObject({ commits: 3, merged: 1, releases: 1, repos: 1 });
  });

  it("is empty when there was no public activity this week", () => {
    const draft = draftShipFromEvents([ev("PushEvent", "2026-10-01T09:00:00Z")], "2026-10-12", now);
    expect(draft.body).toBe("");
    expect(draft.highlights).toEqual([]);
  });
});

describe("shipErrorMessage", () => {
  it("passes rate-limit copy through and explains the rest", () => {
    expect(shipErrorMessage(new Error("rate_limited: Try again soon."))).toBe("Try again soon.");
    expect(
      shipErrorMessage({ message: 'duplicate key value violates unique constraint "x"' }),
    ).toMatch(/already posted/);
    expect(shipErrorMessage(new Error("new row violates row-level security policy"))).toMatch(
      /Confirm your email/,
    );
  });
});
