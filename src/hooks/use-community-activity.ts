import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePending } from "@/lib/supabase-pending-schema";

export type ActivityPoint = {
  date: string; // YYYY-MM-DD
  joins: number;
  posts: number;
};

const COMMUNITY_ACTIVITY_KEY = ["community-activity"] as const;

const DAYS = 14;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type DailyActivityRow = { day: string; joins: number; posts: number };

/**
 * Fetches daily joins + posts across all community spaces for the last 14 days.
 * Used by the activity charts on the communities dashboard.
 *
 * Runs as one server-side aggregate (security-definer `community_daily_activity`
 * RPC) instead of pulling up to 500 member rows + 500 post rows and counting
 * them client-side — the old shape scaled with activity volume and silently
 * dropped days once either stream crossed its limit.
 */
export function useCommunityActivity() {
  return useQuery({
    queryKey: COMMUNITY_ACTIVITY_KEY,
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (DAYS - 1));
      const sinceIso = since.toISOString();

      const { data, error } = await supabasePending.rpc("community_daily_activity", {
        p_since: sinceIso,
        p_days: DAYS,
      });

      if (error) {
        // RPC not yet migrated / table missing → degrade to an empty chart
        // exactly like the old missing-table path did.
        if (
          error.code === "42P01" ||
          error.code === "42883" ||
          error.code === "PGRST202" ||
          error.code === "404"
        ) {
          return buildEmpty(DAYS);
        }
        throw error;
      }

      const rows = (data ?? []) as DailyActivityRow[];
      if (rows.length === 0) return buildEmpty(DAYS);

      // Fill every day so the chart never has gaps; server rows are counts.
      const byDay = new Map(rows.map((r) => [r.day, r]));
      const out: ActivityPoint[] = [];
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        const key = dateKey(d);
        const row = byDay.get(key);
        out.push({
          date: key,
          joins: Number(row?.joins ?? 0),
          posts: Number(row?.posts ?? 0),
        });
      }
      return out;
    },
    staleTime: 60_000,
  });
}

function buildEmpty(days: number): ActivityPoint[] {
  const out: ActivityPoint[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: dateKey(d), joins: 0, posts: 0 });
  }
  return out;
}
