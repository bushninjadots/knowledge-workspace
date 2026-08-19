import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { fetchRepoMetaServer } from "@/lib/github-server";
import type { RepoMeta } from "@/lib/github";

const sb = supabase;

export type ProjectRepo = {
  id: string;
  project_id: string;
  url: string;
  provider: string;
  metadata: RepoMetadata;
  created_at: string;
  updated_at: string;
};

export type RepoMetadata = RepoMeta;

export function useProjectRepos(projectId: string) {
  return useQuery({
    queryKey: ["project-repos", projectId],
    queryFn: async (): Promise<ProjectRepo[]> => {
      const { data, error } = await sb
        .from("project_repositories")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectRepo[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { project_id: string; url: string; provider?: string }) => {
      // Parse GitHub URL to extract owner/repo for metadata fetching
      const provider = input.provider ?? "github";
      let metadata: RepoMetadata = {};

      if (provider === "github") {
        const match = input.url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          metadata.full_name = `${owner}/${repo}`;
          // Fetch metadata server-side (uses the user's stored token when present)
          try {
            const meta = await fetchRepoMetaServer({ data: { owner, repo } });
            if (meta) metadata = meta;
          } catch {
            // Rate-limited or unreachable — keep whatever we parsed
          }
        }
      }

      const { data, error } = await sb
        .from("project_repositories")
        .insert({
          project_id: input.project_id,
          url: input.url,
          provider,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProjectRepo;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-repos", variables.project_id] });
      queryClient.invalidateQueries({ queryKey: ["project-activity", variables.project_id] });
      toast.success("Repository linked");
    },
    onError: (error: Error) => {
      toast.error(friendlyError(error));
    },
  });
}

export function useRemoveProjectRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await sb.from("project_repositories").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-repos", variables.project_id] });
      toast.success("Repository removed");
    },
    onError: (error: Error) => {
      toast.error(friendlyError(error));
    },
  });
}

// Refresh metadata for a repo (e.g., to update star count)
export function useRefreshRepoMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      project_id: string;
      url: string;
      provider: string;
    }) => {
      let metadata: RepoMetadata = {};

      if (input.provider === "github") {
        const match = input.url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          try {
            const meta = await fetchRepoMetaServer({ data: { owner, repo } });
            if (meta) metadata = meta;
          } catch {
            /* ignore */
          }
        }
      }

      const { error } = await sb
        .from("project_repositories")
        .update({ metadata, updated_at: new Date().toISOString() })
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-repos", variables.project_id] });
    },
  });
}
