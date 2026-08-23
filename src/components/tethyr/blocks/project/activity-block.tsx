// ── Project Activity Block ───────────────────────────────────────────────────
// Shows recent project activity as a simple chronological list.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";
import { timeAgo } from "@/lib/time";

type ActivityRow = {
  id: string;
  kind: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const KIND_LABEL: Record<string, string> = {
  milestone_completed: "completed a milestone",
  update_published: "published an update",
  member_joined: "joined the project",
  role_opened: "opened a new role",
  file_added: "added a file",
  need_created: "created a need",
  project_created: "created the project",
};

function ProjectActivityBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data: activity, isLoading } = useQuery({
    queryKey: ["project-activity-block", projectId],
    queryFn: async (): Promise<ActivityRow[]> => {
      if (!projectId) return [];
      const { data } = await supabase
        .from("project_activity")
        .select("id, kind, created_at, metadata")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as unknown as ActivityRow[];
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (!activity || activity.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">Recent activity</h3>
      <div className="space-y-1">
        {activity.slice(0, 10).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
          >
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              {KIND_LABEL[item.kind] ?? item.kind.replace(/_/g, " ")}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground/70">
              {timeAgo(item.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock({
  type: "project-activity",
  category: "community",
  label: "Activity",
  description: "A chronological feed of recent project activity.",
  icon: "Clock",
  defaults: {},
  component: ProjectActivityBlock,
});

export { ProjectActivityBlock };