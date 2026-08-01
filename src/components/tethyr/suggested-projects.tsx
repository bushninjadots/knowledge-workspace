// Project recommendations — matches projects to the user's learn skills,
// looking_for flags, and project activity.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Folder, Users, MessageSquare, Sparkles } from "lucide-react";
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

const STAGE_COLORS: Record<string, string> = {
  planning: "border-muted-foreground/30 bg-muted-foreground/5 text-muted-foreground",
  building: "border-primary/30 bg-primary/10 text-primary",
  testing: "border-brand-purple/30 bg-brand-purple/10 text-brand-purple",
  launch: "border-brand-green/30 bg-brand-green/10 text-brand-green",
  growing: "border-brand-green/30 bg-brand-green/10 text-brand-green",
};

export function SuggestedProjects({ limit = 4 }: { limit?: number }) {
  const { data: me } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["suggested-projects", me?.userId ?? "anon"],
    queryFn: async (): Promise<ProjectCandidate[]> => {
      if (!me) return [];

      const targetLearnIds = new Set(me.learnIds);
      const targetTeachIds = new Set(me.teachIds);

      // Cast to any because stage/vision/gallery/resources aren't in generated types yet
      const { data: projects } = await (supabase as any)
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
          (projects as any[]).map((p: any) => p.id),
        );

      const skillMap = new Map<string, string[]>();
      for (const row of (projectSkills ?? []) as { project_id: string; skill_id: string }[]) {
        const list = skillMap.get(row.project_id) ?? [];
        list.push(row.skill_id);
        skillMap.set(row.project_id, list);
      }

      // Score each project
      const scored = (projects as any[])
        .map((p: any) => {
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
        .filter((p: any) => p.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, limit);

      return scored;
    },
    staleTime: 60_000,
    enabled: !!me,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card-border h-28 animate-pulse rounded-2xl border bg-surface" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Folder className="h-5 w-5" />}
        title="No project matches yet"
        description="Add learning goals to your profile to see projects you'd be great for."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((p) => (
        <Link
          key={p.id}
          to="/projects/$id"
          params={{ id: p.id }}
          className="card-border rounded-2xl border bg-surface p-4 transition hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.title}</p>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              )}
            </div>
            {p.stage && (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[p.stage] ?? STAGE_COLORS.building}`}
              >
                {STAGE_LABELS[p.stage] ?? p.stage}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {p.looking_for_collaborators && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[10px] text-brand-green">
                <Users className="h-2.5 w-2.5" />
                Seeking collaborators
              </span>
            )}
            {p.looking_for_feedback && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-purple/30 bg-brand-purple/5 px-2 py-0.5 text-[10px] text-brand-purple">
                <MessageSquare className="h-2.5 w-2.5" />
                Wants feedback
              </span>
            )}
          </div>

          {p.reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {p.reasons.map((r: string) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-green/20 bg-brand-green/5 px-2 py-0.5 text-[10px] text-brand-green"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {r}
                </span>
              ))}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}
