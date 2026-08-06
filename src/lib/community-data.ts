// Community data layer.
//
// Types, labels, and display constants.
// All real data comes from Supabase — see src/hooks/use-community.ts.

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
};

export type ReputationBadge =
  | "Helpful Mentor"
  | "Verified Sharer"
  | "Project Builder"
  | "Community Contributor"
  | "Expert"
  | "Learner";

// ============================================================
// Display constants
// ============================================================

export const BADGE_STYLES: Record<ReputationBadge, string> = {
  "Helpful Mentor": "border-brand-green/40 bg-brand-green/10 text-brand-green",
  "Verified Sharer": "border-primary/40 bg-primary/10 text-primary",
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
  progress_update: "Growth Progress",
  lesson_learned: "Lesson Learned",
  feedback_request: "Feedback Request",
  open_role: "Open Role",
  poll: "Poll",
};

export const DISCOVERY_FILTERS = [
  "Growing",
  "Sharing",
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

export const ACTIVE_LEARNING_GOALS: string[] = [];

export const QUICK_ACTIONS: { type: string; label: string }[] = [
  { type: "discussion", label: "Start Conversation" },
  { type: "showcase", label: "Showcase Project" },
  { type: "question", label: "Ask Question" },
  { type: "help_request", label: "Ask For Help" },
  { type: "collaboration_request", label: "Find Collaborators" },
  { type: "progress_update", label: "Share Progress" },
  { type: "resource", label: "Share Resource" },
  { type: "tutorial", label: "Write Tutorial" },
  { type: "achievement", label: "Share Achievement" },
  { type: "lesson_learned", label: "Lesson Learned" },
  { type: "feedback_request", label: "Request Feedback" },
  { type: "open_role", label: "Post Open Role" },
  { type: "poll", label: "Create Poll" },
];
