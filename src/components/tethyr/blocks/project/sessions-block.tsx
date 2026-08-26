import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type SessionRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  session_type: string | null;
};

function ProjectSessionsBlock({ config, context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-sessions-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as SessionRow[];
      const { data: d } = await supabase
        .from("sessions")
        .select("id,title,starts_at,ends_at,session_type")
        .eq("project_id", projectId)
        .order("starts_at", { ascending: false })
        .limit(15);
      return (d ?? []) as unknown as SessionRow[];
    },
    enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return <BlockEmptyState label="Sessions" detail="Scheduled sessions will appear here." />;
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Sessions ({data.length})</h4>
      <div className="space-y-2">
        {data.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{s.title}</span>
              {s.session_type && config.showType !== false && (
                <span className="text-[10px] text-muted-foreground uppercase">
                  {s.session_type.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
              {s.starts_at && config.showDates !== false && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(s.starts_at).toLocaleDateString()}
                </span>
              )}
              {s.ends_at && config.showDates !== false && (
                <span>– {new Date(s.ends_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "project-sessions",
  category: "community",
  label: "Sessions",
  description: "Scheduled work sessions for this project.",
  icon: "Calendar",
  defaults: { showType: true, showDates: true },
  fields: [
    { key: "showType", label: "Show session type", type: "toggle" },
    { key: "showDates", label: "Show dates", type: "toggle" },
  ],
  component: ProjectSessionsBlock,
});
export { ProjectSessionsBlock };
