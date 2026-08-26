import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { timeAgo } from "@/lib/time";

type TimelineRow = {
  id: string;
  title: string;
  kind: string;
  created_at: string;
  metadata: unknown;
};

const KIND_LABELS: Record<string, string> = {
  project_created: "Project created",
  milestone_completed: "Milestone completed",
  update_published: "Update published",
  member_joined: "Member joined",
  file_added: "File added",
  need_created: "Need created",
  challenge_completed: "Challenge completed",
};

function ProjectTimelineBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-timeline-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as TimelineRow[];
      const { data: d } = await supabase
        .from("project_activity")
        .select("id,title,kind,created_at,metadata")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(30);
      return (d ?? []) as unknown as TimelineRow[];
    },
    enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Timeline"
          detail="Project timeline will build up as work happens."
        />
      );
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Timeline</h4>
      <div className="relative border-l-2 border-border/60 pl-4 space-y-4">
        {data.map((item) => (
          <div key={item.id} className="relative">
            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-border/60 bg-surface" />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-0.5">
              <Clock className="h-3 w-3" />
              <span>{timeAgo(item.created_at)}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {KIND_LABELS[item.kind] ?? item.kind.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "project-timeline",
  category: "project",
  label: "Timeline",
  description: "Chronological history of everything that happened in this project.",
  icon: "Clock",
  defaults: {},
  component: ProjectTimelineBlock,
});
export { ProjectTimelineBlock };
