import { GraduationCap, BookOpen, ArrowRightLeft } from "lucide-react";
import { VerificationBadge, ExperienceBadge } from "@/components/tethyr/profile-sections";
import type { Profile, TeachSkillMeta } from "@/hooks/use-current-user";
import type { Skill } from "./profile-layout";

export function ProfileSkillsTab({
  teachIds,
  teachMeta,
  learnIds,
  skills,
  isOwnProfile,
}: {
  profile: Profile | null;
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  skills: Skill[];
  isOwnProfile: boolean;
  userId: string;
}) {
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const teachSkills = teachIds
    .map((id) => {
      const s = skillById.get(id);
      if (!s) return null;
      return { ...s, meta: teachMeta[id] };
    })
    .filter(Boolean) as (Skill & { meta?: TeachSkillMeta })[];
  const learnSkills = learnIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];

  return (
    <div className="space-y-6">
      {/* SKILL MATCH (shown on public profiles) */}
      {!isOwnProfile && teachSkills.length > 0 && learnSkills.length > 0 && (
        <SkillMatchCard teachSkills={teachSkills} learnSkills={learnSkills} />
      )}

      {/* TEACH SKILLS */}
      <div className="rounded-xl bg-surface-elevated/30 p-4">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Skills I share</h3>
          <span className="ml-auto text-xs text-muted-foreground">{teachSkills.length} skills</span>
        </div>
        {teachSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          <div className="space-y-3">
            {teachSkills.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground">{s.category}</span>
                  </div>
                  {s.meta && (
                    <div className="mt-1 flex items-center gap-2">
                      <VerificationBadge
                        level={s.meta.verification_level}
                        proofUrl={s.meta.proof_url}
                      />
                      <ExperienceBadge level={s.meta.experience_level} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LEARN SKILLS */}
      <div className="rounded-xl bg-surface-elevated/30 p-4">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Skills I’m growing</h3>
          <span className="ml-auto text-xs text-muted-foreground">{learnSkills.length} skills</span>
        </div>
        {learnSkills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {learnSkills.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-purple)]/30 bg-[var(--brand-purple)]/10 px-3 py-1.5 text-xs text-[var(--brand-purple)]"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillMatchCard({
  teachSkills,
  learnSkills,
}: {
  teachSkills: (Skill & { meta?: TeachSkillMeta })[];
  learnSkills: Skill[];
}) {
  const teachNames = new Set(teachSkills.map((s) => s.name.toLowerCase()));
  const learnNames = new Set(learnSkills.map((s) => s.name.toLowerCase()));
  const canTeach = learnSkills.filter((s) => teachNames.has(s.name.toLowerCase()));
  const canLearn = teachSkills.filter((s) => learnNames.has(s.name.toLowerCase()));
  const matchPercent =
    teachSkills.length + learnSkills.length > 0
      ? Math.round(
          ((canTeach.length + canLearn.length) / (teachSkills.length + learnSkills.length)) * 100,
        )
      : 0;

  if (canTeach.length === 0 && canLearn.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">Skill Match</h3>
        <span className="ml-auto rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
          {matchPercent}% compatible
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {canTeach.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">You can teach them</p>
            <div className="flex flex-wrap gap-1.5">
              {canTeach.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {canLearn.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">They can teach you</p>
            <div className="flex flex-wrap gap-1.5">
              {canLearn.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-[var(--brand-purple)]/10 px-2.5 py-1 text-xs text-[var(--brand-purple)]"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
