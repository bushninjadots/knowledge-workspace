import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectSnapshot } from "@/hooks/use-community";
import { useSignedStorageUrl } from "@/hooks/use-signed-url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STAGE_LABEL: Record<string, string> = {
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  launch: "Launch",
  growing: "Growing",
};

type Props = {
  project_id?: string | null;
  project_snapshot?: ProjectSnapshot | null;
};

export function ProjectCardInline({ project_id, project_snapshot }: Props) {
  const { data: liveProject } = useQuery({
    queryKey: ["project-inline", project_id],
    queryFn: async () => {
      if (!project_id) return null;
      const { data, error } = await sb
        .from("projects")
        .select("id, title, description, stage, status, cover_url")
        .eq("id", project_id)
        .single();
      if (error) return null;
      return data as {
        id: string;
        title: string;
        description: string | null;
        stage: string;
        status: string;
        cover_url: string | null;
      };
    },
    enabled: !!project_id,
    staleTime: 30_000,
  });

  // Prefer live project data, fall back to snapshot
  const project = liveProject;
  const snapshot = project_snapshot;

  const name = project?.title ?? snapshot?.name ?? "Project";
  const description = project?.description ?? snapshot?.description ?? null;
  const stage = project?.stage ?? snapshot?.stage ?? null;
  const { data: signedCoverUrl } = useSignedStorageUrl("project-media", project?.cover_url);
  // Live covers live in Supabase storage and need signing; snapshot-only logos
  // are already full external URLs.
  const logo = project ? (signedCoverUrl ?? null) : (snapshot?.logo ?? null);
  const platform = snapshot?.platform ?? "tethyr";
  const isExternal = platform !== "tethyr";

  const content = (
    <div className="flex items-center gap-3">
      {logo ? (
        <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
          <FolderOpen className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          {stage && (
            <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0 text-[10px] text-muted-foreground">
              {STAGE_LABEL[stage] ?? stage}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {isExternal ? (
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <span className="text-[10px] text-muted-foreground">Open →</span>
      )}
    </div>
  );

  if (!project_id && !snapshot) return null;

  const cardClass =
    "rounded-2xl border border-border/60 bg-background/40 p-3 block transition hover:bg-surface-elevated";

  if (isExternal && snapshot?.url) {
    return (
      <a href={snapshot.url} target="_blank" rel="noreferrer" className={cardClass}>
        {content}
      </a>
    );
  }

  if (project_id) {
    return (
      <Link to="/projects/$id" params={{ id: project_id }} className={cardClass}>
        {content}
      </Link>
    );
  }

  // Snapshot only (external, no project_id)
  return <div className={cardClass}>{content}</div>;
}
