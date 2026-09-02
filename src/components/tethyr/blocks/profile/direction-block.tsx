import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Compass, Hammer, Users, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { BlockEmptyState } from "@/components/tethyr/blocks/block-empty-state";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

const AVAIL_LABEL: Record<string, string> = {
  available: "Open to collaboration",
  busy: "Focused on current work",
  away: "Taking a step back",
};

type DirData = {
  availability: string | null;
  learning_goals: string | null;
  active_project: { id: string; title: string } | null;
};

function ProfileDirectionBlock({ config, context }: BlockProps) {
  const { blockId, isEditing, onBlockEmptyChange } = context;
  const profileId = context.ownerType === "profile" ? context.ownerId : null;
  const { data, isLoading } = useQuery({
    queryKey: ["profile-direction-block", profileId],
    queryFn: async (): Promise<DirData | null> => {
      if (!profileId) return null;
      const { data: d } = await supabase
        .from("profiles")
        .select("availability, learning_goals")
        .eq("id", profileId)
        .maybeSingle();
      if (!d) return null;
      let activeProject: DirData["active_project"] = null;
      try {
        const { data: contrib } = await supabase
          .from("project_contributors")
          .select("project_id, role, projects!inner(id, title, status)")
          .eq("profile_id", profileId)
          .eq("role", "creator")
          .limit(1);
        if (contrib?.length) {
          const p = (
            contrib[0] as unknown as {
              projects: { id: string; title: string; status: string } | null;
            }
          ).projects;
          if (p && (p.status === "active" || p.status === "planning"))
            activeProject = { id: p.id, title: p.title };
        }
      } catch {
        // Non-critical — direction falls back to availability + goals only.
      }
      return {
        availability: d.availability ?? null,
        learning_goals: d.learning_goals ?? null,
        active_project: activeProject,
      };
    },
    enabled: !!profileId,
  });
  const hasContent =
    !!data &&
    ((config.showProject !== false && !!data.active_project) ||
      (config.showAvailability !== false && !!data.availability) ||
      (config.showGoals !== false && !!data.learning_goals));
  useEffect(() => {
    if (isLoading || isEditing || !blockId) return;
    onBlockEmptyChange?.(blockId, !hasContent);
  }, [blockId, hasContent, isEditing, isLoading, onBlockEmptyChange]);

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (!data || !hasContent) {
    if (context.isEditing)
      return (
        <BlockEmptyState
          label="Direction"
          detail="Tell people what you're looking for and how they can help."
        />
      );
    return null;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {data.active_project && config.showProject !== false && (
        <Link
          to="/projects/$id"
          params={{ id: data.active_project.id }}
          className="rounded-lg border border-border bg-surface p-3 hover:bg-surface-elevated transition-colors group"
        >
          <Hammer className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Building now
          </p>
          <p className="mt-1 text-sm font-medium group-hover:text-primary transition-colors flex items-center gap-1">
            {data.active_project.title}
            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
          </p>
        </Link>
      )}
      {data.availability && config.showAvailability !== false && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <Users className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Open to
          </p>
          <p className="mt-1 text-sm font-medium">
            {AVAIL_LABEL[data.availability] ?? data.availability}
          </p>
        </div>
      )}
      {data.learning_goals && config.showGoals !== false && (
        <div className="rounded-lg border border-border bg-surface p-3">
          <Compass className="h-4 w-4 text-muted-foreground mb-1" />
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Growing toward
          </p>
          <p className="mt-1 text-sm leading-relaxed">{data.learning_goals}</p>
        </div>
      )}
    </div>
  );
}
registerBlock({
  type: "profile-direction",
  category: "people",
  label: "Direction",
  description: "Availability, learning goals, and active project.",
  icon: "Compass",
  defaults: { showProject: true, showAvailability: true, showGoals: true },
  fields: [
    { key: "showProject", label: "Show active project", type: "toggle" },
    { key: "showAvailability", label: "Show availability", type: "toggle" },
    { key: "showGoals", label: "Show learning goals", type: "toggle" },
  ],
  component: ProfileDirectionBlock,
});
export { ProfileDirectionBlock };
