/**
 * Tethyr domain types — mirrored from the app's existing data model
 * (src/hooks/use-projects.ts, src/hooks/use-current-user.ts, src/lib/credits.ts).
 * These replace the `as any` drift in the current Studio files.
 */

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed';
export type ProjectStage = 'planning' | 'building' | 'testing' | 'launch' | 'growing';
export type ProjectSeason = 'research' | 'prototype' | 'feedback' | 'launch' | 'building';
export type ProjectVisibility = 'public' | 'private';

export type CreditRole = 'creator' | 'mentor' | 'contributor';

export interface CollaborationBrief {
  need?: string | null;
  why_now?: string | null;
  contribution_shape?: string | null;
  time_shape?: string | null;
}

export interface ProfileLite {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_url?: string | null;
}

export interface ProjectCredit {
  profile_id: string;
  display_name: string;
  handle: string | null;
  role: CreditRole;
  credit_text: string;
  at: string;
  credit_count: number;
}

export interface ProjectRoleSlot {
  id: string;
  title: string;
  status: 'open' | 'filled';
  skills: string[];
  filled_by?: ProfileLite | null;
}

export interface ProjectNeed {
  id: string;
  project_id: string;
  title: string;
  kind: 'skill' | 'feedback' | 'resource' | 'introduction';
  status: 'open' | 'met';
  time_shape?: string | null;
}

export interface GalleryItem {
  url: string;
  caption?: string;
  type: 'image' | 'video';
}

export interface MilestoneRow {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done';
  due_date?: string | null;
}

/** How the viewer relates to this project — drives the three project shelves. */
export type ProjectRelation = 'owned' | 'contributing';

export interface ProjectDetail {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  stage: ProjectStage;
  season: ProjectSeason | null;
  started_at: string;
  updated_at: string;
  progress_percent: number;
  cover_url: string | null;
  gallery: GalleryItem[];
  tags: string[];
  tools: string[];
  looking_for_feedback: boolean;
  looking_for_collaborators: boolean;
  is_featured: boolean;
  collaboration_brief: CollaborationBrief | null;
  milestones: MilestoneRow[];
  credits: ProjectCredit[];
  roles: ProjectRoleSlot[];
  needs: ProjectNeed[];
  collaborators: ProfileLite[];
  /** Relation to the Studio owner. */
  relation: ProjectRelation;
  /** Owner's role on the project (their own or someone else's). */
  my_role: CreditRole;
  /** One-line summary of what the owner contributed — used on contribution shelves. */
  my_contribution: string | null;
  /** Owner of the project when relation is `contributing`. */
  owner?: ProfileLite | null;
}

export type SkillVerificationLevel = 'self_declared' | 'proof_certified' | 'community_recognized';
export type SkillExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ProfileSkill {
  id: string;
  name: string;
  category: string;
  verification: SkillVerificationLevel;
  experience: SkillExperienceLevel;
}

export interface PortfolioLink {
  label: string;
  url: string;
}

export interface EvidenceItem {
  project_id: string;
  title: string;
  note?: string;
  kind?: 'shipped' | 'talk' | 'writing' | 'artifact';
}

export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  creator_title: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  banner_caption: string;
  country: string;
  timezone: string;
  languages: string[];
  category: string;
  years_experience: number;
  portfolio_links: PortfolioLink[];
  social_links: Record<string, string>;
  availability: string;
  reputation_score: number;
  favourite_tools: string[];
  software_stack: string[];
  favorite_achievement: string;
  learning_goals: string[];
  teaching_style: string;
  evidence_shelf: EvidenceItem[];
  /** Free-text "what I'm looking for" — powers the direction block. */
  direction: {
    headline: string;
    seeking: string[];
    offering: string[];
  };
}