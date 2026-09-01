// ── Profile Skills Block ──────────────────────────────────────────────────────
// Shows the profile's teach/learn skills with experience and verification badges.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { registerBlock } from "@/lib/block-registry";
import type { BlockProps } from "@/lib/page-blocks";

type SkillRow = {
  skill_id: string;
  verification_level: string;
  experience_level: string;
  skills: { id: string; slug: string; name: string; category: string } | null;
};

const EXP_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};
const VERIF_LABEL: Record<string, string> = {
  self_declared: "Self-declared",
  proof_certified: "Certified",
  community_recognized: "Recognized",
};

function ProfileSkillsBlock({ context, config }: BlockProps) {
  const profileId = context.ownerType === "profile" ? context.ownerId : null;

  const { data, isLoading } = useQuery({
    queryKey: ["profile-skills-block", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const [teachRes, learnRes] = await Promise.all([
        supabase
          .from("profile_skills_teach")
          .select(
            "skill_id, verification_level, experience_level, skills(id, slug, name, category)",
          )
          .eq("profile_id", profileId),
        supabase
          .from("profile_skills_learn")
          .select("skill_id, skills(id, slug, name, category)")
          .eq("profile_id", profileId),
      ]);
      return {
        teach: (teachRes.data ?? []) as unknown as SkillRow[],
        learn: (learnRes.data ?? []) as unknown as SkillRow[],
      };
    },
    enabled: !!profileId,
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (!data) return null;

  const { teach, learn } = data;
  if (teach.length === 0 && learn.length === 0) {
    if (context.isEditing) {
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground">
          Skills block — skills will appear here when added to your profile.
        </div>
      );
    }
    return null;
  }

  const showCategories = config.showCategories !== false;

  return (
    <div className="space-y-4">
      {/* Skills I share */}
      {teach.length > 0 && (
        <div>
          {showCategories && (
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Skills I share
            </h4>
          )}
          <div className="flex flex-wrap gap-1.5">
            {teach.map((row) => {
              const skill = row.skills;
              if (!skill) return null;
              return (
                <span
                  key={row.skill_id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-teaching-subtle px-2.5 py-1 text-xs font-medium text-teaching"
                  title={`${EXP_LABEL[row.experience_level] ?? row.experience_level} · ${VERIF_LABEL[row.verification_level] ?? row.verification_level}`}
                >
                  {skill.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Skills I'm growing */}
      {learn.length > 0 && (
        <div>
          {showCategories && (
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Skills I'm growing
            </h4>
          )}
          <div className="flex flex-wrap gap-1.5">
            {learn.map((row) => {
              const skill = row.skills;
              if (!skill) return null;
              return (
                <span
                  key={row.skill_id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-learning-subtle px-2.5 py-1 text-xs font-medium text-learning"
                >
                  {skill.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

registerBlock({
  type: "profile-skills",
  category: "people",
  label: "Skills",
  description: "Skills the person shares and skills they're growing.",
  icon: "GraduationCap",
  defaults: { showCategories: true, showEndorsements: true },
  fields: [
    { key: "showCategories", label: "Show category headers", type: "toggle" },
    { key: "showEndorsements", label: "Show endorsement counts", type: "toggle" },
  ],
  component: ProfileSkillsBlock,
});

export { ProfileSkillsBlock };
