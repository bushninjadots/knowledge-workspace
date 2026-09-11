import { useQuery } from "@tanstack/react-query";
import { GitBranch, ExternalLink, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { safeHref } from "@/lib/validators";
import { supabasePending } from "@/lib/supabase-pending-schema";
import { listGithubRepos } from "@/lib/github-server";

type RepoRow = {
  id: string;
  provider: string;
  url: string;
  name: string;
  stars?: number | null;
};

function ProjectReposBlock({ config, context }: BlockProps) {
  const isProject = context.ownerType === "project";
  const projectId = isProject ? context.ownerId : null;

  const projectQuery = useQuery({
    queryKey: ["project-repos-block", projectId],
    queryFn: async (): Promise<RepoRow[]> => {
      if (!projectId) return [];
      const { data: d } = await supabasePending
        .from("project_repositories_safe")
        .select("id, provider, url")
        .eq("project_id", projectId)
        .order("provider");
      return ((d ?? []) as unknown as RepoRow[]).map((repo) => ({
        ...repo,
        name: (repo.url ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
      }));
    },
    enabled: isProject,
  });

  const profileQuery = useQuery({
    queryKey: ["project-repos-profile"],
    queryFn: async (): Promise<RepoRow[]> => {
      const repos = await listGithubRepos();
      return repos.map((r) => ({
        id: r.full_name,
        provider: "github",
        url: r.html_url,
        name: r.full_name,
        stars: r.stargazers_count,
      }));
    },
    enabled: !isProject,
  });

  const isLoading = isProject ? projectQuery.isLoading : profileQuery.isLoading;
  const data = isProject ? projectQuery.data : profileQuery.data;

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data || data.length === 0) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Repositories"
          detail={
            isProject
              ? "Connected repos will appear here."
              : "Your GitHub repositories will appear here once linked."
          }
        />
      );
    return null;
  }

  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Repositories ({data.length})</h4>
      <div className="grid gap-2">
        {data.map((repo) => (
          <a
            key={repo.id}
            href={safeHref(repo.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
          >
            <div className="min-w-0 flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">{repo.name}</span>
              {config.showProvider !== false && (
                <span className="text-[10px] text-muted-foreground uppercase">{repo.provider}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              {config.showStars !== false && repo.stars != null && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Star className="h-3 w-3" />
                  {repo.stars}
                </span>
              )}
              <ExternalLink className="h-3 w-3" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-repos",
  category: "project",
  label: "Repositories",
  description:
    "Linked git repositories on project pages; your GitHub repositories on studio pages.",
  icon: "GitBranch",
  defaults: { showStars: true, showProvider: true },
  fields: [
    { key: "showStars", label: "Show star counts", type: "toggle" },
    { key: "showProvider", label: "Show provider badge", type: "toggle" },
  ],
  ownerContext: "both",
  component: ProjectReposBlock,
});
export { ProjectReposBlock };
