import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type NeedRow = {
  id: string;
  title: string;
  note: string | null;
  is_filled: boolean;
  project_title: string | null;
};

type ProjectTitleRow = { id: string; title: string | null };

function ProjectNeedsBlock({ config, context }: BlockProps) {
  const ownerId = context.ownerId;
  const profileMode = context.ownerType === "profile";
  const { data, isLoading } = useQuery({
    queryKey: ["project-needs-block", context.ownerType, ownerId],
    queryFn: async () => {
      if (!ownerId) return [] as NeedRow[];
      if (!profileMode) {
        const { data: d } = await supabase
          .from("project_needs")
          .select("id,title,note,is_filled")
          .eq("project_id", ownerId)
          .order("created_at", { ascending: false });
        return (d ?? []).map((n) => ({ ...n, project_title: null })) as NeedRow[];
      }
      // Studio mode: open needs across the owner's projects — surfaces the
      // collaboration asks behind this profile.
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .eq("profile_id", ownerId);
      const projectIds = (projects as ProjectTitleRow[] | null)?.map((p) => p.id) ?? [];
      if (projectIds.length === 0) return [];
      const { data: needs } = await supabase
        .from("project_needs")
        .select("id,title,note,is_filled,project_id")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      const titles = new Map(
        ((projects as ProjectTitleRow[] | null) ?? []).map((p) => [p.id, p.title ?? null]),
      );
      return (needs ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        note: n.note,
        is_filled: n.is_filled,
        project_title: n.project_id ? (titles.get(n.project_id) ?? null) : null,
      }));
    },
    enabled: !!ownerId,
  });
  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  const visible = (data ?? []).filter((n) => config.showFilled !== false || !n.is_filled);
  if (visible.length === 0) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Needs"
          detail={
            profileMode
              ? "Open needs from your projects will appear here."
              : "Project needs will appear here."
          }
        />
      );
    return null;
  }
  const openCount = data!.filter((n) => !n.is_filled).length;
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">
        {profileMode ? "What I'm building needs" : "What this project needs"} ({openCount} open)
      </h4>
      <div className="space-y-1.5">
        {visible.map((n) => (
          <div
            key={n.id}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${n.is_filled ? "opacity-60" : ""}`}
          >
            {n.is_filled ? (
              <CheckCircle className="h-4 w-4 text-trust shrink-0" />
            ) : (
              <Lightbulb className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block text-foreground">{n.title}</span>
              {profileMode && n.project_title && (
                <span className="block text-2xs text-muted-foreground">{n.project_title}</span>
              )}
            </span>
            {n.note && config.showNotes !== false && (
              <span className="ml-auto max-w-[200px] truncate text-xs text-muted-foreground">
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
  description:
    "What needs building — help, skills, collaboration. On studio pages it shows open needs across your projects.",
  icon: "Lightbulb",
  defaults: { showNotes: true, showFilled: true },
  fields: [
    { key: "showNotes", label: "Show notes", type: "toggle" },
    { key: "showFilled", label: "Show filled needs", type: "toggle" },
  ],
  ownerContext: "both",
  component: ProjectNeedsBlock,
});
export { ProjectNeedsBlock };
