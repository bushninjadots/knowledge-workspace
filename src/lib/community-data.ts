// Community data layer.
//
// Constants, labels, and type definitions. Seed data has been replaced by
// real Supabase tables — see src/hooks/use-community.ts for data fetching.

// Re-export Supabase types so existing component imports keep working
export type {
  PostType,
  PostRow,
  PostWithAuthor,
  CommentRow,
  PostActionRow,
  CreatePostInput,
  UpdatePostInput,
} from "@/hooks/use-community";

// ============================================================
// Sidebar / display types
// ============================================================

export type Community = {
  id: string;
  name: string;
  members: number;
};

export type ReputationBadge =
  | "Helpful Mentor"
  | "Verified Teacher"
  | "Project Builder"
  | "Community Contributor"
  | "Expert"
  | "Learner";

// ============================================================
// Display constants (static sidebar data)
// ============================================================

export const BADGE_STYLES: Record<ReputationBadge, string> = {
  "Helpful Mentor": "border-brand-green/40 bg-brand-green/10 text-brand-green",
  "Verified Teacher": "border-primary/40 bg-primary/10 text-primary",
  "Project Builder": "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
  "Community Contributor": "border-border bg-surface-elevated text-foreground",
  Expert: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
  Learner: "border-border bg-surface-elevated text-muted-foreground",
};

export const POST_TYPE_LABEL: Record<string, string> = {
  showcase: "Showcase",
  question: "Question",
  project_update: "Project Update",
  tutorial: "Tutorial",
  resource: "Resource",
  achievement: "Achievement",
  discussion: "Discussion",
  help_request: "Help Request",
  collaboration_request: "Collaboration Request",
  progress_update: "Learning Progress",
};

export const DISCOVERY_FILTERS = [
  "Learning",
  "Teaching",
  "Building",
  "Collaboration",
  "Mentorship",
  "Language Exchange",
  "Career",
  "Open Source",
  "Creative Arts",
  "Business",
] as const;
export type DiscoveryFocus = (typeof DISCOVERY_FILTERS)[number];

export const COMMUNITIES: Community[] = [
  { id: "programming", name: "Programming", members: 18400 },
  { id: "ai", name: "AI", members: 15200 },
  { id: "cybersecurity", name: "Cybersecurity", members: 6800 },
  { id: "languages", name: "Languages", members: 9100 },
  { id: "game-dev", name: "Game Development", members: 7300 },
  { id: "design", name: "Design", members: 11900 },
  { id: "business", name: "Business", members: 5400 },
  { id: "photography", name: "Photography", members: 4700 },
  { id: "music", name: "Music", members: 6200 },
  { id: "fitness", name: "Fitness", members: 3900 },
];

export const CHALLENGES = [
  { id: "c1", title: "30 Days of Python", participants: 842, timeLeft: "9 days left", progress: 70 },
  { id: "c2", title: "Spanish Speaking Challenge", participants: 316, timeLeft: "3 days left", progress: 90 },
  { id: "c3", title: "Game Jam: Tiny Worlds", participants: 214, timeLeft: "12 days left", progress: 20 },
  { id: "c4", title: "UI Design Challenge", participants: 501, timeLeft: "5 days left", progress: 55 },
];

export const ACTIVE_LEARNING_GOALS: string[] = ["Linux", "Python", "Spanish", "Blender"];

export const QUICK_ACTIONS: { type: string; label: string }[] = [
  { type: "showcase", label: "Showcase Project" },
  { type: "question", label: "Ask Question" },
  { type: "help_request", label: "Ask For Help" },
  { type: "collaboration_request", label: "Find Collaborators" },
  { type: "progress_update", label: "Share Progress" },
  { type: "resource", label: "Share Resource" },
  { type: "tutorial", label: "Write Tutorial" },
  { type: "achievement", label: "Share Achievement" },
];

export const TRENDING_SKILLS = [
  { skill: "React", posts: 234 },
  { skill: "Python", posts: 189 },
  { skill: "TypeScript", posts: 156 },
  { skill: "Machine Learning", posts: 142 },
  { skill: "Rust", posts: 98 },
];

export const COMMUNITY_MILESTONES = [
  { label: "Questions answered", value: "1,247" },
  { label: "Projects shared", value: "389" },
  { label: "Tutorials published", value: "156" },
  { label: "Collaborations formed", value: "72" },
];

export const SUGGESTED_COMMUNITIES: Community[] = [
  { id: "rust", name: "Rustaceans", members: 4200 },
  { id: "ml", name: "Machine Learning Hub", members: 7800 },
  { id: "gamedev", name: "Indie Game Dev", members: 3100 },
  { id: "web3", name: "Web3 Builders", members: 2900 },
];

export const SKILL_RECOMMENDATIONS = [
  { skill: "TypeScript", tutorials: 12, openQuestions: 8, projectsNeedingHelp: 3 },
  { skill: "Node.js", tutorials: 9, openQuestions: 14, projectsNeedingHelp: 5 },
  { skill: "PostgreSQL", tutorials: 6, openQuestions: 4, projectsNeedingHelp: 2 },
];

export const INITIAL_POSTS = [
  {
    id: "ip1",
    type: "help_request" as const,
    title: "How to implement real-time sync with Supabase?",
    community: "Programming",
    author: { handle: "newdev", display_name: "Alex" },
    skills: ["Supabase", "React"],
    helpRequest: { skillNeeded: "Supabase", difficulty: "Intermediate" },
    collaboration: null,
    body: "",
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0 },
    myActions: [],
  },
  {
    id: "ip2",
    type: "help_request" as const,
    title: "Struggling with CSS grid alignment",
    community: "Design",
    author: { handle: "learner42", display_name: "Sam" },
    skills: ["CSS", "Design"],
    helpRequest: { skillNeeded: "CSS Grid", difficulty: "Beginner" },
    collaboration: null,
    body: "",
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0 },
    myActions: [],
  },
  {
    id: "ip3",
    type: "help_request" as const,
    title: "Docker container keeps crashing on deploy",
    community: "Programming",
    author: { handle: "devops_learner", display_name: "Jordan" },
    skills: ["Docker", "DevOps"],
    helpRequest: { skillNeeded: "Docker", difficulty: "Advanced" },
    collaboration: null,
    body: "",
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0 },
    myActions: [],
  },
  {
    id: "ip4",
    type: "collaboration_request" as const,
    title: "Building an open-source habit tracker app",
    community: "Programming",
    author: { handle: "builder_kai", display_name: "Kai" },
    skills: ["React", "TypeScript", "Supabase"],
    helpRequest: null,
    collaboration: { rolesNeeded: ["Frontend Dev", "Designer"] },
    body: "",
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0 },
    myActions: [],
  },
  {
    id: "ip5",
    type: "collaboration_request" as const,
    title: "Looking for a language exchange partner",
    community: "Languages",
    author: { handle: "polyglot_maya", display_name: "Maya" },
    skills: ["Japanese", "Spanish"],
    helpRequest: null,
    collaboration: { rolesNeeded: ["Japanese Speaker", "Spanish Speaker"] },
    body: "",
    stats: { likes: 0, helpful: 0, saves: 0, offers: 0 },
    myActions: [],
  },
];

export function reputationLabel(_rep: number): string {
  // Will be computed from real data later
  return "";
}
