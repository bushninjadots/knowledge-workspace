// Project recommendations — matches projects to the user's learn skills,
// looking_for flags, and project activity.
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Folder, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { scoreProjectMatch } from "@/lib/skill-match";
import { EmptyState } from "./empty-state";

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

      const targetLearnIds = new Set(me.learnIds);
      const targetTeachIds = new Set(me.teachIds);

      const { data: projects } = await supabase
        .from("projects")
        .select(
          "id, title, description, stage, looking_for_collaborators, looking_for_feedback, profile_id",
        )
        .neq("profile_id", me.userId)
        .in("stage", ["planning", "building", "testing", "launch", "growing"])
        .order("updated_at", { ascending: false })
        .limit(100);

      if (!projects || projects.length === 0) return [];

      // Fetch skills for all candidate projects
      const { data: projectSkills } = await supabase
        .from("project_skills")
        .select("project_id, skill_id")
        .in(
          "project_id",
          projects.map((p) => p.id),
        );

      const skillMap = new Map<string, string[]>();
      for (const row of (projectSkills ?? []) as { project_id: string; skill_id: string }[]) {
        const list = skillMap.get(row.project_id) ?? [];
        list.push(row.skill_id);
        skillMap.set(row.project_id, list);
      }

      // Score each project
      const scored = projects
        .map((p) => {
          const projectSkillIds = skillMap.get(p.id) ?? [];
          const { score, reasons } = scoreProjectMatch({
            projectSkillIds,
            userLearnIds: targetLearnIds,
            userTeachIds: targetTeachIds,
            lookingForCollaborators: p.looking_for_collaborators,
            lookingForFeedback: p.looking_for_feedback,
          });
          return { ...p, skill_ids: projectSkillIds, score, reasons };
        })
        .filter((p) => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored;
    },
    staleTime: 60_000,
    enabled: !!me,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
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
