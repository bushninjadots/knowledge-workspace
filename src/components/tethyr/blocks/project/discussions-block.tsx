import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Clock, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type DiscussionRow = { id: string; title: string; body: string | null; created_at: string; profiles: { display_name: string | null; handle: string | null } | null };

function ProjectDiscussionsBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-discussions-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as DiscussionRow[];
      const { data: d } = await (supabase as any).from("project_discussions").select("id,title,body,created_at,profiles(display_name,handle)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20);
      return (d ?? []) as DiscussionRow[];
    }, enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!data?.length) { if (context.isEditing) return <BlockEmptyState label="Discussions" detail="Discussions will appear here." />; return null; }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Discussions ({data.length})</h4>
      <div className="space-y-2">
        {data.slice(0, 10).map((d) => (
          <div key={d.id} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
              <User className="h-3 w-3" />{d.profiles?.display_name ?? d.profiles?.handle ?? "Someone"}
              <Clock className="h-3 w-3 ml-2" />{new Date(d.created_at).toLocaleDateString()}
            </div>
            <h5 className="text-sm font-medium flex items-center gap-1.5">{d.title}</h5>
            {d.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({ type: "project-discussions", category: "community", label: "Discussions", description: "Project discussions and conversations.", icon: "MessageSquare", defaults: {}, component: ProjectDiscussionsBlock });
export { ProjectDiscussionsBlock };