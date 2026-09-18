import { describe, expect, it } from "vitest";
import {
  bucketContributorActivity,
  HEAT_BUCKETS,
  HEAT_WINDOW_DAYS,
  type ActivityLike,
} from "./activity-heat";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 18, 12, 0, 0); // fixed "now"
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const rows = (...specs: [actor: string, daysAgo: number][]): ActivityLike[] =>
  specs.map(([actor_id, d]) => ({ actor_id, created_at: ago(d) }));

describe("bucketContributorActivity", () => {
  it("buckets four weeks oldest→newest", () => {
    // 22d → bucket 0, 10d → bucket 2, 2d → bucket 3
    const map = bucketContributorActivity(rows(["p1", 22], ["p1", 10], ["p1", 10], ["p1", 2]), NOW);
    expect(map.get("p1")).toEqual([1, 0, 2, 1]);
  });

  it("separates actors and ignores rows outside the 28-day window", () => {
    const map = bucketContributorActivity(
      rows(["p1", 1], ["p2", 5], ["p1", 40], ["p1", HEAT_WINDOW_DAYS + 1]),
      NOW,
    );
    expect(map.get("p1")).toEqual([0, 0, 0, 1]);
    expect(map.get("p2")).toEqual([0, 0, 0, 1]);
  });

  it("ignores null actors and future timestamps", () => {
    const map = bucketContributorActivity(
      [
        { actor_id: null, created_at: ago(1) },
        { actor_id: "p1", created_at: new Date(NOW + DAY).toISOString() },
      ],
      NOW,
    );
    expect(map.size).toBe(0);
  });

  it("treats the newest 7 days as the last bucket (boundary inclusive)", () => {
    const map = bucketContributorActivity(rows(["p1", 0], ["p1", 6.9]), NOW);
    expect(map.get("p1")).toEqual([0, 0, 0, 2]);
    expect(map.get("p1")?.length).toBe(HEAT_BUCKETS);
  });

  it("returns an empty map for empty input", () => {
    expect(bucketContributorActivity([], NOW).size).toBe(0);
  });
});
