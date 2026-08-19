import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CELL_SIZE = 12;
const GAP = 2;
const WEEKS = 20;

type ContributionRow = {
  id: string;
  action: string;
  points: number;
  created_at: string;
};

export function ContributionGraph({ profileId }: { profileId: string }) {
  // Align the window to the start of the current week (Monday) so the grid and
  // the query cover the exact same range.
  const startIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - WEEKS * 7 + 1);
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
    return d.toISOString();
  }, []);

  // Contribution graph counts reputation-eligible events (contribution_log),
  // not profile edits / connection requests from activity_events. This is the
  // same source the Activity Timeline uses for its +points rows.
  const { data: contributions = [] } = useQuery({
    queryKey: ["contribution-graph", profileId],
    queryFn: async (): Promise<ContributionRow[]> => {
      if (!profileId) return [];
      const { data } = await supabase
        .from("contribution_log")
        .select("id, action, points, created_at")
        .eq("profile_id", profileId)
        .gte("created_at", startIso)
        .order("created_at", { ascending: false });
      return (data ?? []) as ContributionRow[];
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });

  const { grid, maxCount } = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    for (const c of contributions) {
      const d = c.created_at?.slice(0, 10);
      if (d) dateCounts[d] = (dateCounts[d] ?? 0) + 1;
    }

    const startDate = new Date(startIso);
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
  }, [contributions, startIso]);

  function getColor(count: number) {
    if (count === 0) return "bg-muted/40";
    if (maxCount === 0) return "bg-muted/40";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-primary/20";
    if (ratio < 0.5) return "bg-primary/40";
    if (ratio < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  }

  const total = contributions.length;

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
