// A member's cached GitHub account snapshot (profile_github), for the Studio's
// GitHub block, and the action that refreshes it on the server.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GithubProfileSnapshot } from "@/lib/github-profile";
import { syncGithubProfile } from "@/lib/github-server";

export const GITHUB_PROFILE_KEY = (profileId: string) => ["github-profile", profileId] as const;

/** A snapshot older than this is refreshed when its owner looks at it. */
export const GITHUB_PROFILE_STALE_MS = 12 * 60 * 60_000;

export type GithubProfileRow = {
  username: string;
  snapshot: GithubProfileSnapshot;
  synced_at: string;
};

export function useGithubProfile(profileId: string | null | undefined) {
  return useQuery({
    queryKey: GITHUB_PROFILE_KEY(profileId ?? ""),
    enabled: !!profileId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GithubProfileRow | null> => {
      const { data, error } = await supabase
        .from("profile_github")
        .select("username, snapshot, synced_at")
        .eq("profile_id", profileId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as GithubProfileRow | null) ?? null;
    },
  });
}

/** Refresh the signed-in member's snapshot from GitHub now. */
export function useSyncGithubProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await syncGithubProfile()).result,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["github-profile"] }),
  });
}

export function isGithubProfileStale(row: GithubProfileRow | null | undefined, now = Date.now()) {
  return !row || now - Date.parse(row.synced_at) > GITHUB_PROFILE_STALE_MS;
}
