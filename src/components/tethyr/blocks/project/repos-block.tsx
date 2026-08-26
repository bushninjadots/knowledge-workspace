import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GitBranch, ExternalLink, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type RepoRow = {
  id: string;
  provider: string;
  url: string;
  metadata: { full_name?: string; stargazers_count?: number } | null;
};

function ProjectReposBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["project-repos-block", projectId],
    queryFn: async (): Promise<RepoRow[]> => {
      if (!projectId) return [];
      const { data: d } = await supabase
        .from("project_repositories")
        .select("id, provider, url, metadata")
        .eq("project_id", projectId)
        .order("provider");
      return (d ?? []) as unknown as RepoRow[];
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data || data.length === 0) {
    if (context.isEditing)
      return <BlockEmptyState label="Repositories" detail="Connected repos will appear here." />;
    return null;
  }

  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Repositories ({data.length})</h4>
      <div className="grid gap-2">
        {" "}
        {data.map((repo) => {
          const displayName =
            repo.metadata?.full_name ??
            repo.url.replace("https://github.com/", "").replace(/\/$/, "");
          return (
            <a
              key={repo.id}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
            >
              <div className="min-w-0 flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{repo.provider}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                {repo.metadata?.stargazers_count != null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {repo.metadata.stargazers_count}
                  </span>
                )}
                <ExternalLink className="h-3 w-3" />
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-repos",
  category: "project",
  label: "Repositories",
  description: "Connected git repositories.",
  icon: "GitBranch",
  defaults: {},
  component: ProjectReposBlock,
});
export { ProjectReposBlock };
