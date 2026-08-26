import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
};

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  done: CheckCircle,
  in_progress: Clock,
  pending: Circle,
};

function ProjectMilestonesBlock({ config, context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["project-milestones-block", projectId],
    queryFn: async (): Promise<MilestoneRow[]> => {
      if (!projectId) return [];
      const { data: d } = await supabase
        .from("project_milestones")
        .select("id,title,description,status,due_date")
        .eq("project_id", projectId)
        .order("created_at");
      return (d ?? []) as unknown as MilestoneRow[];
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return (
        <BlockEmptyState label="Milestones" detail="Milestones will appear here when added." />
      );
    return null;
  }

  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Milestones ({data.length})</h4>
      <div className="space-y-2">
        {data.map((m) => {
          const Icon = STATUS_ICON[m.status] ?? Circle;
          return (
            <div key={m.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${m.status === "done" ? "text-trust" : m.status === "in_progress" ? "text-learning" : "text-muted-foreground"}`}
                  />
                  <span className="text-sm font-medium">{m.title}</span>
                </div>
                {m.due_date && config.showDueDates !== false && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {m.description && config.showDescriptions !== false && (
                <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-milestones",
  category: "project",
  label: "Milestones",
  description: "Project milestones with status and progress.",
  icon: "Milestone",
  defaults: { showDescriptions: true, showDueDates: true },
  fields: [
    { key: "showDescriptions", label: "Show descriptions", type: "toggle" },
    { key: "showDueDates", label: "Show due dates", type: "toggle" },
  ],
  component: ProjectMilestonesBlock,
});
export { ProjectMilestonesBlock };
