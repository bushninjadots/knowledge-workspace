// ── Commit graph ──────────────────────────────────────────────────────────
// GitHub's 52-week commit history as the familiar contribution grid, rendered
// from the cached snapshot (no GitHub call per view). Shared by the project
// code panel and the profile work evidence so a person's projects and their
// aggregate story read identically.
//
// Named CommitGraph (not ContributionGraph): profile/contribution-graph.tsx
// already owns that name for Tethyr's community-points grid — a different
// fact (in-app contributions vs. repository commits) that must not blur.
import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildContributionCalendar } from "@/lib/github";
import type { CommitActivityWeek, ContributionCalendar } from "@/lib/github";

/** Heat colors — the user's accent, banded by quartiles of the busiest day. */
const GRAPH_LEVEL_CLASS = [
  "bg-border/50",
  "bg-[var(--user-accent,var(--primary))]/25",
  "bg-[var(--user-accent,var(--primary))]/45",
  "bg-[var(--user-accent,var(--primary))]/70",
  "bg-[var(--user-accent,var(--primary))]",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatCommitCellDate(week: number, day: number) {
  return DATE_FORMATTER.format(new Date(week * 1000 + day * DAY_MS));
}

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: "short" });
const YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, { year: "numeric" });

/**
 * Month labels over the graph's week columns (11px each). The year shows on
 * the first label and on January only, and a month that starts too close to
 * the previous label is skipped, so labels never run into each other.
 */
export function buildCommitMonthLabels(weeks: CommitActivityWeek[]) {
  const labels: { index: number; label: string }[] = [];
  let lastMonth = "";
  let lastIndex = -Infinity;
  let lastWide = false;

  [...weeks]
    .sort((a, b) => a.week - b.week)
    .forEach((week, index) => {
      const date = new Date(week.week * 1000);
      const month = MONTH_FORMATTER.format(date);
      if (month === lastMonth) return;
      lastMonth = month;
      const wide = labels.length === 0 || date.getMonth() === 0;
      // Room for the previous label: ~3 columns for "Mar", ~5 for "Jan 2026".
      if (index - lastIndex < (lastWide ? 5 : 3)) return;
      labels.push({ index, label: wide ? `${month} ${YEAR_FORMATTER.format(date)}` : month });
      lastIndex = index;
      lastWide = wide;
    });

  return labels;
}

export function CommitGraph({
  weeks,
  ariaLabel,
  className,
}: {
  weeks: CommitActivityWeek[];
  /** What the grid claims — the panel says "Contribution graph", the profile names the person's repos. */
  ariaLabel: string;
  className?: string;
}) {
  const calendar: ContributionCalendar = useMemo(() => buildContributionCalendar(weeks), [weeks]);
  const monthLabels = useMemo(() => buildCommitMonthLabels(weeks), [weeks]);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <CalendarDays className="h-3 w-3" />
        <span className="tabular-nums">{calendar.total.toLocaleString()}</span> commits in the last
        year
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="w-max">
          <div className="relative mb-1 h-3 text-[10px] text-muted-foreground" aria-hidden="true">
            {monthLabels.map(({ index, label }) => (
              <span
                key={`${index}-${label}`}
                className="absolute whitespace-nowrap"
                style={{ left: index * 11 }}
              >
                {label}
              </span>
            ))}
          </div>
          <div role="img" aria-label={ariaLabel} className="flex w-max gap-[3px]">
            {calendar.weeks.map((column, i) => {
              const week = weeks[i]?.week ?? 0;
              return (
                <div key={week || i} className="flex flex-col gap-[3px]">
                  {column.map((cell, j) => {
                    const label = `${formatCommitCellDate(week, j)}: ${cell.count} commit${cell.count === 1 ? "" : "s"}`;
                    return (
                      // Cells inside role="img" are presentational: the
                      // graph's own label speaks for it; the title is hover.
                      <span
                        key={`${week}-${j}`}
                        title={label}
                        className={cn(
                          "h-[8px] w-[8px] rounded-[2px]",
                          GRAPH_LEVEL_CLASS[cell.level],
                        )}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
