import { Award, GraduationCap, Hammer, Users, Sparkles, BookOpen } from "lucide-react";
import { BADGE_STYLES, type ReputationBadge } from "@/lib/community-data";

const BADGE_ICON: Record<ReputationBadge, typeof Award> = {
  "Helpful Mentor": Sparkles,
  "Verified Sharer": GraduationCap,
  "Project Builder": Hammer,
  "Community Contributor": Users,
  Expert: Award,
  Learner: BookOpen,
};

export function ReputationBadgePill({ badge }: { badge: ReputationBadge }) {
  const Icon = BADGE_ICON[badge];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${BADGE_STYLES[badge]}`}
    >
      <Icon className="h-3 w-3" />
      {badge}
    </span>
  );
}

export function SkillBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
      {label}
    </span>
  );
}
