import { GraduationCap, BookOpen, Rocket, Star } from "lucide-react";
import { VerificationBadge, ProjectsCard } from "@/components/tethyr/profile-sections";
import { ReputationCard } from "@/components/tethyr/reputation-display";
import { AchievementGrid } from "@/components/tethyr/achievements";
import { ActivityTimeline } from "@/components/tethyr/activity-timeline";
import type { Profile, TeachSkillMeta } from "@/hooks/use-current-user";
import type { ProjectRow, ActivityRow } from "@/components/tethyr/profile-sections";
import type { Skill } from "./profile-layout";

export function ProfileOverviewTab({
  profile,
  userId,
  teachIds,
  teachMeta,
  learnIds,
  projects,
  coverUrls,
  projectSkillIds,
  activity,
  skills,
  onChange,
}: {
  profile: Profile | null;
  userId: string;
  teachIds: string[];
  teachMeta: Record<string, TeachSkillMeta>;
  learnIds: string[];
  projects: ProjectRow[];
  coverUrls: Record<string, string>;
  projectSkillIds: Record<string, string[]>;
  activity: ActivityRow[];
  skills: Skill[];
  onChange: () => void;
  isOwnProfile: boolean;
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
      {/* REPUTATION */}
      {profile?.reputation_score != null && profile.reputation_score > 0 && (
        <ReputationCard profileId={userId} score={profile.reputation_score} />
      )}

      {/* SKILLS SUMMARY */}
      {(teachSkills.length > 0 || learnSkills.length > 0) && (
        <div className="rounded-2xl border card-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold">Skills</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {teachSkills.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Teaching
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {teachSkills.slice(0, 6).map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary"
                    >
                      {s.name}
                      {s.meta && <VerificationBadge level={s.meta.verification_level} />}
                    </span>
                  ))}
                  {teachSkills.length > 6 && (
                    <span className="text-xs text-muted-foreground">
                      +{teachSkills.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {learnSkills.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" />
                  Learning
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {learnSkills.slice(0, 6).map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-purple)]/30 bg-[var(--brand-purple)]/10 px-2.5 py-1 text-xs text-[var(--brand-purple)]"
                    >
                      {s.name}
                    </span>
                  ))}
                  {learnSkills.length > 6 && (
                    <span className="text-xs text-muted-foreground">
                      +{learnSkills.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROJECTS PREVIEW */}
      {projects.length > 0 && (
        <div className="rounded-2xl border card-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Projects</h3>
          </div>
          <ProjectsCard
            projects={projects.slice(0, 3)}
            coverUrls={coverUrls}
            userId={userId}
            allSkills={skills}
            projectSkillIds={projectSkillIds}
            onChange={onChange}
          />
        </div>
      )}

      {/* VERIFICATION BADGES */}
      <div className="rounded-2xl border card-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Achievements</h3>
        </div>
        <AchievementGrid profileId={userId} />
      </div>

      {/* ACTIVITY PREVIEW */}
      {activity.length > 0 && (
        <div className="rounded-2xl border card-border bg-surface p-5">
          <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
          <ActivityTimeline profileId={userId} events={activity.slice(0, 5)} />
        </div>
      )}
    </div>
  );
}
