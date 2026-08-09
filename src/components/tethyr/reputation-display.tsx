// Reputation display — shows score, tier, and category breakdown on profile cards.
import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTier,
  getTierProgress,
  computeCategoryBreakdown,
  type ReputationCategory,
} from "@/lib/reputation";

export function ReputationScore({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const tier = getTier(score);
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`font-display font-semibold ${sizeClasses[size]} ${tier.color}`}>
        {score}
      </span>
      {size !== "sm" && (
        <span className="text-xs uppercase tracking-wider text-muted-foreground">rep</span>
      )}
    </div>
  );
}

export function ReputationTierBadge({ score }: { score: number }) {
  const { current, next, progress } = getTierProgress(score);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-3">
      <div className="relative h-12 w-12 shrink-0">
        <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="var(--surface-elevated)"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="var(--user-accent, var(--trust))"
            strokeWidth="4"
            fill="none"
            strokeDasharray={2 * Math.PI * 20}
            strokeDashoffset={2 * Math.PI * 20 * (1 - progress / 100)}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Trophy className={`h-4 w-4 ${current.color}`} />
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${current.color}`}>{current.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {next
            ? `${progress}% to ${next.name} · ${score}/${next.minScore} REP`
            : "Max tier reached"}
        </p>
      </div>
    </div>
  );
}

export function ReputationBreakdown({ profileId }: { profileId: string }) {
  const { data } = useQuery({
    queryKey: ["reputation-breakdown", profileId],
    queryFn: async (): Promise<ReputationCategory[]> => {
      const { data, error } = await (supabase as any)
        .from("contribution_log")
        .select("category, points")
        .eq("profile_id", profileId);
      if (error) return [];
      return computeCategoryBreakdown(data ?? []);
    },
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  const maxPoints = Math.max(...data.map((c) => c.points));

  return (
    <div className="space-y-2">
      {data.map((cat) => (
        <div key={cat.name} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-muted-foreground">{cat.label}</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(cat.points / maxPoints) * 100}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-medium tabular-nums text-muted-foreground">
            {cat.points}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReputationCard({ profileId, score }: { profileId: string; score: number }) {
  return (
    <div className="rounded-xl bg-surface-elevated/30 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-elevated">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Reputation</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Earned through contributions across Tethyr.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <ReputationScore score={score} size="lg" />
        <ReputationTierBadge score={score} />
      </div>

      <div className="mt-5">
        <ReputationBreakdown profileId={profileId} />
      </div>
    </div>
  );
}
