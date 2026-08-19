import { describe, it, expect } from "vitest";
import { buildContributionGrid, buildMonthLabels } from "./contribution-graph";

// Monday in UTC, so the grid keys align to whole UTC dates.
const START = "2026-01-05T00:00:00.000Z";

function contribution(date: string, points: number) {
  return { id: `${date}-${points}`, action: "community_post_created", points, created_at: date };
}

function flatten(grid: { date: string; value: number }[][]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const week of grid) for (const cell of week) out[cell.date] = cell.value;
  return out;
}

describe("buildContributionGrid", () => {
  it("counts events per day and finds the max", () => {
    const { grid, maxValue } = buildContributionGrid(
      [
        contribution("2026-01-05T10:00:00.000Z", 10),
        contribution("2026-01-05T11:00:00.000Z", 5),
        contribution("2026-01-06T09:00:00.000Z", 2),
      ],
      START,
      "events",
    );

    const cells = flatten(grid);
    expect(cells["2026-01-05"]).toBe(2);
    expect(cells["2026-01-06"]).toBe(1);
    expect(maxValue).toBe(2);
  });

  it("sums points per day in points mode", () => {
    const { grid, maxValue } = buildContributionGrid(
      [
        contribution("2026-01-05T10:00:00.000Z", 10),
        contribution("2026-01-05T11:00:00.000Z", 5),
        contribution("2026-01-06T09:00:00.000Z", 2),
      ],
      START,
      "points",
    );

    const cells = flatten(grid);
    expect(cells["2026-01-05"]).toBe(15);
    expect(cells["2026-01-06"]).toBe(2);
    expect(maxValue).toBe(15);
  });

  it("builds a 20-week × 7-day grid", () => {
    const { grid } = buildContributionGrid([], START, "events");
    expect(grid).toHaveLength(20);
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("ignores contributions without a created_at", () => {
    const { maxValue } = buildContributionGrid(
      [{ id: "x", action: "community_post_created", points: 5, created_at: "" }],
      START,
      "points",
    );
    expect(maxValue).toBe(0);
  });
});

describe("buildMonthLabels", () => {
  it("emits month labels at ascending x positions", () => {
    const labels = buildMonthLabels(START);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels[0].x).toBe(0);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].x).toBeGreaterThan(labels[i - 1].x);
    }
    expect(labels.every((l) => l.label.length > 0)).toBe(true);
  });
});
