// Achievements — auto-awarded badges displayed on profiles.
import { Award } from "lucide-react";
import { ACHIEVEMENT_ICONS } from "./icons/achievements";
import { ACHIEVEMENTS, type AchievementType, type AchievementDef } from "@/lib/reputation";

function AchievementIcon({ def, size = "md" }: { def: AchievementDef; size?: "sm" | "md" }) {
  const Icon = ACHIEVEMENT_ICONS[def.type];
  const iconClass = size === "sm" ? "h-3 w-3" : "h-5 w-5";
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-foreground ${def.color} ${
        size === "sm" ? "h-5 w-5" : "h-10 w-10"
      }`}
    >
      {Icon ? <Icon className={iconClass} /> : <Award className={iconClass} />}
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
