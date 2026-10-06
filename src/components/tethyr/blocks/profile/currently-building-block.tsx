import { useEffect } from "react";
import { BlockTitle } from "@/components/tethyr/blocks/block-title";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type Building = {
  id: string;
  title: string;
  goal: string | null;
  stage: string;
  status: string;
  progress: number;
  updatedAt: string;
  milestone: string | null;
  openRoles: string[];
  collaborators: number;
};

function relative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

async function fetchBuilding(profileId: string, limit: number): Promise<Building[]> {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, goal, stage, status, progress_percent, updated_at")
    .eq("profile_id", profileId)
    .in("status", ["active", "planning"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!projects?.length) return [];
  const ids = projects.map((p) => p.id);
  const [milestones, roles, people] = await Promise.all([
    supabase
      .from("project_milestones")
      .select("project_id, title, position")
      .in("project_id", ids)
      .neq("status", "completed")
      .order("position", { ascending: true }),
    supabase
      .from("project_open_roles")
      .select("project_id, title")
      .in("project_id", ids)
      .eq("is_filled", false),
    supabase.from("project_contributors").select("project_id").in("project_id", ids),
  ]);
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    goal: p.goal,
    stage: p.stage,
    status: p.status,
    progress: p.progress_percent ?? 0,
    updatedAt: p.updated_at,
    milestone: milestones.data?.find((m) => m.project_id === p.id)?.title ?? null,
    openRoles: (roles.data ?? []).filter((r) => r.project_id === p.id).map((r) => r.title),
    collaborators: Math.max(0, (people.data ?? []).filter((r) => r.project_id === p.id).length - 1),
  }));
}

function ProfileCurrentlyBuildingBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const limit = Number(config.limit ?? 1) || 1;
  const show = (key: string) => config[key] !== false;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-currently-building", profileId, limit],
    queryFn: () => fetchBuilding(profileId!, limit),
    enabled: !!profileId,
  });

  const hasContent = (data?.length ?? 0) > 0;
  useEffect(() => {
    if (isLoading || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (!hasContent) {
    if (isEditing)
      return (
        <BlockEmptyState
          label="Currently building"
          detail="Your active projects show here so people can see what you're working on now."
        />
      );
    return null;
  }

  return (
    <div className="min-w-0">
      <BlockTitle config={config}>Currently building</BlockTitle>
      <ul className="divide-y divide-border">
        {data!.map((p) => (
          <li key={p.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="group inline-flex items-center gap-1 text-base font-semibold text-foreground hover:underline"
                >
                  <span className="truncate">{p.title}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </Link>
                {show("showFocus") && p.goal && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.goal}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                {p.stage}
              </span>
            </div>

            {show("showProgress") && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                  />
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {p.progress}%
                </span>
              </div>
            )}

            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              {show("showMilestone") && p.milestone && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Next:</dt>
                  <dd className="truncate text-foreground">{p.milestone}</dd>
                </div>
              )}
              {show("showNeeds") && p.openRoles.length > 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Needs:</dt>
                  <dd className="truncate text-foreground">{p.openRoles.join(", ")}</dd>
                </div>
              )}
              {show("showCollaborators") && p.collaborators > 0 && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">With:</dt>
                  <dd className="text-foreground">
                    {p.collaborators} collaborator{p.collaborators === 1 ? "" : "s"}
                  </dd>
                </div>
              )}
              {show("showUpdated") && (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="text-foreground">{relative(p.updatedAt)}</dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

registerBlock({
  type: "profile-currently-building",
  category: "work",
  label: "Currently building",
  title: "Currently building",
  description: "What you're actively working on, with progress and what you need.",
  icon: "Hammer",
  defaults: {
    limit: "1",
    showFocus: true,
    showProgress: true,
    showMilestone: true,
    showNeeds: true,
    showCollaborators: true,
    showUpdated: true,
  },
  fields: [
    {
      key: "limit",
      label: "Projects shown",
      type: "select",
      options: [
        { label: "Main project only", value: "1" },
        { label: "Up to 2", value: "2" },
        { label: "Up to 3", value: "3" },
      ],
    },
    { key: "showFocus", label: "Show focus", type: "toggle" },
    { key: "showProgress", label: "Show progress", type: "toggle" },
    { key: "showMilestone", label: "Show next milestone", type: "toggle" },
    { key: "showNeeds", label: "Show what you need", type: "toggle" },
    { key: "showCollaborators", label: "Show collaborators", type: "toggle" },
    { key: "showUpdated", label: "Show last updated", type: "toggle" },
  ],
  component: ProfileCurrentlyBuildingBlock,
});
export { ProfileCurrentlyBuildingBlock };
