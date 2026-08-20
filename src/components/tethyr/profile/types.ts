import { Github, Globe, Sparkles } from "lucide-react";
import type { SkillVerificationLevel, SkillExperienceLevel } from "@/hooks/use-current-user";
import type { ProjectPresentationPreset } from "@/lib/project-presentation";

export type ProjectStatus = "planning" | "active" | "paused" | "completed";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  planning: "border-border bg-background/60 text-muted-foreground",
  active:
    "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  paused: "border-teaching/40 bg-teaching text-teaching",
  completed:
    "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
};

export const VERIFICATION_LABEL: Record<SkillVerificationLevel, string> = {
  self_declared: "Self-declared",
  proof_certified: "Proof certified",
  community_recognized: "Community recognized",
};

export const VERIFICATION_STYLE: Record<SkillVerificationLevel, string> = {
  self_declared: "border-border/60 bg-background/40 text-muted-foreground",
  proof_certified:
    "border-[var(--user-accent,var(--primary))]/40 bg-[var(--user-accent-subtle,var(--learning-subtle))] text-[var(--user-accent,var(--primary))]",
  community_recognized:
    "border-[var(--brand-purple)]/40 bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]",
};

export const EXPERIENCE_LABEL: Record<SkillExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

export type ProjectSkill = { id: string; name: string; category: string };

export type ProjectRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  vision: string | null;
  status: ProjectStatus;
  visibility: "public" | "private";
  stage: "planning" | "building" | "testing" | "launch" | "growing";
  started_at: string;
  progress_percent: number;
  cover_url: string | null;
  gallery: { url: string; caption?: string; type: "image" | "video" }[];
  resources: { title: string; url: string; type: "article" | "tool" | "video" | "doc" | "other" }[];
  media: string[];
  links: Record<string, string>;
  tags: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
  presentation_preset?: ProjectPresentationPreset | null;
  created_at: string;
  updated_at: string;
};

export const PROJECT_LINK_KEYS: { key: string; label: string; icon: typeof Github }[] = [
  { key: "website", label: "Website", icon: Globe },
  { key: "github", label: "GitHub", icon: Github },
  { key: "figma", label: "Figma", icon: Sparkles },
  { key: "behance", label: "Behance", icon: Sparkles },
  { key: "dribbble", label: "Dribbble", icon: Sparkles },
];

export const PROJECT_CREATION_STEPS = ["Basics", "Direction", "Share"] as const;

export function canContinueProjectCreation(step: number, title: string): boolean {
  return step !== 0 || title.trim().length > 0;
}

export type ActivityRow = {
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

import { Wrench, Layers, Rocket, History, ExternalLink } from "lucide-react";

export const PROFILE_ICONS = { Wrench, Layers, Rocket, History, ExternalLink };
