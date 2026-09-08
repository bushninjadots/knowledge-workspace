// Project recommendations — matches projects to the user's learn skills,
// looking_for flags, and project activity.
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Folder, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { EmptyState } from "./empty-state";
import { supabase } from "@/integrations/supabase/client";

type ProjectCandidate = {
  id: string;
  title: string;
  description: string | null;
  stage: string | null;
  looking_for_collaborators: boolean;
  looking_for_feedback: boolean;
  profile_id: string;
  skill_ids: string[];
  score: number;
  reasons: string[];
};

const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  building: "Building",
  testing: "Testing",
  launch: "Launching",
  growing: "Growing",
};

const STAGE_TEXT: Record<string, string> = {
  planning: "text-muted-foreground",
  building: "text-primary",
  testing: "text-brand-purple",
  launch: "text-brand-green",
  growing: "text-brand-green",
};

export const SuggestedProjects = memo(function SuggestedProjects({
  limit = 4,
}: {
  limit?: number;
}) {
  const { data: me } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["suggested-projects", me?.userId ?? "anon"],
    queryFn: async (): Promise<ProjectCandidate[]> => {
      if (!me) return [];

      const { data, error } = await supabase.rpc("match_projects", {
        p_user_id: me.userId,
        p_limit: 100,
      });
      if (error) throw error;

      return (data ?? [])
        .map((project) => ({
          ...project,
          skill_ids: project.skill_ids ?? [],
          score: Number(project.score),
          reasons: project.reasons ?? [],
        }))
        .slice(0, limit);
    },
    staleTime: 60_000,
    enabled: !!me,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-gentle-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Folder className="h-5 w-5" />}
        title="No project matches yet"
        description="Add skills to your studio to see projects where you could make an impact."
        actionLabel="Open your studio"
        actionHref="/profile"
      />
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {data.map((p) => {
        const reasons = p.reasons.slice(0, 2).join(" · ");
        return (
          <Link
            key={p.id}
            to="/projects/$id"
            params={{ id: p.id }}
            className="group block py-3 first:pt-1 last:pb-1"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium" title={p.title}>
                    {p.title}
                  </p>
                  {p.stage && (
                    <span
                      className={`shrink-0 text-[11px] font-medium ${
                        STAGE_TEXT[p.stage] ?? STAGE_TEXT.building
                      }`}
                    >
                      {STAGE_LABELS[p.stage] ?? p.stage}
                    </span>
                  )}
                </div>
                {p.description && (
                  <p
                    className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                    title={p.description}
                  >
                    {p.description}
                  </p>
                )}
                {reasons && <p className="mt-1.5 text-[11px] text-muted-foreground">{reasons}</p>}
              </div>
              <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition group-hover:text-primary sm:inline-flex">
                View project <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
});
