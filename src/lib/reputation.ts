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
  { type: "first_project", label: "First Project", description: "Published your first project", icon: "Rocket", color: "text-brand-green" },
  { type: "first_milestone", label: "First Milestone", description: "Completed your first milestone", icon: "Flag", color: "text-brand-purple" },
  { type: "first_endorsement", label: "First Endorsement", description: "Received your first peer endorsement", icon: "ThumbsUp", color: "text-amber-500" },
  { type: "five_endorsements", label: "Rising Star", description: "Received 5 peer endorsements", icon: "Star", color: "text-amber-500" },
  { type: "ten_endorsements", label: "Ten Endorsements", description: "Received 10 peer endorsements", icon: "Award", color: "text-amber-500" },
  { type: "community_recognized", label: "Community Recognized", description: "A skill was endorsed 3+ times and upgraded", icon: "Shield", color: "text-brand-green" },
  { type: "mentor", label: "Mentor", description: "Contributed to a project as a mentor", icon: "GraduationCap", color: "text-brand-purple" },
  { type: "collaborator", label: "Collaborator", description: "Joined a project as a contributor", icon: "Users", color: "text-primary" },
  { type: "prolific_teacher", label: "Prolific Teacher", description: "Teaching 5+ skills", icon: "BookOpen", color: "text-brand-green" },
  { type: "project_builder", label: "Project Builder", description: "Published 3+ projects", icon: "Hammer", color: "text-primary" },
  { type: "community_builder", label: "Community Builder", description: "Created 10+ community posts", icon: "MessageCircle", color: "text-brand-purple" },
  { type: "reliable_collaborator", label: "Reliable Collaborator", description: "Active for 30+ days", icon: "Clock", color: "text-brand-green" },
  { type: "helped_ten_people", label: "Helped 10 People", description: "Contributed to 3+ projects", icon: "Heart", color: "text-amber-500" },
  { type: "learner_journey", label: "Learner's Journey", description: "Learning 5+ skills", icon: "Compass", color: "text-primary" },
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
    { name: "teaching", label: "Teaching", color: "text-brand-green" },
    { name: "learning", label: "Learning", color: "text-brand-purple" },
    { name: "community", label: "Community", color: "text-amber-500" },
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

export async function checkAndAwardAchievements(
  profileId: string,
): Promise<AchievementType[]> {
  const awarded: AchievementType[] = [];

  // Fetch current state
  const [
    { data: existing },
    { data: profile },
    { data: teachSkills },
    { data: projects },
    { data: endorsements },
    { data: contributions },
    { data: projectContrib },
  ] = await Promise.all([
    (supabase as any)
      .from("user_achievements")
      .select("achievement")
      .eq("profile_id", profileId),
    supabase
      .from("profiles")
      .select("created_at")
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("profile_skills_teach")
      .select("skill_id")
      .eq("profile_id", profileId),
    supabase
      .from("projects")
      .select("id")
      .eq("profile_id", profileId),
    supabase
      .from("skill_endorsements")
      .select("id")
      .eq("profile_id", profileId),
    (supabase as any)
      .from("contribution_log")
      .select("action")
      .eq("profile_id", profileId),
    supabase
      .from("project_contributors")
      .select("project_id")
      .eq("profile_id", profileId),
  ]);

  const owned = new Set((existing ?? []).map((e: any) => e.achievement));
  const endorsementsCount = (endorsements ?? []).length;
  const projectCount = (projects ?? []).length;
  const teachCount = (teachSkills ?? []).length;
  const actions = (contributions ?? []).map((c: any) => c.action as string);
  const joinedCount = (projectContrib ?? []).length;

  const checks: [AchievementType, boolean][] = [
    ["first_project", projectCount >= 1],
    ["project_builder", projectCount >= 3],
    ["first_endorsement", endorsementsCount >= 1],
    ["five_endorsements", endorsementsCount >= 5],
    ["ten_endorsements", endorsementsCount >= 10],
    ["prolific_teacher", teachCount >= 5],
    ["collaborator", joinedCount >= 1],
    ["helped_ten_people", joinedCount >= 3],
    ["first_milestone", actions.includes("milestone_completed")],
    ["community_builder", actions.filter((a: string) => a === "community_post_created").length >= 10],
    ["learner_journey", (actions.filter((a: string) => a === "learning_started").length) >= 3],
    [
      "reliable_collaborator",
      profile?.created_at
        ? (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24) >= 30
        : false,
    ],
  ];

  const toAward = checks
    .filter(([type, ok]) => ok && !owned.has(type))
    .map(([type]) => type);

  // Award new achievements
  if (toAward.length > 0) {
    await (supabase as any)
      .from("user_achievements")
      .insert(toAward.map((a) => ({ profile_id: profileId, achievement: a })));
    awarded.push(...toAward);
  }

  return awarded;
}

// ── Reputation tier ───────────────────────────────────────────

export type ReputationTier = {
  name: string;
  minScore: number;
  color: string;
  gradient: string;
};

export const TIERS: ReputationTier[] = [
  { name: "Newcomer", minScore: 0, color: "text-muted-foreground", gradient: "from-muted-foreground/20 to-muted-foreground/10" },
  { name: "Contributor", minScore: 20, color: "text-primary", gradient: "from-primary/20 to-primary/10" },
  { name: "Builder", minScore: 50, color: "text-brand-green", gradient: "from-brand-green/20 to-brand-green/10" },
  { name: "Mentor", minScore: 100, color: "text-brand-purple", gradient: "from-brand-purple/20 to-brand-purple/10" },
  { name: "Leader", minScore: 200, color: "text-amber-500", gradient: "from-amber-500/20 to-amber-500/10" },
  { name: "Legend", minScore: 500, color: "text-brand-green", gradient: "from-brand-green/30 to-brand-purple/20" },
];

export function getTier(score: number): ReputationTier {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (score >= t.minScore) tier = t;
  }
  return tier;
}

export function getTierProgress(score: number): { current: ReputationTier; next: ReputationTier | null; progress: number } {
  const tier = getTier(score);
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1] ?? null;
  if (!next) return { current: tier, next: null, progress: 100 };
  const range = next.minScore - tier.minScore;
  const progress = Math.min(100, Math.round(((score - tier.minScore) / range) * 100));
  return { current: tier, next, progress };
}
