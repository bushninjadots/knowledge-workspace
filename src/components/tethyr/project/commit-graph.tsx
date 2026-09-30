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
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <CalendarDays className="h-3 w-3" />
        <span className="tabular-nums">{calendar.total.toLocaleString()}</span> commits in the last
        year
      </p>
      <div className="overflow-x-auto pb-1">
        <div role="img" aria-label={ariaLabel} className="flex w-max gap-[3px]">
          {calendar.weeks.map((column, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {column.map((cell, j) => (
                <span
                  key={j}
                  title={`${cell.count} commit${cell.count === 1 ? "" : "s"}`}
                  className={cn("h-[8px] w-[8px] rounded-[2px]", GRAPH_LEVEL_CLASS[cell.level])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
