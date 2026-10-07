// ── Profile README ────────────────────────────────────────────────────────────
// `profiles.readme` (markdown) is shown by both the README block and the
// About block on a Studio. One read, one cache key and one save, so editing
// it in either place updates both — including where it came from on GitHub
// (`profiles.readme_source`), which makes "Sync from GitHub" possible.

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { friendlyError } from "@/lib/error-message";

export type ReadmeSource = { repo: string; synced_at: string | null };

export type ProfileReadme = {
  readme: string | null;
  social_links: Record<string, string> | null;
  readme_source: ReadmeSource | null;
};

export function parseReadmeSource(raw: unknown): ReadmeSource | null {
  if (!raw || typeof raw !== "object") return null;
  const { repo, synced_at } = raw as { repo?: unknown; synced_at?: unknown };
  if (typeof repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { repo, synced_at: typeof synced_at === "string" ? synced_at : null };
}

export const profileReadmeKey = (profileId: string | null) => ["profile-readme", profileId];

export function useProfileReadme(profileId: string | null) {
  return useQuery({
    queryKey: profileReadmeKey(profileId),
    queryFn: async (): Promise<ProfileReadme | null> => {
      if (!profileId) return null;
      const { data } = await supabasePending
        .from("profiles")
        .select("readme, social_links, readme_source")
        .eq("id", profileId)
        .maybeSingle();
      if (!data) return null;
      const row = data as unknown as Omit<ProfileReadme, "readme_source"> & {
        readme_source?: unknown;
      };
      return { ...row, readme_source: parseReadmeSource(row.readme_source) };
    },
    enabled: !!profileId,
  });
}

/**
 * Save the README. `source`: a GitHub repo it now comes from (imported or
 * synced just now), null to stop syncing, or omitted to leave it as is.
 */
export function useSaveProfileReadme(profileId: string | null) {
  const queryClient = useQueryClient();
  return useCallback(
    async (
      content: string,
      options: { source?: string | null; message?: string } = {},
    ): Promise<boolean> => {
      if (!profileId) return false;
      const patch: Record<string, unknown> = { readme: content.trim() || null };
      if (options.source !== undefined) {
        patch.readme_source = options.source
          ? { repo: options.source, synced_at: new Date().toISOString() }
          : null;
      }
      const { error } = await supabasePending.from("profiles").update(patch).eq("id", profileId);
      if (error) {
        toast.error(friendlyError(error));
        return false;
      }
      await queryClient.invalidateQueries({ queryKey: profileReadmeKey(profileId) });
      toast.success(options.message ?? "README saved");
      return true;
    },
    [profileId, queryClient],
  );
}

/** Forget where the README came from (it stays as it is). */
export function useStopReadmeSync(profileId: string | null) {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    if (!profileId) return;
    const { error } = await supabasePending
      .from("profiles")
      .update({ readme_source: null })
      .eq("id", profileId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: profileReadmeKey(profileId) });
    toast.success("README will no longer sync from GitHub");
  }, [profileId, queryClient]);
}
