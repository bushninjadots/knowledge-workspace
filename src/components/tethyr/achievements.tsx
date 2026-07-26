// Achievements — auto-awarded badges displayed on profiles.
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Rocket,
  Flag,
  ThumbsUp,
  Star,
  Shield,
  GraduationCap,
  Users,
  BookOpen,
  Hammer,
  MessageCircle,
  Clock,
  Heart,
  Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, type AchievementType, type AchievementDef } from "@/lib/reputation";
import { EmptyState } from "./empty-state";

const ICONS: Record<string, typeof Award> = {
  Rocket,
  Flag,
  ThumbsUp,
  Star,
  Shield,
  GraduationCap,
  Users,
  BookOpen,
  Hammer,
  MessageCircle,
  Clock,
  Heart,
  Compass,
  Award,
};

function AchievementIcon({ def, size = "md" }: { def: AchievementDef; size?: "sm" | "md" }) {
  const Icon = ICONS[def.icon] ?? Award;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-surface-elevated ${def.color} ${
        size === "sm" ? "h-8 w-8" : "h-10 w-10"
      }`}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
    </span>
  );
}

export function AchievementBadge({ type }: { type: AchievementType }) {
  const def = ACHIEVEMENTS.find((a) => a.type === type);
  if (!def) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-2 py-1 text-[11px] font-medium text-foreground">
      <AchievementIcon def={def} />
      {def.label}
    </span>
  );
}

export function AchievementGrid({ profileId }: { profileId: string }) {
  const {
    data: earned,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["achievements", profileId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_achievements")
        .select("achievement, awarded_at")
        .eq("profile_id", profileId)
        .order("awarded_at", { ascending: false });
      if (error) return [] as { achievement: AchievementType; awarded_at: string }[];
      return (data ?? []) as { achievement: AchievementType; awarded_at: string }[];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface/60" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title="No achievements yet"
        description="Earn badges by contributing, collaborating, and sharing on Tethyr."
      />
    );
  }

  const earnedSet = new Set((earned ?? []).map((e) => e.achievement));
  const earnedMap = new Map((earned ?? []).map((e) => [e.achievement, e.awarded_at]));

  // Show earned first, then locked
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const aEarned = earnedSet.has(a.type) ? 0 : 1;
    const bEarned = earnedSet.has(b.type) ? 0 : 1;
    return aEarned - bEarned;
  });

  if (earnedSet.size === 0) {
    return (
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title="No achievements yet"
        description="Earn badges by contributing, collaborating, and sharing on Tethyr."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sorted.map((def) => {
        const isEarned = earnedSet.has(def.type);
        const awardedAt = earnedMap.get(def.type);
        return (
          <div
            key={def.type}
            className={`flex items-start gap-2.5 rounded-2xl border p-2.5 transition ${
              isEarned ? "border-border/60 bg-surface" : "border-border/30 bg-surface/40 opacity-50"
            }`}
          >
            <AchievementIcon def={def} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{def.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{def.description}</p>
              {isEarned && awardedAt && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Earned {new Date(awardedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
