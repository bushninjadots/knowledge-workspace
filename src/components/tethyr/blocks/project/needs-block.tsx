import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type NeedRow = { id: string; title: string; note: string | null; is_filled: boolean };

function ProjectNeedsBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-needs-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as NeedRow[];
      const { data: d } = await supabase
        .from("project_needs")
        .select("id,title,note,is_filled")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      return (d ?? []) as unknown as NeedRow[];
    },
    enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return <BlockEmptyState label="Needs" detail="Project needs will appear here." />;
    return null;
  }
  const openCount = data.filter((n) => !n.is_filled).length;
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">
        What this project needs ({openCount} open)
      </h4>
      <div className="space-y-1.5">
        {data.map((n) => (
          <div
            key={n.id}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${n.is_filled ? "opacity-60" : ""}`}
          >
            {n.is_filled ? (
              <CheckCircle className="h-4 w-4 text-trust shrink-0" />
            ) : (
              <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-foreground">{n.title}</span>
            {n.note && (
              <span className="text-muted-foreground text-xs ml-auto truncate max-w-[200px]">
                {n.note}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "project-needs",
  category: "project",
  label: "Needs",
  description: "What the project needs — skills, help, feedback.",
  icon: "Lightbulb",
  defaults: {},
  component: ProjectNeedsBlock,
});
export { ProjectNeedsBlock };
