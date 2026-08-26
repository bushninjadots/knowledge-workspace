import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Image, Camera, Link2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type EvidenceRow = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  url: string | null;
  created_at: string;
};

function ProjectEvidenceBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["project-evidence-block", projectId],
    queryFn: async () => {
      if (!projectId) return [] as EvidenceRow[];
      // Demonstrations are stored on the project as a gallery array
      // (url + caption + type) — the same data the "Add demonstration"
      // flow writes on the project page.
      const { data: project } = await supabase
        .from("projects")
        .select("gallery")
        .eq("id", projectId)
        .maybeSingle();
      const gallery = (project?.gallery ?? []) as unknown as {
        url: string;
        caption?: string;
        type: "image" | "video";
      }[];
      return gallery.map((g, i): EvidenceRow => ({
        id: `${projectId}-${i}`,
        title: g.caption ?? "Demonstration",
        description: null,
        kind: g.type,
        url: g.url ?? null,
        created_at: "",
      }));
    },
    enabled: !!projectId,
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data?.length) {
    if (context.isEditing)
      return <BlockEmptyState label="Evidence" detail="Demonstrations will appear here." />;
    return null;
  }
  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Evidence ({data.length})</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((e) => (
          <a
            key={e.id}
            href={e.url ?? "#"}
            target={e.url ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-elevated"
          >
            {e.kind === "image" ? (
              <Image className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            ) : e.kind === "video" ? (
              <Camera className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            ) : (
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{e.title}</p>
              {e.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
registerBlock({
  type: "project-evidence",
  category: "project",
  label: "Evidence",
  description: "Demonstrations and proof of work.",
  icon: "Camera",
  defaults: {},
  component: ProjectEvidenceBlock,
});
export { ProjectEvidenceBlock };
