import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

export type ProjectRepo = {
  id: string;
  project_id: string;
  url: string;
  provider: string;
  metadata: RepoMetadata;
  created_at: string;
  updated_at: string;
};

export type RepoMetadata = {
  full_name?: string;
  description?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  updated_at?: string;
  topics?: string[];
  private?: boolean;
};

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
          // Try to fetch GitHub metadata
          try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
            if (res.ok) {
              const json = await res.json();
              metadata = {
                full_name: json.full_name,
                description: json.description,
                language: json.language,
                stargazers_count: json.stargazers_count,
                forks_count: json.forks_count,
                updated_at: json.updated_at,
                topics: json.topics,
                private: json.private,
              };
            }
          } catch {
            // GitHub API may be rate-limited; use whatever we parsed
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
      toast.success("Repository linked");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRemoveProjectRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; project_id: string }) => {
      const { error } = await sb
        .from("project_repositories")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-repos", variables.project_id] });
      toast.success("Repository removed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Refresh metadata for a repo (e.g., to update star count)
export function useRefreshRepoMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; project_id: string; url: string; provider: string }) => {
      let metadata: RepoMetadata = {};

      if (input.provider === "github") {
        const match = input.url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
            if (res.ok) {
              const json = await res.json();
              metadata = {
                full_name: json.full_name,
                description: json.description,
                language: json.language,
                stargazers_count: json.stargazers_count,
                forks_count: json.forks_count,
                updated_at: json.updated_at,
                topics: json.topics,
              };
            }
          } catch { /* ignore */ }
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
