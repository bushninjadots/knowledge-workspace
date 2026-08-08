// Reputation engine — defines point values, achievement thresholds, and
// the achievement-checking logic that runs client-side after DB mutations.

import { supabase } from "@/integrations/supabase/client";

// ── Point values ──────────────────────────────────────────────

export const POINTS = {
  project_published: 10,
  project_joined: 5,
  milestone_completed: 5,
  project_update_posted: 3,
  endorsement_received: 2,
  community_post_created: 2,
  community_comment_created: 1,
  discussion_started: 3,
  discussion_reply: 1,
} as const;

export type ReputationAction = keyof typeof POINTS;

// ── Achievement definitions ───────────────────────────────────

export type AchievementType =
  | "first_project"
  | "first_milestone"
  | "first_endorsement"
  | "five_endorsements"
  | "ten_endorsements"
  | "community_recognized"
  | "mentor"
  | "collaborator"
  | "prolific_teacher"
  | "project_builder"
  | "community_builder"
  | "reliable_collaborator"
  | "helped_ten_people"
  | "learner_journey";

export type AchievementDef = {
  type: AchievementType;
  label: string;
  description: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    type: "first_project",
    label: "First Project",
    description: "Published your first project",
    icon: "Rocket",
    color: "text-brand-green",
  },
  {
    type: "first_milestone",
    label: "First Milestone",
    description: "Completed your first milestone",
    icon: "Flag",
    color: "text-brand-purple",
  },
  {
    type: "first_endorsement",
    label: "First Endorsement",
    description: "Received your first peer endorsement",
    icon: "ThumbsUp",
    color: "text-teaching",
  },
  {
    type: "five_endorsements",
    label: "Rising Star",
    description: "Received 5 peer endorsements",
    icon: "Star",
    color: "text-teaching",
  },
  {
    type: "ten_endorsements",
    label: "Ten Endorsements",
    description: "Received 10 peer endorsements",
    icon: "Award",
    color: "text-teaching",
  },
  {
    type: "community_recognized",
    label: "Community Recognized",
    description: "A skill was endorsed 3+ times and upgraded",
    icon: "Shield",
    color: "text-brand-green",
  },
  {
    type: "mentor",
    label: "Mentor",
    description: "Contributed to a project as a mentor",
    icon: "GraduationCap",
    color: "text-brand-purple",
  },
  {
    type: "collaborator",
    label: "Collaborator",
    description: "Joined a project as a contributor",
    icon: "Users",
    color: "text-primary",
  },
  {
    type: "prolific_teacher",
    label: "Prolific Sharer",
    description: "Sharing 5+ skills",
    icon: "BookOpen",
    color: "text-brand-green",
  },
  {
    type: "project_builder",
    label: "Project Builder",
    description: "Published 3+ projects",
    icon: "Hammer",
    color: "text-primary",
  },
  {
    type: "community_builder",
    label: "Community Builder",
    description: "Created 10+ community posts",
    icon: "MessageCircle",
    color: "text-brand-purple",
  },
  {
    type: "reliable_collaborator",
    label: "Reliable Collaborator",
    description: "Active for 30+ days",
    icon: "Clock",
    color: "text-brand-green",
  },
  {
    type: "helped_ten_people",
    label: "Helped 10 People",
    description: "Contributed to 3+ projects",
    icon: "Heart",
    color: "text-teaching",
  },
  {
    type: "learner_journey",
    label: "Growth Journey",
    description: "Growing in 5+ skills",
    icon: "Compass",
    color: "text-primary",
  },
];

export function getAchievementDef(type: AchievementType): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.type === type);
}

// ── Category breakdown ────────────────────────────────────────

export type ReputationCategory = {
  name: string;
  label: string;
  points: number;
  color: string;
};

export function computeCategoryBreakdown(
  contributions: { category: string; points: number }[],
): ReputationCategory[] {
  const map = new Map<string, number>();
  for (const c of contributions) {
    map.set(c.category, (map.get(c.category) ?? 0) + c.points);
  }

  const defs: { name: string; label: string; color: string }[] = [
    { name: "collaboration", label: "Collaboration", color: "text-primary" },
    { name: "teaching", label: "Sharing", color: "text-brand-green" },
    { name: "learning", label: "Growing", color: "text-brand-purple" },
    { name: "community", label: "Community", color: "text-teaching" },
    { name: "project_impact", label: "Project Impact", color: "text-brand-green" },
    { name: "reliability", label: "Reliability", color: "text-primary" },
  ];

  return defs
    .map((d) => ({
      ...d,
      points: map.get(d.name) ?? 0,
    }))
    .filter((c) => c.points > 0)
    .sort((a, b) => b.points - a.points);
}

// ── Achievement checking ──────────────────────────────────────

export async function checkAndAwardAchievements(): Promise<AchievementType[]> {
  const { data, error } = await supabase.rpc("award_earned_achievements");
  if (error) throw error;
  return (data ?? []) as AchievementType[];
}

// ── Reputation tier ───────────────────────────────────────────

export type ReputationTier = {
  name: string;
  minScore: number;
  color: string;
  gradient: string;
};

export const TIERS: ReputationTier[] = [
  {
    name: "Newcomer",
    minScore: 0,
    color: "text-muted-foreground",
    gradient: "from-muted-foreground/20 to-muted-foreground/10",
  },
  {
    name: "Contributor",
    minScore: 20,
    color: "text-primary",
    gradient: "from-primary/20 to-primary/10",
  },
  {
    name: "Builder",
    minScore: 50,
    color: "text-brand-green",
    gradient: "from-brand-green/20 to-brand-green/10",
  },
  {
    name: "Mentor",
    minScore: 100,
    color: "text-brand-purple",
    gradient: "from-brand-purple/20 to-brand-purple/10",
  },
  {
    name: "Leader",
    minScore: 200,
    color: "text-teaching",
    gradient: "from-amber-500/20 to-amber-500/10",
  },
  {
    name: "Legend",
    minScore: 500,
    color: "text-brand-green",
    gradient: "from-brand-green/30 to-brand-purple/20",
  },
];

export function getTier(score: number): ReputationTier {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

export function getTierProgress(score: number): {
  current: ReputationTier;
  next: ReputationTier | null;
  progress: number;
} {
  const tier = getTier(score);
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1] ?? null;
  if (!next) return { current: tier, next: null, progress: 100 };
  const range = next.minScore - tier.minScore;
  const progress = Math.min(100, Math.round(((score - tier.minScore) / range) * 100));
  return { current: tier, next, progress };
}
