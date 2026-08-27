// ── Project Hero Block ───────────────────────────────────────────────────────
// Renders the project identity banner: title, description, status badge,
// progress bar, and tags. Uses the existing project data hooks.
// Containerless — renders full-width without extra wrapper.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";
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
  const previewProject = context.data?.project as ProjectHeroData | undefined;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-hero", projectId],
    queryFn: async (): Promise<ProjectHeroData | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, status, stage, progress_percent, cover_url, tags, looking_for_collaborators, looking_for_feedback",
        )
        .eq("id", projectId)
        .maybeSingle();
      if (error || !data) return null;
      return data as unknown as ProjectHeroData;
    },
    enabled: !!projectId,
  });

  const resolvedProject = previewProject ?? project;

  const bannerStyle = useMemo(() => {
    if (!resolvedProject?.cover_url) return {};
    return {
      backgroundImage: `url(${resolvedProject.cover_url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [resolvedProject?.cover_url]);

  const showDescription = config.showDescription !== false;
  const showProgress = config.showProgress !== false;
  const showTags = config.showTags !== false;

  if (isLoading && !previewProject) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
    );
  }

  if (!resolvedProject) {
    if (context.isEditing) {
      return (
        <BlockEmptyState label="Project Hero" detail="Project data is loading or not available." />
      );
    }
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl" style={bannerStyle}>
      {/* Overlay for readability when banner image is present */}
      {resolvedProject.cover_url && <div className="absolute inset-0 bg-background/90" />}

      <div className="relative px-6 py-8 sm:px-8 sm:py-12">
        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {resolvedProject.title}
        </h1>

        {/* Status + Stage badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {STATUS_LABEL[resolvedProject.status] ?? resolvedProject.status}
          </Badge>
          {resolvedProject.stage && (
            <Badge variant="outline" className="text-xs">
              <MapPin className="mr-1 h-3 w-3" />
              {STAGE_LABEL[resolvedProject.stage] ?? resolvedProject.stage}
            </Badge>
          )}
          {resolvedProject.looking_for_collaborators && (
            <Badge variant="secondary" className="text-xs bg-learning-subtle text-learning">
              Looking for collaborators
            </Badge>
          )}
          {resolvedProject.looking_for_feedback && (
            <Badge variant="secondary" className="text-xs bg-teaching-subtle text-teaching">
              Open to feedback
            </Badge>
          )}
        </div>

        {/* Description */}
        {showDescription && resolvedProject.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {resolvedProject.description}
          </p>
        )}

        {/* Progress bar */}
        {showProgress && resolvedProject.progress_percent > 0 && (
          <div className="mt-4 flex max-w-sm items-center gap-3">
            <Progress value={resolvedProject.progress_percent} className="h-2 flex-1" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {resolvedProject.progress_percent}%
            </span>
          </div>
        )}

        {/* Tags */}
        {showTags && resolvedProject.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {resolvedProject.tags.map((tag) => (
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
  fields: [
    { key: "showDescription", label: "Show description", type: "toggle" },
    { key: "showProgress", label: "Show progress bar", type: "toggle" },
    { key: "showTags", label: "Show tags", type: "toggle" },
  ],
  containerless: true,
  component: ProjectHeroBlock,
});

export { ProjectHeroBlock };
