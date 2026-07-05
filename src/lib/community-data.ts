// Placeholder data layer for the Community MVP.
//
// Nothing here touches Supabase yet — the Community surface is being built
// UI-first with realistic seed content so the feed, sidebars, and cards can
// be wired to real tables later without reshaping the components. When the
// backend lands, this file is the seam: swap the exported arrays for query
// results with the same shapes and everything above keeps working.

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
  | "discussion";

export const POST_TYPE_LABEL: Record<PostType, string> = {
  showcase: "Showcase",
  question: "Question",
  project_update: "Project Update",
  tutorial: "Tutorial",
  resource: "Resource",
  achievement: "Achievement",
  discussion: "Discussion",
};

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
};

export type Post = {
  id: string;
  type: PostType;
  author: PostAuthor;
  community: string;
  skills: string[];
  timestamp: string;
  title: string;
  body: string;
  cover?: { gradient: "brand" | "green" | "purple"; label: string };
  code?: { language: string; snippet: string };
  stats: PostStats;
  project?: { progress: number; contributors: number; feedback: number };
  question?: {
    solved: boolean;
    difficulty: "Beginner" | "Intermediate" | "Advanced";
    bestAnswer?: string;
  };
  resource?: { kind: "Article" | "Video" | "GitHub Repo" | "Template" | "Book" | "Tool" };
  achievement?: { milestone: string };
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
    skills: ["React", "Framer Motion", "UI Design"],
    timestamp: "2h ago",
    title: "Shipped a redesign of my portfolio's case study pages",
    body: "Spent the week rebuilding the scroll-driven transitions from scratch instead of relying on a library — wanted full control over easing. Would love feedback on the pacing between sections.",
    cover: { gradient: "brand", label: "Case Study Redesign" },
    stats: { likes: 84, helpful: 31, comments: 12, saves: 19 },
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
    skills: ["PostgreSQL", "Node.js"],
    timestamp: "4h ago",
    title: "Why does my Postgres query slow down only after ~50k rows?",
    body: "It's fast in dev with seed data, but on staging with real volume it crawls. I've got an index on the join column already. Full query and EXPLAIN ANALYZE output below.",
    code: {
      language: "sql",
      snippet:
        "SELECT o.id, o.total, u.email\nFROM orders o\nJOIN users u ON u.id = o.user_id\nWHERE o.status = 'pending'\nORDER BY o.created_at DESC\nLIMIT 50;",
    },
    stats: { likes: 22, helpful: 45, comments: 18, saves: 9 },
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
    skills: ["Python", "PyTorch", "Machine Learning"],
    timestamp: "6h ago",
    title: "A gentler intro to attention, without the transformer paper jargon",
    body: "Wrote this after three people in the AI community asked me to explain self-attention without leaning on the original paper's notation. Starts from a search-and-retrieve analogy.",
    code: {
      language: "python",
      snippet:
        "scores = query @ key.T / sqrt(d_k)\nweights = softmax(scores, dim=-1)\noutput = weights @ value",
    },
    stats: { likes: 261, helpful: 198, comments: 47, saves: 132 },
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
    skills: ["Unity", "C#", "Pixel Art"],
    timestamp: "9h ago",
    title: "Combat rework for Ashfall Keep is playable — looking for feedback",
    body: "Swapped the timing-based dodge for a stamina system. It reads much better in playtests but the boss fights need re-tuning. Video link in comments, would love hits on pacing.",
    cover: { gradient: "green", label: "Ashfall Keep — Combat v2" },
    stats: { likes: 143, helpful: 52, comments: 38, saves: 21 },
    project: { progress: 62, contributors: 4, feedback: 38 },
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
    skills: ["Network Security", "CTF"],
    timestamp: "11h ago",
    title: "A repo of annotated CTF writeups I wish existed when I started",
    body: "Curated ~40 beginner-to-intermediate writeups with the reasoning spelled out, not just the final payload. Organized by vulnerability class.",
    stats: { likes: 76, helpful: 61, comments: 9, saves: 88 },
    resource: { kind: "GitHub Repo" },
  },
  {
    id: "p6",
    type: "achievement",
    author: {
      name: "Sofia Marín",
      title: "Learning Spanish → Catalan",
      reputation: 210,
      badges: ["Learner"],
      accent: "green",
    },
    community: "Languages",
    skills: ["Catalan"],
    timestamp: "13h ago",
    title: "Finished my first 30-day Catalan streak 🎉",
    body: "Had my first full conversation with a neighbor yesterday without switching back to Spanish once. Small win but it felt huge.",
    stats: { likes: 312, helpful: 40, comments: 56, saves: 4 },
    achievement: { milestone: "30-day streak" },
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
    skills: ["Design Systems"],
    timestamp: "1d ago",
    title: "Do design tokens actually save time on small teams, or just add ceremony?",
    body: "Curious what people under 5 designers have found. On my last two projects tokens felt like overhead until the project crossed ~3 platforms, then they paid for themselves fast.",
    stats: { likes: 58, helpful: 22, comments: 41, saves: 7 },
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
    skills: ["Ableton", "Sound Design"],
    timestamp: "1d ago",
    title: "Layered a full percussion kit from field recordings of my kitchen",
    body: "Every hit in this loop is a pan, a drawer, or a ceramic mug. Bounced stems if anyone wants to chop them up.",
    cover: { gradient: "purple", label: "Kitchen Percussion Kit" },
    stats: { likes: 197, helpful: 34, comments: 29, saves: 63 },
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

export type Contributor = {
  name: string;
  title: string;
  reputation: number;
  badge: ReputationBadge;
};

export const TOP_CONTRIBUTORS: Contributor[] = [
  { name: "Priya Nair", title: "ML Engineer", reputation: 5320, badge: "Expert" },
  { name: "Marta Solà", title: "Frontend Developer", reputation: 2140, badge: "Project Builder" },
  { name: "Tomás Ibáñez", title: "Product Designer", reputation: 1720, badge: "Verified Teacher" },
  { name: "Diego Fernández", title: "Indie Game Dev", reputation: 1580, badge: "Project Builder" },
];

export type FeaturedProject = {
  title: string;
  creator: string;
  skills: string[];
  progress: number;
};

export const FEATURED_PROJECTS: FeaturedProject[] = [
  { title: "Ashfall Keep", creator: "Diego Fernández", skills: ["Unity", "C#"], progress: 62 },
  { title: "Tethyr design tokens v2", creator: "Tomás Ibáñez", skills: ["Design Systems"], progress: 40 },
  { title: "Kitchen Percussion Kit", creator: "Lucas Ferreira", skills: ["Sound Design"], progress: 85 },
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

export const SUGGESTED_COMMUNITIES: Community[] = [
  { id: "business", name: "Business", members: 5400 },
  { id: "photography", name: "Photography", members: 4700 },
  { id: "fitness", name: "Fitness", members: 3900 },
];

export const QUICK_ACTIONS: { type: PostType; label: string }[] = [
  { type: "showcase", label: "Showcase Project" },
  { type: "question", label: "Ask Question" },
  { type: "resource", label: "Share Resource" },
  { type: "tutorial", label: "Write Tutorial" },
  { type: "achievement", label: "Share Achievement" },
];

export function reputationLabel(rep: number): string {
  if (rep >= 1000) return `${(rep / 1000).toFixed(rep % 1000 === 0 ? 0 : 1)}k rep`;
  return `${rep} rep`;
}
