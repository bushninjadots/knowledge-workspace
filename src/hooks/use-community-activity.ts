import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Fetches daily joins + posts across all community spaces for the last 14 days.
 * Used by the activity charts on the communities dashboard.
 */
export function useCommunityActivity() {
  return useQuery({
    queryKey: COMMUNITY_ACTIVITY_KEY,
    queryFn: async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (DAYS - 1));
      const sinceIso = since.toISOString();

      // Fetch recent member joins (RLS: only visible for spaces you've joined)
      const { data: memberRows, error: memberErr } = await supabase
        .from("community_space_members")
        .select("joined_at, space_id")
        .gte("joined_at", sinceIso)
        .order("joined_at", { ascending: true })
        .limit(500);

      if (memberErr) {
        if (memberErr.code === "42P01" || memberErr.message?.includes("Could not find the table")) {
          return buildEmpty(DAYS);
        }
        throw memberErr;
      }

      // Fetch recent posts in spaces
      const { data: postRows, error: postErr } = await supabase
        .from("posts")
        .select("created_at, space_id")
        .gte("created_at", sinceIso)
        .not("space_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(500);

      if (postErr) {
        if (postErr.code === "42P01" || postErr.message?.includes("Could not find the table")) {
          return buildEmpty(DAYS);
        }
        throw postErr;
      }

      // Build day buckets
      const buckets = new Map<string, ActivityPoint>();
      for (let i = 0; i < DAYS; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        buckets.set(dateKey(d), { date: dateKey(d), joins: 0, posts: 0 });
      }

      for (const row of memberRows ?? []) {
        const key = (row as { joined_at: string }).joined_at.slice(0, 10);
        const b = buckets.get(key);
        if (b) b.joins += 1;
      }

      for (const row of postRows ?? []) {
        const key = (row as { created_at: string }).created_at.slice(0, 10);
        const b = buckets.get(key);
        if (b) b.posts += 1;
      }

      return Array.from(buckets.values());
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
