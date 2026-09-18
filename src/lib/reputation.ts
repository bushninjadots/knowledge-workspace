// Reputation engine — defines point values, achievement thresholds, and
// the achievement-checking logic that runs client-side after DB mutations.

import { supabase } from "@/integrations/supabase/client";

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
  | "learner_journey"
  | "challenge_winner"
  | "crew_founder"
  | "team_player"
  | "milestone_master"
  | "helping_hand"
  | "conversation_starter"
  | "role_filler"
  | "first_session"
  | "session_teacher"
  | "streak_4_weeks";

export type AchievementDef = {
  type: AchievementType;
  label: string;
  description: string;
  icon: string; // achievement type key for ACHIEVEMENT_ICONS lookup
  color: string; // tailwind color class
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    type: "first_project",
    label: "First Project",
    description: "Published your first project",
    icon: "first_project",
    color: "text-trust",
  },
  {
    type: "first_milestone",
    label: "First Milestone",
    description: "Completed your first milestone",
    icon: "first_milestone",
    color: "text-ai",
  },
  {
    type: "first_endorsement",
    label: "First Endorsement",
    description: "Received your first peer endorsement",
    icon: "first_endorsement",
    color: "text-teaching",
  },
  {
    type: "five_endorsements",
    label: "Rising Star",
    description: "Received 5 peer endorsements",
    icon: "five_endorsements",
    color: "text-teaching",
  },
  {
    type: "ten_endorsements",
    label: "Ten Endorsements",
    description: "Received 10 peer endorsements",
    icon: "ten_endorsements",
    color: "text-teaching",
  },
  {
    type: "community_recognized",
    label: "Community Recognized",
    description: "A skill was endorsed 3+ times and upgraded",
    icon: "community_recognized",
    color: "text-trust",
  },
  {
    type: "mentor",
    label: "Mentor",
    description: "Contributed to a project as a mentor",
    icon: "mentor",
    color: "text-ai",
  },
  {
    type: "collaborator",
    label: "Collaborator",
    description: "Joined a project as a contributor",
    icon: "collaborator",
    color: "text-primary",
  },
  {
    type: "prolific_teacher",
    label: "Prolific Sharer",
    description: "Teaching 5+ skills",
    icon: "prolific_teacher",
    color: "text-trust",
  },
  {
    type: "project_builder",
    label: "Project Builder",
    description: "Published 3+ projects",
    icon: "project_builder",
    color: "text-primary",
  },
  {
    type: "community_builder",
    label: "Community Builder",
    description: "Created 10+ community posts",
    icon: "community_builder",
    color: "text-ai",
  },
  {
    type: "reliable_collaborator",
    label: "Reliable Collaborator",
    description: "Active for 30+ days",
    icon: "reliable_collaborator",
    color: "text-trust",
  },
  {
    type: "helped_ten_people",
    label: "Multi-Project Collaborator",
    description: "Contributed to 3+ projects",
    icon: "helped_ten_people",
    color: "text-teaching",
  },
  {
    type: "learner_journey",
    label: "Growth Journey",
    description: "Growing in 3+ skills",
    icon: "learner_journey",
    color: "text-primary",
  },
  {
    type: "challenge_winner",
    label: "Challenge Winner",
    description: "Passed a challenge review",
    icon: "challenge_winner",
    color: "text-ai",
  },
  {
    type: "crew_founder",
    label: "Crew Founder",
    description: "Formed a crew",
    icon: "crew_founder",
    color: "text-primary",
  },
  {
    type: "team_player",
    label: "Team Player",
    description: "Joined a crew",
    icon: "team_player",
    color: "text-trust",
  },
  {
    type: "milestone_master",
    label: "Milestone Master",
    description: "Completed 3 milestones",
    icon: "milestone_master",
    color: "text-ai",
  },
  {
    type: "helping_hand",
    label: "Helping Hand",
    description: "Offered help on a request",
    icon: "helping_hand",
    color: "text-teaching",
  },
  {
    type: "conversation_starter",
    label: "Conversation Starter",
    description: "Posted your first comment",
    icon: "conversation_starter",
    color: "text-primary",
  },
  {
    type: "role_filler",
    label: "Role Filler",
    description: "Accepted into an open role",
    icon: "role_filler",
    color: "text-trust",
  },
  {
    type: "first_session",
    label: "First Session",
    description: "Completed your first session",
    icon: "first_session",
    color: "text-primary",
  },
  {
    type: "session_teacher",
    label: "Session Teacher",
    description: "Organized 5+ completed sessions",
    icon: "session_teacher",
    color: "text-ai",
  },
  {
    type: "streak_4_weeks",
    label: "4-Week Streak",
    description: "Active for 4 consecutive weeks",
    icon: "streak_4_weeks",
    color: "text-trust",
  },
];

// ── Category breakdown ────────────────────────────────────────

type ReputationCategory = {
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
    { name: "teaching", label: "Skills I share", color: "text-trust" },
    { name: "learning", label: "Skills I’m growing", color: "text-ai" },
    { name: "community", label: "Community", color: "text-teaching" },
    { name: "project_impact", label: "Project Impact", color: "text-trust" },
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

type ReputationTier = {
  name: string;
  minScore: number;
  color: string;
  gradient: string;
};

const TIERS: ReputationTier[] = [
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
    color: "text-trust",
    gradient: "from-trust/20 to-trust/10",
  },
  {
    name: "Mentor",
    minScore: 100,
    color: "text-ai",
    gradient: "from-ai/20 to-ai/10",
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
    color: "text-trust",
    gradient: "from-trust/30 to-ai/20",
  },
];

function getTier(score: number): ReputationTier {
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
