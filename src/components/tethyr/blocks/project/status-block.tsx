// ── Project Status Block ─────────────────────────────────────────────────────
// Compact status display: status badge, stage, progress, season, and tools.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Wrench } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type StatusData = {
  status: string;
  stage: string | null;
  progress_percent: number;
  season: string | null;
  tools: string[];
};

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};
const SEASON_LABEL: Record<string, string> = {
  research: "Researching",
  prototype: "Prototyping",
  feedback: "Gathering feedback",
  launch: "Launching",
  building: "Building",
};

function ProjectStatusBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["project-status", projectId],
    queryFn: async (): Promise<StatusData | null> => {
      if (!projectId) return null;
      const { data } = await supabase
        .from("projects")
        .select("status, stage, progress_percent, season, tools")
        .eq("id", projectId)
        .maybeSingle();
      return data as unknown as StatusData | null;
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Status & Progress"
          detail="Project data is loading or not available."
        />
      );
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Badge variant="secondary" className="text-xs">
            {STATUS_LABEL[data.status] ?? data.status}
          </Badge>
        </div>

        {/* Stage */}
        {data.stage && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Stage</span>
            <span className="text-xs text-foreground">{data.stage}</span>
          </div>
        )}

        {/* Season */}
        {data.season && (
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground">
              {SEASON_LABEL[data.season] ?? data.season}
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      {data.progress_percent > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <Progress value={data.progress_percent} className="h-1.5 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {data.progress_percent}%
          </span>
        </div>
      )}

      {/* Tools */}
      {data.tools && data.tools.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          {data.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "project-status",
  category: "project",
  label: "Status & Progress",
  description: "Current status, stage, progress bar, season, and tool stack.",
  icon: "BarChart3",
  defaults: { showProgress: true, showStage: true, showTools: true },
  fields: [
    { key: "showProgress", label: "Show progress bar", type: "toggle" },
    { key: "showStage", label: "Show current stage", type: "toggle" },
    { key: "showTools", label: "Show tool stack", type: "toggle" },
  ],
  component: ProjectStatusBlock,
});

export { ProjectStatusBlock };
