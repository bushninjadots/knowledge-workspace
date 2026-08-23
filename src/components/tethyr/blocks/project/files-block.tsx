import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type FileRow = { name: string; size: number; created_at: string };

function ProjectFilesBlock({ context }: BlockProps) {
  const projectId = context.ownerType === "project" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["project-files-block", projectId],
    queryFn: async (): Promise<FileRow[]> => {
      if (!projectId) return [];
      const { data: d } = await (supabase as any)
        .from("project_files")
        .select("name, size, created_at")
        .eq("project_id", projectId).order("created_at", { ascending: false }).limit(20);
      return (d ?? []) as unknown as FileRow[];
    },
    enabled: !!projectId,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data || data.length === 0) {
    if (context.isEditing) return <BlockEmptyState label="Files" detail="Files will appear here when uploaded." />;
    return null;
  }

  const fmtSize = (bytes: number) => bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(1)}MB`;

  return (
    <div>
      <h4 className="mb-3 text-sm font-medium text-foreground">Files ({data.length})</h4>
      <div className="divide-y divide-border/50 rounded-lg border border-border">
        {data.slice(0, 10).map((f) => (
          <div key={f.name} className="flex items-center gap-3 px-3 py-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate font-medium text-foreground">{f.name}</span>
            <span className="text-muted-foreground tabular-nums">{fmtSize(f.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

registerBlock({ type: "project-files", category: "project", label: "Files", description: "Uploaded project files.", icon: "FileText", defaults: {}, component: ProjectFilesBlock });
export { ProjectFilesBlock };