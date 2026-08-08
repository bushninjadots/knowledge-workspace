import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Until Supabase types are regenerated after migration, cast new tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ============================================================
// Types
// ============================================================

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
  | "progress_update"
  | "lesson_learned"
  | "feedback_request"
  | "open_role"
  | "poll";

export const VALID_POST_TYPES: Set<string> = new Set([
  "showcase",
  "question",
  "project_update",
  "tutorial",
  "resource",
  "achievement",
  "discussion",
  "help_request",
  "collaboration_request",
  "progress_update",
  "lesson_learned",
  "feedback_request",
  "open_role",
  "poll",
]);

export type ProjectSnapshot = {
  name: string;
  description: string | null;
  platform:
    | "tethyr"
    | "github"
    | "gitlab"
    | "codeberg"
    | "figma"
    | "behance"
    | "dribbble"
    | "notion"
    | "website"
    | "other";
  url: string;
  logo: string | null;
  status?: string;
  stage?: string;
  stars?: number;
  language?: string;
  owner?: string;
};

export type PostRow = {
  id: string;
  author_id: string;
  type: PostType;
  title: string;
  body: string;
  community: string;
  skills: string[];
  focus: string | null;
  question_data: Record<string, unknown> | null;
  resource_data: Record<string, unknown> | null;
  achievement_data: Record<string, unknown> | null;
  help_data: Record<string, unknown> | null;
  collaboration_data: Record<string, unknown> | null;
  progress_data: Record<string, unknown> | null;
  project_data: Record<string, unknown> | null;
  poll_data: Record<string, unknown> | null;
  project_id: string | null;
  project_snapshot: ProjectSnapshot | null;
  feedback_tags: string[];
  images: string[];
  space_id: string | null;
  is_pinned: boolean;
  /** Colored category tag shown next to the type (Reddit-style flair). */
  flair: string | null;
  /** When set, the post is a link post — the body links out to this URL. */
  link_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined from profiles
  author?: {
    display_name: string | null;
    handle: string | null;
    creator_title: string | null;
    category: string | null;
    avatar_url: string | null;
  };
};

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  is_best_answer: boolean;
  /** When set, this comment is a reply to another comment (nested thread). */
  parent_id: string | null;
  created_at: string;
  author?: {
    display_name: string | null;
    handle: string | null;
    creator_title: string | null;
    avatar_url: string | null;
  };
};

export type PostActionRow = {
  id: string;
  post_id: string;
  user_id: string;
  action: "like" | "helpful" | "save" | "offer";
  created_at: string;
};

export type PostWithAuthor = PostRow & {
  author: NonNullable<PostRow["author"]>;
  stats: { likes: number; helpful: number; saves: number; offers: number };
  myActions: string[]; // actions the current user has taken
};

export type CreatePostInput = {
  type: PostType;
  title: string;
  body: string;
  community?: string;
  skills?: string[];
  focus?: string;
  images?: string[];
  question_data?: Record<string, unknown> | null;
  resource_data?: Record<string, unknown> | null;
  achievement_data?: Record<string, unknown> | null;
  help_data?: Record<string, unknown> | null;
  collaboration_data?: Record<string, unknown> | null;
  progress_data?: Record<string, unknown> | null;
  project_data?: Record<string, unknown> | null;
  poll_data?: Record<string, unknown> | null;
  project_id?: string | null;
  project_snapshot?: ProjectSnapshot | null;
  feedback_tags?: string[];
  space_id?: string | null;
  flair?: string | null;
  link_url?: string | null;
};

export type UpdatePostInput = {
  id: string;
  type?: PostType;
  title?: string;
  body?: string;
  community?: string;
  skills?: string[];
  images?: string[];
  flair?: string | null;
  link_url?: string | null;
};

// ============================================================
// Query keys
// ============================================================

export const POSTS_KEY = ["posts"] as const;
export const COMMENTS_KEY = (postId: string) => ["comments", postId] as const;
export const POST_ACTIONS_KEY = (postId: string) => ["post-actions", postId] as const;

// ============================================================
// Hooks
// ============================================================

export function usePosts() {
  return useQuery({
    queryKey: POSTS_KEY,
    queryFn: async () => {
      const { data: rawPosts, error } = await sb
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Table may not exist yet — return empty list instead of crashing
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostWithAuthor[];
        }
        throw error;
      }
      const posts = rawPosts as PostRow[];

      // Fetch author profiles in parallel
      const authorIds = [...new Set(posts.map((p: PostRow) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, category, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      // Fetch action counts for all posts
      const postIds = posts.map((p: PostRow) => p.id);
      const { data: rawActions } = await sb
        .from("post_actions")
        .select("post_id, action, user_id")
        .in("post_id", postIds);
      const actions = (rawActions ?? []) as { post_id: string; action: string; user_id: string }[];

      // Get current user's actions
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const myActions = actions.filter((a) => a.user_id === user?.id);

      // Aggregate stats
      const statsMap = new Map<
        string,
        { likes: number; helpful: number; saves: number; offers: number }
      >();
      for (const a of actions) {
        if (!statsMap.has(a.post_id)) {
          statsMap.set(a.post_id, { likes: 0, helpful: 0, saves: 0, offers: 0 });
        }
        const s = statsMap.get(a.post_id)!;
        if (a.action === "like") s.likes++;
        if (a.action === "helpful") s.helpful++;
        if (a.action === "save") s.saves++;
        if (a.action === "offer") s.offers++;
      }

      return posts.map((p: PostRow): PostWithAuthor => ({
        ...p,
        author: (profileMap.get(p.author_id) as unknown as NonNullable<PostRow["author"]>) ?? {
          display_name: "Unknown",
          handle: "unknown",
          creator_title: "Member",
          category: "General",
          avatar_url: null,
        },
        stats: statsMap.get(p.id) ?? { likes: 0, helpful: 0, saves: 0, offers: 0 },
        myActions: myActions.filter((a) => a.post_id === p.id).map((a) => a.action),
      }));
    },
    staleTime: 30_000,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!VALID_POST_TYPES.has(input.type)) {
        throw new Error(
          `Invalid post type:"${input.type}". Please select a post type from the toolbar.`,
        );
      }

      const { data, error } = await sb
        .from("posts")
        .insert({
          author_id: user.id,
          type: input.type,
          title: input.title,
          body: input.body,
          community: input.community ?? "General",
          skills: input.skills ?? [],
          focus: input.focus ?? null,
          images: input.images ?? [],
          question_data: input.question_data ?? null,
          resource_data: input.resource_data ?? null,
          achievement_data: input.achievement_data ?? null,
          help_data: input.help_data ?? null,
          collaboration_data: input.collaboration_data ?? null,
          progress_data: input.progress_data ?? null,
          project_data: input.project_data ?? null,
          poll_data: input.poll_data ?? null,
          project_id: input.project_id ?? null,
          project_snapshot: input.project_snapshot ?? null,
          feedback_tags: input.feedback_tags ?? [],
          space_id: input.space_id ?? null,
          flair: input.flair ?? null,
          link_url: input.link_url ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePostInput) => {
      const { id, ...updates } = input;
      if (updates.type && !VALID_POST_TYPES.has(updates.type)) {
        throw new Error(
          `Invalid post type:"${updates.type}". Please select a post type from the toolbar.`,
        );
      }
      const { data, error } = await sb.from("posts").update(updates).eq("id", id).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

// ============================================================
// Comments
// ============================================================

export function useComments(postId: string) {
  return useQuery({
    queryKey: COMMENTS_KEY(postId),
    queryFn: async () => {
      const { data: rawComments, error } = await sb
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as CommentRow[];
        }
        throw error;
      }
      const comments = rawComments as {
        id: string;
        post_id: string;
        author_id: string;
        body: string;
        is_best_answer: boolean;
        parent_id: string | null;
        created_at: string;
      }[];

      const authorIds = [...new Set(comments.map((c) => c.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return comments.map((c): CommentRow => ({
        ...c,
        author: (profileMap.get(c.author_id) as unknown as CommentRow["author"]) ?? {
          display_name: "Unknown",
          handle: "unknown",
          creator_title: "Member",
          avatar_url: null,
        },
      }));
    },
    enabled: !!postId,
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; body: string; parentId?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("comments")
        .insert({
          post_id: input.postId,
          author_id: user.id,
          body: input.body,
          parent_id: input.parentId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(variables.postId) });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string }) => {
      const { error } = await sb.from("comments").delete().eq("id", input.commentId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(variables.postId) });
    },
  });
}

export function useUpdateComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string; body: string }) => {
      const { error } = await sb
        .from("comments")
        .update({ body: input.body })
        .eq("id", input.commentId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(variables.postId) });
    },
  });
}

export function useMarkBestAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string; isBest: boolean }) => {
      // First unset any existing best answer for this post
      await sb
        .from("comments")
        .update({ is_best_answer: false })
        .eq("post_id", input.postId)
        .eq("is_best_answer", true);

      // Then set the new one
      const { error } = await sb
        .from("comments")
        .update({ is_best_answer: input.isBest })
        .eq("id", input.commentId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(variables.postId) });
    },
  });
}

// ============================================================
// Post Actions (like, helpful, save, offer)
// ============================================================

export function useTogglePostAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      postId: string;
      action: "like" | "helpful" | "save" | "offer";
      currentUserId: string;
      isActive: boolean;
    }) => {
      if (input.isActive) {
        // Remove action
        const { error } = await sb
          .from("post_actions")
          .delete()
          .eq("post_id", input.postId)
          .eq("user_id", input.currentUserId)
          .eq("action", input.action);

        if (error) throw error;
      } else {
        // Add action
        const { error } = await sb.from("post_actions").insert({
          post_id: input.postId,
          user_id: input.currentUserId,
          action: input.action,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

// ============================================================
// Post reports (flag for space moderators)
// ============================================================

export function useReportPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; reason: string; details?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await sb.from("post_reports").insert({
        post_id: input.postId,
        reporter_id: user.id,
        reason: input.reason,
        details: input.details?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-reports"] });
    },
  });
}

// ============================================================
// Poll Voting
// ============================================================

export type PollData = {
  question: string;
  options: string[];
  votes: { option_index: number; user_id: string }[];
  ends_at: string | null;
};

export function useVotePoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      optionIndex,
      userId,
    }: {
      postId: string;
      optionIndex: number;
      userId: string;
    }) => {
      // Fetch current poll data
      const { data: post, error: fetchErr } = await sb
        .from("posts")
        .select("poll_data")
        .eq("id", postId)
        .single();

      if (fetchErr) throw fetchErr;

      const pollData = (post?.poll_data ?? {
        question: "",
        options: [],
        votes: [],
        ends_at: null,
      }) as PollData;

      // Check not already voted
      const alreadyVoted = pollData.votes?.some((v) => v.user_id === userId);
      if (alreadyVoted) throw new Error("Already voted");

      // Add vote
      const updatedVotes = [
        ...(pollData.votes ?? []),
        { option_index: optionIndex, user_id: userId },
      ];

      const { error } = await sb
        .from("posts")
        .update({ poll_data: { ...pollData, votes: updatedVotes } })
        .eq("id", postId);

      if (error) throw error;

      return { optionIndex, updatedVotes };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}
