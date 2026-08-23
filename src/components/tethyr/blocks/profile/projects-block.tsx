// ── Profile Projects Block ────────────────────────────────────────────────────
// Shows projects the person contributed to, with role, status, and progress.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Folder, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ProjectRow = {
  project_id: string;
  role: string;
  projects: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress_percent: number;
    cover_url: string | null;
  } | null;
};

const ROLE_LABEL: Record<string, string> = {
  creator: "Creator", mentor: "Mentor", contributor: "Contributor",
};
const STATUS_LABEL: Record<string, string> = {
  planning: "Planning", active: "Active", paused: "Paused", completed: "Completed",
};

function ProfileProjectsBlock({ context }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-projects-block", profileId],
    queryFn: async (): Promise<ProjectRow[]> => {
      if (!profileId) return [];
      const { data } = await supabase
        .from("project_contributors")
        .select("project_id, role, projects(id, title, description, status, progress_percent, cover_url)")
        .eq("profile_id", profileId)
        .limit(6);
      return (data ?? []) as unknown as ProjectRow[];
    },
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {[1, 2].map((i) => (<Skeleton key={i} className="h-20 w-full rounded-xl" />))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Projects block — contributed projects will appear here.
        </div>
      );
    }
    return null;
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">Projects</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((row) => {
          const project = row.projects;
          if (!project) return null;
          return (
            <Link
              key={row.project_id}
              to="/projects/$id"
              params={{ id: project.id }}
              className="flex flex-col rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-foreground line-clamp-1">
                  {project.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {ROLE_LABEL[row.role] ?? row.role}
                </span>
              </div>
              {project.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {project.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] text-muted-foreground">
                  {STATUS_LABEL[project.status] ?? project.status}
                </span>
                {project.progress_percent > 0 && (
                  <Progress value={project.progress_percent} className="h-1 flex-1" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

registerBlock({
  type: "profile-projects",
  category: "people",
  label: "Featured Projects",
  description: "Projects the person has contributed to, with role and status.",
  icon: "Folder",
  defaults: {},
  component: ProfileProjectsBlock,
});

export { ProfileProjectsBlock };