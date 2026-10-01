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

  it("labels each month once in chronological week order", () => {
    const weeks = [
      week(Date.UTC(2026, 2, 1) / 1000),
      week(Date.UTC(2026, 1, 22) / 1000),
      week(Date.UTC(2026, 2, 8) / 1000),
      week(Date.UTC(2026, 3, 5) / 1000),
    ];

    expect(buildCommitMonthLabels(weeks)).toEqual([
      { index: 0, label: expect.stringMatching(/Feb 2026/) },
      { index: 1, label: expect.stringMatching(/Mar 2026/) },
      { index: 3, label: expect.stringMatching(/Apr 2026/) },
    ]);
  });

  it("returns no month labels for an empty snapshot", () => {
    expect(buildCommitMonthLabels([])).toEqual([]);
  });
});
