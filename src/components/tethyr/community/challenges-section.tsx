import { memo, useState } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/tethyr/empty-state";
import { ChallengeCard } from "@/components/tethyr/community/challenge-card";
import { CreateChallengeDialog } from "@/components/tethyr/community/create-challenge-dialog";
import { useChallenges } from "@/hooks/use-challenges";

/**
 * Self-contained challenges view: fetches its own data and owns its own dialog
 * state, so it only mounts when the Challenges nav destination is active.
 */
export const ChallengesSection = memo(function ChallengesSection() {
  const { data: challenges = [], isLoading } = useChallenges("active");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-title text-lg font-semibold tracking-tight">Challenges</h2>
        <CreateChallengeDialog open={open} onOpenChange={setOpen} />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-5">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-border/50 bg-card/60 h-40 p-6"
            />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No active challenges yet"
          description="Kick one off — a challenge gives people a shared goal to learn and build together."
          actionLabel="Create a challenge"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
});
