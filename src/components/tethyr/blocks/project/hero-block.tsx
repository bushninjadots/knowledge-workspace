// ── Project Hero Block ───────────────────────────────────────────────────────
// Renders the project identity banner: title, description, status badge,
// progress bar, and tags. Uses the existing project data hooks.
// Containerless — renders full-width without extra wrapper.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type ProjectHeroData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  stage: string | null;
  progress_percent: number;
  cover_url: string | null;
  tags: string[];
  looking_for_collaborators: boolean;
  looking_for_feedback: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};
const STAGE_LABEL: Record<string, string> = {
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  launch: "Launch",
  growing: "Growing",
};

function ProjectHeroBlock({ config, context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-hero", projectId],
    queryFn: async (): Promise<ProjectHeroData | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, status, stage, progress_percent, cover_url, tags, looking_for_collaborators, looking_for_feedback")
        .eq("id", projectId)
        .maybeSingle();
      if (error || !data) return null;
      return data as unknown as ProjectHeroData;
    },
    enabled: !!projectId,
  });

  const bannerStyle = useMemo(() => {
    if (!project?.cover_url) return {};
    return {
      backgroundImage: `url(${project.cover_url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [project?.cover_url]);

  const showDescription = config.showDescription !== false;
  const showProgress = config.showProgress !== false;
  const showTags = config.showTags !== false;

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!project) {
    if (context.isEditing) {
      return <BlockEmptyState label="Project Hero" detail="Project data is loading or not available." />;
    }
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl" style={bannerStyle}>
      {/* Dark overlay for readability when banner image is present */}
      {project.cover_url && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      )}

      <div className="relative px-6 py-8 sm:px-8 sm:py-12">
        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {project.title}
        </h1>

        {/* Status + Stage badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {STATUS_LABEL[project.status] ?? project.status}
          </Badge>
          {project.stage && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="mr-1 h-3 w-3" />
              {STAGE_LABEL[project.stage] ?? project.stage}
            </Badge>
          )}
          {project.looking_for_collaborators && (
            <Badge variant="secondary" className="text-xs bg-learning-subtle text-learning">
              Looking for collaborators
            </Badge>
          )}
          {project.looking_for_feedback && (
            <Badge variant="secondary" className="text-xs bg-teaching-subtle text-teaching">
              Open to feedback
            </Badge>
          )}
        </div>

        {/* Description */}
        {showDescription && project.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        )}

        {/* Progress bar */}
        {showProgress && project.progress_percent > 0 && (
          <div className="mt-4 flex max-w-sm items-center gap-3">
            <Progress value={project.progress_percent} className="h-2 flex-1" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {project.progress_percent}%
            </span>
          </div>
        )}

        {/* Tags */}
        {showTags && project.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-hero",
  category: "project",
  label: "Project Hero",
  description: "The project's identity banner — title, status, progress, and tags.",
  icon: "Layout",
  defaults: { showDescription: true, showProgress: true, showTags: true },
  containerless: true,
  component: ProjectHeroBlock,
});

export { ProjectHeroBlock };