export type SpaceMemberRole = "owner" | "moderator" | "member";
export type SpaceVisibility = "public" | "private";
export type SpaceJoinType = "auto" | "review";

export type CommunitySpace = {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string | null;
  visibility: SpaceVisibility;
  join_type: SpaceJoinType;
  rules: string[];
  /** How many open reports it takes before a post is auto-dimmed (1-10). */
  report_auto_dim_threshold: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
  my_role?: SpaceMemberRole | null;
  /** True when the current user has a pending join request (review-only spaces). */
  has_pending_request?: boolean;
};

export type JoinRequestRow = {
  space_id: string;
  user_id: string;
  note: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

export type PostReportRow = {
  id: string;
  post_id: string | null;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  moderator_note: string | null;
  resolved_at: string | null;
  post_title_snapshot: string | null;
  space_id_snapshot: string | null;
  created_at: string;
  reporter?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  post?: {
    title: string | null;
    space_id: string | null;
    body: string | null;
    author_id: string | null;
  };
  post_author?: {
    display_name: string | null;
    handle: string | null;
  };
};

export type ModerationLogRow = {
  id: string;
  space_id: string;
  post_id: string | null;
  post_title: string | null;
  actor_id: string | null;
  action: "remove_post" | "remove_share";
  created_at: string;
  actor?: {
    display_name: string | null;
    handle: string | null;
  };
};

export const SPACES_KEY = ["community-spaces"] as const;
export const SPACE_KEY = (slug: string) => ["community-space", slug] as const;
export const SPACE_POSTS_KEY = (spaceId: string) => ["space-posts", spaceId] as const;
