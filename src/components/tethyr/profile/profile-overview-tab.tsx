import { useState } from "react";
import { GraduationCap, BookOpen, Star, Users, Plus } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { VerificationBadge } from "@/components/tethyr/profile-sections";
import { ReputationCard } from "@/components/tethyr/reputation-display";
import { ProfileCredits } from "@/components/tethyr/profile/profile-credits";
import { useCreateTeam, useMyTeams } from "@/hooks/use-teams";
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
  activity,
  skills,
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
      {/* CREDITED ON */}
      <ProfileCredits profileId={userId} />

      {/* TEAMS I BUILD WITH */}
      <TeamsIBuildWith />

      {/* REPUTATION */}
      {profile?.reputation_score != null && profile.reputation_score > 0 && (
        <ReputationCard profileId={userId} score={profile.reputation_score} />
      )}

      {/* SKILLS SUMMARY */}
      {(teachSkills.length > 0 || learnSkills.length > 0) && (
        <div className="rounded-xl bg-surface-elevated/30 p-5">
          <h3 className="mb-4 text-sm font-semibold">Skills</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {teachSkills.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Skills I share
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
                  Skills I’m growing
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

      {/* ACHIEVEMENTS */}
      <div className="rounded-xl bg-surface-elevated/30 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Achievements</h3>
        </div>
        <AchievementGrid profileId={userId} />
      </div>

      {/* ACTIVITY PREVIEW */}
      {activity.length > 0 && (
        <div className="rounded-xl bg-surface-elevated/30 p-5">
          <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
          <ActivityTimeline profileId={userId} events={activity.slice(0, 5)} />
        </div>
      )}
    </div>
  );
}

function TeamsIBuildWith() {
  const { data: teams = [], isLoading } = useMyTeams();
  const createTeam = useCreateTeam();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  if (isLoading) return null;

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const team = await createTeam.mutateAsync({ name: name.trim() });
      setShowCreate(false);
      setName("");
      navigate({ to: "/teams/$slug", params: { slug: team.slug } });
    } catch {
      // Error surfaced by the mutation toast.
    }
  }

  return (
    <div className="rounded-xl bg-surface-elevated/30 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Teams I build with</h3>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Form a crew
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crew name"
            className="w-full max-w-xs rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
          >
            Create
          </button>
          <button
            onClick={() => setShowCreate(false)}
            className="rounded-md px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {teams.length === 0 && !showCreate ? (
        <p className="text-sm text-muted-foreground">
          No crews yet — form one to start building with a team.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {teams.map((t) => (
            <li key={t.id} className="flex items-baseline gap-x-2 text-sm">
              <Link
                to="/teams/$slug"
                params={{ slug: t.slug }}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {t.name}
              </Link>
              <span className="text-xs capitalize text-muted-foreground/70">{t.role}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
