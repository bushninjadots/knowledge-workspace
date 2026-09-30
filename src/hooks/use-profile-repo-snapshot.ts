// ── Profile repo snapshot (work-evidence stats + aggregate graph) ────────────
// One batched read over `project_repositories_safe` for the projects a
// profile's work evidence already resolved to visible. Two outputs:
//
//   * per-project stats (stars / language / private) — the small facts a work
//     row can carry without becoming a GitHub card
//   * one aggregate 52-week contribution graph — the union of every linked
//     repo's cached history, merged client-side by week
//
// Everything comes from the cached snapshot written at link/import/sync time;
// a profile view never calls GitHub. Repos without a cached history simply
// don't contribute weeks — the graph shows what's known, not a guess.
import { useQuery } from "@tanstack/react-query";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { mergeCommitActivity } from "@/lib/github";
import type { CommitActivityWeek } from "@/lib/github";

export type RepoSnapshot = {
  projectId: string;
  fullName: string | null;
  stargazersCount: number | null;
  language: string | null;
  private: boolean | null;
  commitActivity: CommitActivityWeek[] | null;
};

type SafeRepoRow = {
  project_id: string;
  metadata: {
    full_name?: string | null;
    stargazers_count?: number | null;
    language?: string | null;
    private?: boolean | null;
    commit_activity?: CommitActivityWeek[] | null;
  } | null;
};

function toSnapshot(row: SafeRepoRow): RepoSnapshot {
  return {
    projectId: row.project_id,
    fullName: row.metadata?.full_name ?? null,
    stargazersCount: row.metadata?.stargazers_count ?? null,
    language: row.metadata?.language ?? null,
    private: row.metadata?.private ?? null,
    commitActivity:
      Array.isArray(row.metadata?.commit_activity) && row.metadata.commit_activity.length > 0
        ? row.metadata.commit_activity
        : null,
  };
}

export function useProfileRepoSnapshot(projectIds: string[] | null | undefined) {
  const key = (projectIds ?? []).join(",");
  return useQuery({
    queryKey: ["profile-repo-snapshot", key],
    // The return type is inferred — consumers read the shape off the query
    // result, so no separately exported aggregate type to maintain.
    queryFn: async () => {
      const ids = key ? key.split(",") : [];
      if (ids.length === 0) {
        return { byProject: new Map(), aggregateWeeks: [], totalCommits: 0, reposWithHistory: 0 };
      }
      // The safe view filters by project visibility (security_invoker + RLS),
      // so this read leaks nothing beyond what the caller already resolved.
      const { data, error } = await supabasePending
        .from("project_repositories_safe")
        .select("project_id, metadata")
        .in("project_id", ids);
      if (error) throw error;

      const byProject = new Map<string, RepoSnapshot>();
      const weeksList: CommitActivityWeek[][] = [];
      for (const row of (data ?? []) as unknown as SafeRepoRow[]) {
        const snapshot = toSnapshot(row);
        byProject.set(snapshot.projectId, snapshot);
        if (snapshot.commitActivity) weeksList.push(snapshot.commitActivity);
      }
      const aggregateWeeks = mergeCommitActivity(weeksList);
      return {
        byProject,
        aggregateWeeks,
        totalCommits: aggregateWeeks.reduce((n, w) => n + w.total, 0),
        reposWithHistory: weeksList.length,
      };
    },
    enabled: !!projectIds && projectIds.length > 0,
    // Same lifecycle as the work evidence: changes when a repo syncs, not on
    // a timer.
    staleTime: 60_000,
  });
}
