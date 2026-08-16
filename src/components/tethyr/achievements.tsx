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
      className={`flex shrink-0 items-center justify-center rounded-full ${def.color} ${
        size === "sm" ? "h-5 w-5" : "h-10 w-10"
      }`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-5 w-5"} />
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
      const { data, error } = await supabase
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
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-surface/60" />
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
    <div className="flex flex-wrap gap-2">
      {sorted.map((def) => {
        const isEarned = earnedSet.has(def.type);
        return (
          <span
            key={def.type}
            title={`${def.label}: ${def.description}${isEarned ? "(Earned)" : ""}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              isEarned
                ? "border-border/60 bg-surface text-foreground"
                : "border-border/30 bg-surface/40 text-muted-foreground"
            }`}
          >
            <AchievementIcon def={def} size="sm" />
            {def.label}
          </span>
        );
      })}
    </div>
  );
}
