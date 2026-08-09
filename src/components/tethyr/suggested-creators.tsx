// Skill-matched suggested creators — matches complementary teach/learn skills,
// availability overlap, and language compatibility.
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { computeMatchScore, type SkillMeta, type AvailabilityStatus } from "@/lib/skill-match";
import { AvailabilityBadge } from "./availability-badge";
import { EmptyState } from "./empty-state";

type CandidateSkills = {
  profile_id: string;
  skill_id: string;
  name: string;
  category: string;
  experience_level: string;
  verification_level: string;
};

export const SuggestedCreators = memo(function SuggestedCreators({
  limit = 6,
}: {
  limit?: number;
}) {
  const { data: me } = useCurrentUser();

  const { data, isLoading } = useQuery({
    queryKey: ["suggested-creators-v2", me?.userId ?? "anon"],
    queryFn: async () => {
      if (!me) return [];

      const targetLearnIds = new Set(me.learnIds);
      const targetTeachIds = new Set(me.teachIds);
      const targetAvail = me.profile?.availability as AvailabilityStatus;
      const targetLangs = me.profile?.languages ?? [];

      // Fetch candidate profiles (exclude self, must have a name)
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select(
          "id, handle, display_name, creator_title, category, avatar_url, availability, languages",
        )
        .not("display_name", "is", null)
        .neq("id", me.userId)
        .limit(200);

      if (!profiles || profiles.length === 0) return [];

      const candidateIds = (profiles as any[]).map((p: any) => p.id);

      // Fetch teach + learn skills for all candidates in parallel
      const [teachRes, learnRes] = await Promise.all([
        supabase
          .from("profile_skills_teach")
          .select(
            "profile_id, skill_id, experience_level, verification_level, skills(name, category)",
          )
          .in("profile_id", candidateIds),
        supabase
          .from("profile_skills_learn")
          .select("profile_id, skill_id, skills(name, category)")
          .in("profile_id", candidateIds),
      ]);

      // Group skills by profile
      const teachMap = new Map<string, CandidateSkills[]>();
      for (const row of teachRes.data ?? []) {
        const skills = row.skills as { name: string; category: string } | null;
        if (!skills) continue;
        const entry: CandidateSkills = {
          profile_id: row.profile_id,
          skill_id: row.skill_id,
          name: skills.name,
          category: skills.category,
          experience_level: row.experience_level,
          verification_level: row.verification_level,
        };
        const list = teachMap.get(row.profile_id) ?? [];
        list.push(entry);
        teachMap.set(row.profile_id, list);
      }

      const learnMap = new Map<string, SkillMeta[]>();
      for (const row of learnRes.data ?? []) {
        const skills = row.skills as { name: string; category: string } | null;
        if (!skills) continue;
        const entry: SkillMeta = {
          skill_id: row.skill_id,
          name: skills.name,
          category: skills.category,
        };
        const list = learnMap.get(row.profile_id) ?? [];
        list.push(entry);
        learnMap.set(row.profile_id, list);
      }

      // Score each candidate
      const scored = (profiles as any[])
        .map((p: any) => {
          const teach = teachMap.get(p.id) ?? [];
          const learn = learnMap.get(p.id) ?? [];
          const { score, reasons } = computeMatchScore({
            candidateTeach: teach,
            candidateLearn: learn,
            candidateAvail: p.availability as AvailabilityStatus,
            candidateLangs: (p.languages as string[]) ?? [],
            targetLearnIds,
            targetTeachIds,
            targetAvail,
            targetLangs,
          });

          return {
            ...p,
            teachSkills: teach,
            learnSkills: learn,
            matchScore: score,
            matchReasons: reasons,
          };
        })
        .filter((c) => c.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);

      return scored;
    },
    staleTime: 60_000,
    enabled: !!me,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-border h-24 animate-pulse rounded-xl border bg-surface" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No matches yet"
        description="Add skills you share or want to learn to unlock better matches."
        actionLabel="Open your studio"
        actionHref="/profile"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((c) => {
        const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
        return (
          <Link
            key={c.id}
            to="/u/$handle"
            params={{ handle: c.handle ?? "" }}
            className="card-border rounded-xl border bg-surface p-4 transition hover:border-[var(--user-accent-border,var(--border-strong))] hover:bg-[var(--user-accent-subtle,var(--surface-elevated))]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-background">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={c.display_name || c.handle || "Untitled member"}>
                  {c.display_name || c.handle || "Untitled member"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.creator_title || c.category || "Member"}
                </p>
              </div>
            </div>

            <AvailabilityBadge status={c.availability} size="xs" />

            {c.matchReasons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.matchReasons.slice(0, 2).map((reason: string) => (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/5 px-2 py-0.5 text-[11px] text-brand-green"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
});
