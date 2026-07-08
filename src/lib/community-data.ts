// Placeholder data layer for the Community MVP.
//
// Nothing here touches Supabase yet — the Community surface is being built
// UI-first with realistic seed content so the feed, sidebars, and cards can
// be wired to real tables later without reshaping the components. When the
// backend lands, this file is the seam: swap the exported arrays for query
// results with the same shapes and everything above keeps working.
//
// Design rule for this whole surface: every section should answer "does
// this help someone learn, teach, build, or collaborate?" Popularity and
// follower counts are deliberately absent — contribution is the currency.

export type ReputationBadge =
  | "Helpful Mentor"
  | "Verified Teacher"
  | "Project Builder"
  | "Community Contributor"
  | "Expert"
  | "Learner";

export const BADGE_STYLES: Record<ReputationBadge, string> = {
  "Helpful Mentor": "border-brand-green/40 bg-brand-green/10 text-brand-green",
  "Verified Teacher": "border-primary/40 bg-primary/10 text-primary",
  "Project Builder": "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
  "Community Contributor": "border-border bg-surface-elevated text-foreground",
  Expert: "border-brand-purple/40 bg-brand-purple/10 text-brand-purple",
  Learner: "border-border bg-surface-elevated text-muted-foreground",
};

export type PostType =
  | "showcase"
  | "question"
  | "project_update"
  | "tutorial"
  | "resource"
  | "achievement"
  | "discussion"
  | "help_request"
  | "collaboration_request"
  | "progress_update";

export const POST_TYPE_LABEL: Record<PostType, string> = {
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

// Discovery filters — replaces "only technical categories" with the actual
// modes people show up to Tethyr for.
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

export type PostAuthor = {
  name: string;
  title: string;
  reputation: number;
  badges: ReputationBadge[];
  accent: "green" | "purple";
};

export type PostStats = {
  likes: number;
  helpful: number;
  comments: number;
  saves: number;
  offers: number;
};

export type ProjectJourneyStage = "Day 1" | "Prototype" | "Alpha" | "Beta" | "Launch";
export const PROJECT_JOURNEY_STAGES: ProjectJourneyStage[] = [
  "Day 1",
  "Prototype",
  "Alpha",
  "Beta",
  "Launch",
];

export type Post = {
  id: string;
  type: PostType;
  author: PostAuthor;
  community: string;
  focus?: DiscoveryFocus;
  skills: string[];
  timestamp: string;
  title: string;
  body: string;
  cover?: { gradient: "brand" | "green" | "purple"; label: string };
  code?: { language: string; snippet: string };
  stats: PostStats;
  project?: {
    progress: number;
    contributors: number;
    feedback: number;
    journeyStage?: ProjectJourneyStage;
  };
  question?: {
    solved: boolean;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    bestAnswer?: string;
  };
  resource?: { kind: "Article" | "Video" | "GitHub Repo" | "Template" | "Book" | "Tool" };
  achievement?: { milestone: string };
  helpRequest?: { skillNeeded: string; difficulty: "Beginner" | "Intermediate" | "Advanced" };
  collaboration?: { rolesNeeded: string[] };
  progress?: { skill: string };
};

export const INITIAL_POSTS: Post[] = [
  {
    id: "p1",
    type: "showcase",
    author: {
      name: "Marta Solà",
      title: "Frontend Developer",
      reputation: 2140,
      badges: ["Project Builder", "Verified Teacher"],
      accent: "green",
    },
    community: "Design",
    focus: "Building",
    skills: ["React", "Framer Motion", "UI Design"],
    timestamp: "2h ago",
    title: "Shipped a redesign of my portfolio's case study pages",
    body: "Spent the week rebuilding the scroll-driven transitions from scratch instead of relying on a library — wanted full control over easing. Would love feedback on the pacing between sections.",
    cover: { gradient: "brand", label: "Case Study Redesign" },
    stats: { likes: 84, helpful: 31, comments: 12, saves: 19, offers: 2 },
  },
  {
    id: "p2",
    type: "question",
    author: {
      name: "Iker Etxeberria",
      title: "Learning Backend Dev",
      reputation: 340,
      badges: ["Learner"],
      accent: "purple",
    },
    community: "Programming",
    focus: "Learning",
    skills: ["PostgreSQL", "Node.js"],
    timestamp: "4h ago",
    title: "Why does my Postgres query slow down only after ~50k rows?",
    body: "It's fast in dev with seed data, but on staging with real volume it crawls. I've got an index on the join column already. Full query and EXPLAIN ANALYZE output below.",
    code: {
      language: "sql",
      snippet:
        "SELECT o.id, o.total, u.email\nFROM orders o\nJOIN users u ON u.id = o.user_id\nWHERE o.status = 'pending'\nORDER BY o.created_at DESC\nLIMIT 50;",
    },
    stats: { likes: 22, helpful: 45, comments: 18, saves: 9, offers: 3 },
    question: {
      solved: true,
      difficulty: "Intermediate",
      bestAnswer:
        "The index is on user_id, but you're filtering on status and sorting by created_at — add a composite index on (status, created_at) and it'll stop scanning the whole table.",
    },
  },
  {
    id: "p3",
    type: "tutorial",
    author: {
      name: "Priya Nair",
      title: "ML Engineer",
      reputation: 5320,
      badges: ["Expert", "Helpful Mentor"],
      accent: "purple",
    },
    community: "AI",
    focus: "Teaching",
    skills: ["Python", "PyTorch", "Machine Learning"],
    timestamp: "6h ago",
    title: "A gentler intro to attention, without the transformer paper jargon",
    body: "Wrote this after three people in the AI community asked me to explain self-attention without leaning on the original paper's notation. Starts from a search-and-retrieve analogy.",
    code: {
      language: "python",
      snippet:
        "scores = query @ key.T / sqrt(d_k)\nweights = softmax(scores, dim=-1)\noutput = weights @ value",
    },
    stats: { likes: 261, helpful: 198, comments: 47, saves: 132, offers: 0 },
  },
  {
    id: "p4",
    type: "project_update",
    author: {
      name: "Diego Fernández",
      title: "Indie Game Dev",
      reputation: 1580,
      badges: ["Project Builder"],
      accent: "green",
    },
    community: "Game Development",
    focus: "Building",
    skills: ["Unity", "C#", "Pixel Art"],
    timestamp: "9h ago",
    title: "Combat rework for Ashfall Keep is playable — looking for feedback",
    body: "Swapped the timing-based dodge for a stamina system. It reads much better in playtests but the boss fights need re-tuning. Video link in comments, would love hits on pacing.",
    cover: { gradient: "green", label: "Ashfall Keep — Combat v2" },
    stats: { likes: 143, helpful: 52, comments: 38, saves: 21, offers: 4 },
    project: { progress: 62, contributors: 4, feedback: 38, journeyStage: "Beta" },
  },
  {
    id: "p5",
    type: "resource",
    author: {
      name: "Helena Vidal",
      title: "Cybersecurity Analyst",
      reputation: 990,
      badges: ["Community Contributor"],
      accent: "purple",
    },
    community: "Cybersecurity",
    focus: "Open Source",
    skills: ["Network Security", "CTF"],
    timestamp: "11h ago",
    title: "A repo of annotated CTF writeups I wish existed when I started",
    body: "Curated ~40 beginner-to-intermediate writeups with the reasoning spelled out, not just the final payload. Organized by vulnerability class.",
    stats: { likes: 76, helpful: 61, comments: 9, saves: 88, offers: 0 },
    resource: { kind: "GitHub Repo" },
  },
  {
    id: "p6",
    type: "progress_update",
    author: {
      name: "Sofia Marín",
      title: "Learning Spanish → Catalan",
      reputation: 210,
      badges: ["Learner"],
      accent: "green",
    },
    community: "Languages",
    focus: "Language Exchange",
    skills: ["Catalan"],
    timestamp: "13h ago",
    title: "Finished my first 30-day Catalan streak 🎉",
    body: "Had my first full conversation with a neighbor yesterday without switching back to Spanish once. Small win but it felt huge.",
    stats: { likes: 312, helpful: 40, comments: 56, saves: 4, offers: 1 },
    progress: { skill: "Catalan" },
  },
  {
    id: "p7",
    type: "discussion",
    author: {
      name: "Tomás Ibáñez",
      title: "Product Designer",
      reputation: 1720,
      badges: ["Community Contributor", "Verified Teacher"],
      accent: "purple",
    },
    community: "Design",
    focus: "Career",
    skills: ["Design Systems"],
    timestamp: "1d ago",
    title: "Do design tokens actually save time on small teams, or just add ceremony?",
    body: "Curious what people under 5 designers have found. On my last two projects tokens felt like overhead until the project crossed ~3 platforms, then they paid for themselves fast.",
    stats: { likes: 58, helpful: 22, comments: 41, saves: 7, offers: 0 },
  },
  {
    id: "p8",
    type: "showcase",
    author: {
      name: "Lucas Ferreira",
      title: "Music Producer",
      reputation: 860,
      badges: ["Community Contributor"],
      accent: "green",
    },
    community: "Music",
    focus: "Creative Arts",
    skills: ["Ableton", "Sound Design"],
    timestamp: "1d ago",
    title: "Layered a full percussion kit from field recordings of my kitchen",
    body: "Every hit in this loop is a pan, a drawer, or a ceramic mug. Bounced stems if anyone wants to chop them up.",
    cover: { gradient: "purple", label: "Kitchen Percussion Kit" },
    stats: { likes: 197, helpful: 34, comments: 29, saves: 63, offers: 0 },
  },
  {
    id: "p9",
    type: "help_request",
    author: {
      name: "Nuria Camps",
      title: "Junior Frontend Dev",
      reputation: 120,
      badges: ["Learner"],
      accent: "purple",
    },
    community: "Design",
    focus: "Mentorship",
    skills: ["Figma", "UI Design"],
    timestamp: "1h ago",
    title: "Need feedback on my onboarding flow before I ship it",
    body: "First real onboarding flow I've designed solo. Three screens, trying not to over-explain. Would love a second pair of eyes, especially on screen 2.",
    stats: { likes: 6, helpful: 2, comments: 3, saves: 1, offers: 5 },
    helpRequest: { skillNeeded: "UI Design", difficulty: "Beginner" },
  },
  {
    id: "p10",
    type: "help_request",
    author: {
      name: "Marcus Webb",
      title: "Self-taught Python Dev",
      reputation: 95,
      badges: ["Learner"],
      accent: "green",
    },
    community: "Programming",
    focus: "Mentorship",
    skills: ["Python"],
    timestamp: "3h ago",
    title: "Stuck debugging a recursive function that hits max depth",
    body: "Works fine for small inputs but blows the stack on anything realistic. I think I'm missing a base case somewhere but I've stared at it too long to see it.",
    stats: { likes: 4, helpful: 1, comments: 5, saves: 0, offers: 3 },
    helpRequest: { skillNeeded: "Python", difficulty: "Beginner" },
  },
  {
    id: "p11",
    type: "help_request",
    author: {
      name: "Yuki Tanaka",
      title: "Learning Spanish",
      reputation: 60,
      badges: ["Learner"],
      accent: "purple",
    },
    community: "Languages",
    focus: "Language Exchange",
    skills: ["Spanish"],
    timestamp: "5h ago",
    title: "Looking for a Spanish conversation partner, evenings CET",
    body: "B1-ish level, can hold a conversation but freeze up on faster speech. Happy to trade — I can help with Japanese in return.",
    stats: { likes: 9, helpful: 0, comments: 2, saves: 0, offers: 4 },
    helpRequest: { skillNeeded: "Spanish", difficulty: "Intermediate" },
  },
  {
    id: "p12",
    type: "collaboration_request",
    author: {
      name: "Amara Okafor",
      title: "Product Designer",
      reputation: 780,
      badges: ["Project Builder"],
      accent: "green",
    },
    community: "Design",
    focus: "Collaboration",
    skills: ["React Native", "Product Design"],
    timestamp: "2h ago",
    title: "Building a habit tracker with a soft, non-guilt-trippy design — need a backend dev",
    body: "Design and mobile UI are mostly done. Need someone comfortable with a small Node/Postgres API to help wire up sync and notifications. Aiming for a small, ship-able v1.",
    stats: { likes: 31, helpful: 6, comments: 14, saves: 22, offers: 7 },
    collaboration: { rolesNeeded: ["Backend Developer"] },
  },
  {
    id: "p13",
    type: "collaboration_request",
    author: {
      name: "Diego Fernández",
      title: "Indie Game Dev",
      reputation: 1580,
      badges: ["Project Builder"],
      accent: "purple",
    },
    community: "Game Development",
    focus: "Collaboration",
    skills: ["Unity", "Pixel Art"],
    timestamp: "8h ago",
    title: "Ashfall Keep needs a pixel artist for boss sprite sheets",
    body: "Combat system's solid now, but I'm not an artist and it shows. Looking for someone into dark fantasy pixel art for 3-4 boss sprite sheets, revenue share on release.",
    stats: { likes: 45, helpful: 3, comments: 19, saves: 30, offers: 6 },
    collaboration: { rolesNeeded: ["Pixel Artist"] },
  },
  {
    id: "p14",
    type: "collaboration_request",
    author: {
      name: "Helena Vidal",
      title: "Cybersecurity Analyst",
      reputation: 990,
      badges: ["Community Contributor"],
      accent: "green",
    },
    community: "Cybersecurity",
    focus: "Open Source",
    skills: ["Network Security", "Technical Writing"],
    timestamp: "1d ago",
    title: "Want to build a beginner-friendly CTF platform together",
    body: "The writeups repo blew up more than expected — a few people asked for an actual practice platform to go with it. Looking for a backend dev and someone who likes writing challenge docs.",
    stats: { likes: 52, helpful: 8, comments: 21, saves: 40, offers: 9 },
    collaboration: { rolesNeeded: ["Backend Developer", "Technical Writer"] },
  },
];

export type Community = {
  id: string;
  name: string;
  members: number;
};

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

// -------- "People helping today" — replaces Top Contributors --------
// Contribution-based, not popularity-based: what someone *did*, not how
// much reputation they've stacked up.

export type HelpAction =
  | "answered_question"
  | "reviewed_project"
  | "helped_learner"
  | "shared_resource";

export const HELP_ACTION_LABEL: Record<HelpAction, string> = {
  answered_question: "Answered a question",
  reviewed_project: "Reviewed a project",
  helped_learner: "Helped a learner",
  shared_resource: "Shared a resource",
};

export type Helper = {
  name: string;
  title: string;
  action: HelpAction;
  detail: string;
  timeAgo: string;
};

export const HELPERS_TODAY: Helper[] = [
  {
    name: "Priya Nair",
    title: "ML Engineer",
    action: "answered_question",
    detail: "Explained composite indexes to Iker",
    timeAgo: "20m ago",
  },
  {
    name: "Marta Solà",
    title: "Frontend Developer",
    action: "reviewed_project",
    detail: "Left feedback on Ashfall Keep's combat rework",
    timeAgo: "1h ago",
  },
  {
    name: "Tomás Ibáñez",
    title: "Product Designer",
    action: "helped_learner",
    detail: "Walked Nuria through her onboarding flow",
    timeAgo: "2h ago",
  },
  {
    name: "Helena Vidal",
    title: "Cybersecurity Analyst",
    action: "shared_resource",
    detail: "Published 40 annotated CTF writeups",
    timeAgo: "3h ago",
  },
];

// -------- Project highlights — replaces bare progress percentages --------

export type ProjectHighlight = {
  title: string;
  creator: string;
  skills: string[];
  detail: string;
};

export const TRENDING_PROJECTS: ProjectHighlight[] = [
  { title: "Ashfall Keep", creator: "Diego Fernández", skills: ["Unity", "C#"], detail: "38 feedback notes this week" },
  { title: "Habit tracker (no guilt)", creator: "Amara Okafor", skills: ["React Native"], detail: "7 offers to help" },
];

export const COMMUNITY_FAVORITES: ProjectHighlight[] = [
  { title: "Kitchen Percussion Kit", creator: "Lucas Ferreira", skills: ["Sound Design"], detail: "63 saves" },
  { title: "Tethyr design tokens v2", creator: "Tomás Ibáñez", skills: ["Design Systems"], detail: "41 in the comments" },
];

export const RECENTLY_UPDATED_PROJECTS: ProjectHighlight[] = [
  { title: "Ashfall Keep", creator: "Diego Fernández", skills: ["Unity"], detail: "Updated 9h ago" },
  { title: "CTF practice platform", creator: "Helena Vidal", skills: ["Security"], detail: "Updated 1d ago" },
];

export const LOOKING_FOR_CONTRIBUTORS_PROJECTS: ProjectHighlight[] = [
  { title: "Habit tracker (no guilt)", creator: "Amara Okafor", skills: ["Node.js", "Postgres"], detail: "Needs a backend dev" },
  { title: "Ashfall Keep", creator: "Diego Fernández", skills: ["Pixel Art"], detail: "Needs a pixel artist" },
  { title: "CTF practice platform", creator: "Helena Vidal", skills: ["Backend", "Writing"], detail: "Needs 2 collaborators" },
];

export type Challenge = {
  id: string;
  title: string;
  participants: number;
  timeLeft: string;
  progress: number;
};

export const CHALLENGES: Challenge[] = [
  { id: "c1", title: "30 Days of Python", participants: 842, timeLeft: "9 days left", progress: 70 },
  { id: "c2", title: "Spanish Speaking Challenge", participants: 316, timeLeft: "3 days left", progress: 90 },
  { id: "c3", title: "Game Jam: Tiny Worlds", participants: 214, timeLeft: "12 days left", progress: 20 },
  { id: "c4", title: "UI Design Challenge", participants: 501, timeLeft: "5 days left", progress: 55 },
];

export type SolvedQuestion = { title: string; solver: string };

export const RECENTLY_SOLVED: SolvedQuestion[] = [
  { title: "Why does my Postgres query slow down only after ~50k rows?", solver: "Iker Etxeberria" },
  { title: "Best way to structure a monorepo for 3 small apps?", solver: "Nuria Camps" },
  { title: "CSS grid vs flexbox for a masonry-style feed?", solver: "Marta Solà" },
];

export const TRENDING_TOPICS: { label: string; posts: number }[] = [
  { label: "Self-attention explained", posts: 34 },
  { label: "Composite indexes", posts: 21 },
  { label: "Design tokens debate", posts: 41 },
  { label: "Field-recorded percussion", posts: 12 },
  { label: "CTF writeups", posts: 19 },
];

export const TRENDING_SKILLS: { skill: string; posts: number }[] = [
  { skill: "React", posts: 58 },
  { skill: "Python", posts: 46 },
  { skill: "UI Design", posts: 33 },
  { skill: "Unity", posts: 21 },
  { skill: "Spanish", posts: 17 },
];

export const SUGGESTED_COMMUNITIES: Community[] = [
  { id: "business", name: "Business", members: 5400 },
  { id: "photography", name: "Photography", members: 4700 },
  { id: "fitness", name: "Fitness", members: 3900 },
];

// -------- Community milestones — celebrate learning, not popularity --------

export type CommunityMilestone = { label: string; value: string };

export const COMMUNITY_MILESTONES: CommunityMilestone[] = [
  { label: "Tutorials published", value: "104" },
  { label: "Successful collaborations", value: "512" },
  { label: "Questions answered", value: "1,038" },
  { label: "Projects launched", value: "217" },
];

// -------- Skill recommendations --------

export type SkillRecommendation = {
  skill: string;
  tutorials: number;
  openQuestions: number;
  activeDiscussions: number;
  projectsNeedingHelp: number;
};

export const SKILL_RECOMMENDATIONS: SkillRecommendation[] = [
  { skill: "Linux", tutorials: 12, openQuestions: 4, activeDiscussions: 2, projectsNeedingHelp: 1 },
];

// -------- Active learning goals (what the person is currently learning) ----

export const ACTIVE_LEARNING_GOALS: string[] = ["Linux", "Python", "Spanish", "Blender"];

export const QUICK_ACTIONS: { type: PostType; label: string }[] = [
  { type: "showcase", label: "Showcase Project" },
  { type: "question", label: "Ask Question" },
  { type: "help_request", label: "Ask For Help" },
  { type: "collaboration_request", label: "Find Collaborators" },
  { type: "progress_update", label: "Share Progress" },
  { type: "resource", label: "Share Resource" },
  { type: "tutorial", label: "Write Tutorial" },
  { type: "achievement", label: "Share Achievement" },
];

export function reputationLabel(rep: number): string {
  if (rep >= 1000) return `${(rep / 1000).toFixed(rep % 1000 === 0 ? 0 : 1)}k rep`;
  return `${rep} rep`;
}
