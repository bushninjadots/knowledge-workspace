import { useMemo, useState } from "react";
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

type GraphMode = "events" | "points";

export function ContributionGraph({ profileId }: { profileId: string }) {
  const [mode, setMode] = useState<GraphMode>("events");

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

  const { grid, maxValue } = useMemo(() => {
    const dateCounts: Record<string, number> = {};
    const datePoints: Record<string, number> = {};
    for (const c of contributions) {
      const d = c.created_at?.slice(0, 10);
      if (!d) continue;
      dateCounts[d] = (dateCounts[d] ?? 0) + 1;
      datePoints[d] = (datePoints[d] ?? 0) + (c.points ?? 0);
    }

    const startDate = new Date(startIso);
    const grid: { date: string; value: number }[][] = [];
    let maxValue = 0;
    const current = new Date(startDate);

    for (let week = 0; week < WEEKS; week++) {
      const weekCells: { date: string; value: number }[] = [];
      for (let day = 0; day < 7; day++) {
        const key = current.toISOString().slice(0, 10);
        const value = mode === "points" ? (datePoints[key] ?? 0) : (dateCounts[key] ?? 0);
        if (value > maxValue) maxValue = value;
        weekCells.push({ date: key, value });
        current.setDate(current.getDate() + 1);
      }
      grid.push(weekCells);
    }

    return { grid, maxValue };
  }, [contributions, startIso, mode]);

  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    const start = new Date(startIso);
    let lastMonth = "";
    for (let week = 0; week < WEEKS; week++) {
      const d = new Date(start);
      d.setDate(d.getDate() + week * 7);
      const month = d.toLocaleDateString(undefined, { month: "short" });
      if (month !== lastMonth) {
        labels.push({ x: week * (CELL_SIZE + GAP), label: month });
        lastMonth = month;
      }
    }
    return labels;
  }, [startIso]);

  function getColor(value: number) {
    if (value === 0) return "bg-muted/40";
    if (maxValue === 0) return "bg-muted/40";
    const ratio = value / maxValue;
    if (ratio < 0.25) return "bg-primary/20";
    if (ratio < 0.5) return "bg-primary/40";
    if (ratio < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  }

  const totalEvents = contributions.length;
  const totalPoints = contributions.reduce((sum, c) => sum + (c.points ?? 0), 0);
  const totalLabel = mode === "points" ? `${totalPoints} points` : `${totalEvents} contributions`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            {totalLabel} in the last {WEEKS} weeks
          </span>
          <div className="flex rounded-lg border border-border/60 bg-background/40 p-0.5">
            <button
              type="button"
              onClick={() => setMode("events")}
              className={`rounded-md px-2 py-0.5 transition ${
                mode === "events"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => setMode("points")}
              className={`rounded-md px-2 py-0.5 transition ${
                mode === "points"
                  ? "bg-surface-elevated text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Points
            </button>
          </div>
        </div>
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
        <div className="relative" style={{ width: WEEKS * (CELL_SIZE + GAP) }}>
          {/* Month labels */}
          <div className="relative h-4 text-[10px] leading-none text-muted-foreground">
            {monthLabels.map((m) => (
              <span key={m.label + m.x} className="absolute top-0" style={{ left: m.x }}>
                {m.label}
              </span>
            ))}
          </div>
          <svg
            width={WEEKS * (CELL_SIZE + GAP)}
            height={7 * (CELL_SIZE + GAP)}
            className="shrink-0"
          >
            {grid.map((week, wi) =>
              week.map((cell, di) => (
                <rect
                  key={cell.date}
                  x={wi * (CELL_SIZE + GAP)}
                  y={di * (CELL_SIZE + GAP)}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  className={`${getColor(cell.value)} transition-colors`}
                >
                  <title>
                    {mode === "points"
                      ? `${cell.date}: ${cell.value} point${cell.value !== 1 ? "s" : ""}`
                      : `${cell.date}: ${cell.value} contribution${cell.value !== 1 ? "s" : ""}`}
                  </title>
                </rect>
              )),
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
