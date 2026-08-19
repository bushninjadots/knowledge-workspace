// Achievements — auto-awarded badges displayed on profiles.
import { useEffect } from "react";
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
  Trophy,
  Target,
  HeartHandshake,
  MessageSquare,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENTS, type AchievementType, type AchievementDef } from "@/lib/reputation";
import { useSetFavoriteAchievement } from "@/hooks/use-current-user";
import { burstConfetti } from "@/lib/confetti";
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
  Trophy,
  Target,
  HeartHandshake,
  MessageSquare,
  BadgeCheck,
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

/** Compact icon-only badge shown next to a member's name. */
export function FavoriteBadge({ type }: { type: string | null | undefined }) {
  const def = ACHIEVEMENTS.find((a) => a.type === type);
  if (!def) return null;
  return (
    <span
      role="img"
      aria-label={`Favourite badge: ${def.label}`}
      title={`Favourite badge: ${def.label}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--learning-subtle))]"
    >
      <AchievementIcon def={def} size="sm" />
    </span>
  );
}

export function AchievementGrid({
  profileId,
  isOwnProfile = false,
  favoriteAchievement,
}: {
  profileId: string;
  isOwnProfile?: boolean;
  favoriteAchievement?: string | null;
}) {
  const setFavorite = useSetFavoriteAchievement();

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

  // Celebrate newly-awarded badges with a confetti burst. Only for the signed-in
  // member viewing their own studio — never on someone else's profile.
  useEffect(() => {
    if (!isOwnProfile || !earned || earned.length === 0) return;
    const storageKey = `tethyr:seen-achievements:${profileId}`;
    let seen: Set<string>;
    try {
      const raw = localStorage.getItem(storageKey);
      seen = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      seen = new Set();
    }

    const fresh = earned.some((e) => !seen.has(e.achievement));
    if (fresh) {
      burstConfetti();
      for (const e of earned) seen.add(e.achievement);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...seen]));
      } catch {
        /* ignore quota errors */
      }
    }
  }, [isOwnProfile, earned, profileId]);

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

  function toggleFavorite(type: AchievementType) {
    const next = favoriteAchievement === type ? null : type;
    setFavorite.mutate(next, {
      onSuccess: () => toast.success(next ? "Badge pinned next to your name" : "Badge unpinned"),
      onError: (e: Error) => toast.error(friendlyError(e)),
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isOwnProfile && (
        <p className="w-full text-[11px] text-muted-foreground">
          Tap an earned badge to pin it next to your name.
        </p>
      )}
      {sorted.map((def) => {
        const isEarned = earnedSet.has(def.type);
        const isFavorite = favoriteAchievement === def.type;
        return (
          <button
            key={def.type}
            type="button"
            disabled={!isOwnProfile || !isEarned}
            onClick={() => toggleFavorite(def.type)}
            title={`${def.label}: ${def.description}${
              isEarned ? (isFavorite ? " (Pinned)" : " (Earned)") : ""
            }`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              isFavorite
                ? "border-[var(--user-accent-border,var(--border-strong))] bg-[var(--user-accent-subtle,var(--learning-subtle))] text-foreground"
                : isEarned
                  ? "border-border/60 bg-surface text-foreground"
                  : "border-border/30 bg-surface/40 text-muted-foreground"
            } ${isOwnProfile && isEarned ? "cursor-pointer hover:border-[var(--user-accent-border,var(--border-strong))]" : ""}`}
          >
            <AchievementIcon def={def} size="sm" />
            {def.label}
            {isFavorite && <Star className="h-3 w-3 fill-current" />}
          </button>
        );
      })}
    </div>
  );
}
