import { describe, expect, it } from "vitest";
import { buildCommitMonthLabels, formatCommitCellDate } from "./commit-graph";
import type { CommitActivityWeek } from "@/lib/github";

const week = (timestamp: number, days: number[] = []): CommitActivityWeek => ({
  week: timestamp,
  total: days.reduce((sum, count) => sum + count, 0),
  days,
});

describe("CommitGraph helpers", () => {
  it("formats a cell from GitHub's week timestamp and Sunday-first day index", () => {
    expect(formatCommitCellDate(Date.UTC(2026, 0, 4) / 1000, 0)).toMatch(/Jan 4, 2026/);
    expect(formatCommitCellDate(Date.UTC(2026, 0, 4) / 1000, 6)).toMatch(/Jan 10, 2026/);
  });

  it("labels months in week order, with the year only where it's needed", () => {
    const weeks = Array.from({ length: 20 }, (_, i) =>
      week((Date.UTC(2025, 10, 2) + i * 7 * 86_400_000) / 1000),
    ).reverse();
    const labels = buildCommitMonthLabels(weeks).map((l) => l.label);
    expect(labels[0]).toMatch(/Nov 2025/);
    expect(labels).toContainEqual(expect.stringMatching(/^Dec$/));
    expect(labels).toContainEqual(expect.stringMatching(/Jan 2026/));
    // February starts too close to the wider "Jan 2026" and waits for March.
    expect(labels).toContainEqual(expect.stringMatching(/^Mar$/));
  });

  it("never crowds a label into the one before it", () => {
    const weeks = [
      week(Date.UTC(2026, 1, 22) / 1000),
      week(Date.UTC(2026, 2, 1) / 1000),
      week(Date.UTC(2026, 2, 8) / 1000),
      week(Date.UTC(2026, 3, 5) / 1000),
    ];
    // "Feb 2026" needs ~5 columns, so March (1 later) and April (3) wait.
    expect(buildCommitMonthLabels(weeks)).toEqual([
      { index: 0, label: expect.stringMatching(/Feb 2026/) },
    ]);
  });

  it("returns no month labels for an empty snapshot", () => {
    expect(buildCommitMonthLabels([])).toEqual([]);
  });
});
