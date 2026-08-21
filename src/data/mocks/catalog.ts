// Explore / catalog constants — the shared filter taxonomy for discovering
// projects and opportunities. Single source of truth for the category chips,
// the "browse by need" role→skills mapping, and the display maps that render
// them, so the explore page, project shelf, and JSON-LD all agree.
export const PROJECT_CATEGORIES = [
  "All",
  "Projects",
  "Design",
  "Development",
  "Video",
  "Photography",
  "Music",
  "Writing",
  "Marketing",
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

// Categories used by the Explore filters. "Projects" is a view, not a craft,
// so it belongs in the main tab bar rather than beside Design and Development.
export const EXPLORE_FILTER_CATEGORIES = PROJECT_CATEGORIES.filter(
  (category) => category !== "Projects",
);

/** A "browse by need" chip: a role label mapped to the skills it implies. */
export interface OpportunityNeedChip {
  label: string;
  skills: string[];
}

export const OPPORTUNITY_NEED_CHIPS: OpportunityNeedChip[] = [
  { label: "Designer", skills: ["design", "ui/ux", "graphic design", "illustration", "figma"] },
  { label: "Developer", skills: ["react", "typescript", "python", "rust", "javascript", "go"] },
  { label: "Musician", skills: ["music", "audio", "sound design", "composition"] },
  { label: "Photographer", skills: ["photography", "photo editing", "lightroom"] },
  { label: "Writer", skills: ["writing", "copywriting", "content", "editing"] },
  { label: "Video Editor", skills: ["video", "video editing", "motion", "after effects"] },
  { label: "Marketer", skills: ["marketing", "seo", "social media", "growth"] },
  { label: "Mentor", skills: ["mentoring", "teaching", "coaching"] },
];

export type NeedUrgency = "high" | "normal" | "low";

/** Human label for an open-need urgency level. */
export const NEED_LABEL: Record<NeedUrgency, string> = {
  high: "High",
  normal: "Soon",
  low: "Whenever",
};

/** Badge classes per urgency level. */
export const NEED_BADGE: Record<NeedUrgency, string> = {
  high: "border-destructive/30 bg-destructive/5 text-destructive",
  normal: "border-brand-green/30 bg-brand-green/5 text-brand-green",
  low: "border-border/60 bg-surface text-muted-foreground",
};

/** Popularity-sort rank per project stage (higher = more momentum). */
export const STAGE_RANK: Record<string, number> = {
  growing: 5,
  building: 4,
  launch: 3,
  testing: 2,
  planning: 1,
};
