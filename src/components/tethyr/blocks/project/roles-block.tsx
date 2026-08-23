import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, MapPin, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type RoleRow = { id: string; title: string; description: string | null; commitment: string | null; is_filled: boolean };

function ProjectRolesBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-roles-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as RoleRow[];
      const { data: d } = await (supabase as any).from("project_open_roles").select("id,title,description,commitment,is_filled").eq("project_id", projectId).order("created_at", { ascending: false });
      return (d ?? []) as RoleRow[];
    }, enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.length) { if (context.isEditing) return <BlockEmptyState label="Open Roles" detail="Open roles will appear here." />; return null; }
  const open = data.filter((r) => !r.is_filled);
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Open Roles ({open.length})</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((r) => (
          <div key={r.id} className={`rounded-lg border p-3 ${r.is_filled ? "border-border/40 opacity-60" : "border-border bg-surface"}`}>
            <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm font-medium">{r.title}</span></div>
            {r.commitment && <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{r.commitment}</p>}
            {r.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
registerBlock({ type: "project-roles", category: "project", label: "Open Roles", description: "Roles the project is looking to fill.", icon: "Briefcase", defaults: {}, component: ProjectRolesBlock });
export { ProjectRolesBlock };