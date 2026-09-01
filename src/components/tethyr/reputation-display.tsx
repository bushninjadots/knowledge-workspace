// Reputation display — shows score, tier, and category breakdown on profile cards.
import { Trophy } from "lucide-react";
import { getTier, getTierProgress } from "@/lib/reputation";

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
