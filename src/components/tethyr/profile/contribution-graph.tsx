import { useMemo } from "react";
import type { ActivityRow } from "@/components/tethyr/profile-sections";

const CELL_SIZE = 12;
const GAP = 2;
const WEEKS = 20;

export function ContributionGraph({ activity }: { activity: ActivityRow[] }) {
  const { grid, maxCount } = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    for (const a of activity) {
      const d = a.created_at?.slice(0, 10);
      if (d) dateCounts[d] = (dateCounts[d] ?? 0) + 1;
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - WEEKS * 7 + 1);
    // Align to start of week (Monday)
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - ((dayOfWeek + 6) % 7));

    const grid: { date: string; count: number }[][] = [];
    let maxCount = 0;
    const current = new Date(startDate);

    for (let week = 0; week < WEEKS; week++) {
      const weekCells: { date: string; count: number }[] = [];
      for (let day = 0; day < 7; day++) {
        const key = current.toISOString().slice(0, 10);
        const count = dateCounts[key] ?? 0;
        if (count > maxCount) maxCount = count;
        weekCells.push({ date: key, count });
        current.setDate(current.getDate() + 1);
      }
      grid.push(weekCells);
    }

    return { grid, maxCount };
  }, [activity]);

  function getColor(count: number) {
    if (count === 0) return "bg-muted/40";
    if (maxCount === 0) return "bg-muted/40";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-primary/20";
    if (ratio < 0.5) return "bg-primary/40";
    if (ratio < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  }

  const total = activity.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {total} contributions in the last {WEEKS} weeks
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className={`h-3 w-3 rounded-sm bg-muted/40`} />
          <div className={`h-3 w-3 rounded-sm bg-primary/20`} />
          <div className={`h-3 w-3 rounded-sm bg-primary/40`} />
          <div className={`h-3 w-3 rounded-sm bg-primary/60`} />
          <div className={`h-3 w-3 rounded-sm bg-primary/90`} />
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={WEEKS * (CELL_SIZE + GAP)} height={7 * (CELL_SIZE + GAP)} className="shrink-0">
          {grid.map((week, wi) =>
            week.map((cell, di) => (
              <rect
                key={cell.date}
                x={wi * (CELL_SIZE + GAP)}
                y={di * (CELL_SIZE + GAP)}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                className={`${getColor(cell.count)} transition-colors`}
              >
                <title>{`${cell.date}: ${cell.count} contribution${cell.count !== 1 ? "s" : ""}`}</title>
              </rect>
            )),
          )}
        </svg>
      </div>
    </div>
  );
}
