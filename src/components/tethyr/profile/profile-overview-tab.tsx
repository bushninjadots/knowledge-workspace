import { useState } from "react";
import { Star, Users, Plus } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ReputationCard } from "@/components/tethyr/reputation-display";
import { ProfileCredits } from "@/components/tethyr/profile/profile-credits";
import { useCreateTeam, useMyTeams } from "@/hooks/use-teams";
import { AchievementGrid } from "@/components/tethyr/achievements";
import type { Profile } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";

export function ProfileOverviewTab({
  profile,
  userId,
  isOwnProfile,
}: {
  profile: Profile | null;
  userId: string;
  isOwnProfile: boolean;
}) {
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

      {/* ACHIEVEMENTS */}
      <div className="rounded-xl bg-surface-elevated/30 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Achievements</h3>
        </div>
        <AchievementGrid
          profileId={userId}
          isOwnProfile={isOwnProfile}
          favoriteAchievement={profile?.favorite_achievement}
        />
      </div>
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
        <h3 className="text-sm font-semibold">Crews I build with</h3>
        {!showCreate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="ml-auto rounded-full"
          >
            <Plus className="h-3 w-3" />
            Form a crew
          </Button>
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
          <Button type="button" size="sm" onClick={handleCreate} busy={createTeam.isPending} disabled={!name.trim()}>
            Create crew
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
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
