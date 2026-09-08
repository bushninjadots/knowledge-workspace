// Skill-matched suggested creators — matches complementary teach/learn skills,
// availability overlap, and language compatibility.
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ConnectButton } from "./connect-button";
import { EmptyState } from "./empty-state";
import { ProfileLink } from "./profile-link";
import { supabase } from "@/integrations/supabase/client";

type CandidateSkills = {
  skill_id: string;
  name: string;
  category: string;
  experience_level?: string;
  verification_level?: string;
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

      const { data, error } = await supabase.rpc("match_creators", {
        p_user_id: me.userId,
        p_limit: 100,
      });
      if (error) throw error;

      return (data ?? [])
        .map((candidate) => ({
          ...candidate,
          teachSkills: (candidate.teach_skills ?? []) as CandidateSkills[],
          learnSkills: (candidate.learn_skills ?? []) as CandidateSkills[],
          matchScore: Number(candidate.match_score),
          matchReasons: candidate.match_reasons ?? [],
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
          <div key={i} className="h-14 animate-gentle-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No matches yet"
        description="Add skills you share or want to grow to unlock better matches."
        actionLabel="Open your studio"
        actionHref="/profile"
      />
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {data.map((c) => {
        const initial = (c.display_name ?? c.handle ?? "?").charAt(0).toUpperCase();
        const name = c.display_name || c.handle || "Untitled member";
        const context = [
          ...c.teachSkills.slice(0, 2).map((s) => s.name),
          ...(c.availability === "available" || c.availability === "looking_for_team"
            ? ["Available"]
            : []),
        ].join(" · ");
        return (
          <div key={c.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
            <ProfileLink
              handle={c.handle}
              className="flex min-w-0 flex-1 items-center gap-3"
              title={name}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-background">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.creator_title || c.category || "Member"}
                </p>
              </div>
            </ProfileLink>
            {context && (
              <p className="hidden max-w-[16rem] shrink-0 truncate text-[11px] text-muted-foreground md:block">
                {context}
              </p>
            )}
            <ConnectButton targetId={c.id} targetName={name} />
          </div>
        );
      })}
    </div>
  );
});
