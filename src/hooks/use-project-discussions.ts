// Project discussions: threads, replies, and the count of community posts that
// point at a project.
// Re-exported from use-projects.ts, so callers keep importing from there.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DISCUSSIONS_KEY, DISCUSSION_REPLIES_KEY, PROJECT_ACTIVITY_KEY } from "./project-keys";
import type { DiscussionRow, DiscussionReplyRow } from "./use-projects";

const sb = supabase;

// ============================================================
// Discussions
// ============================================================

export function useDiscussions(projectId: string) {
  return useQuery({
    queryKey: DISCUSSIONS_KEY(projectId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("project_discussions")
        .select("*, author:profiles!author_id(display_name, handle, avatar_url)")
        .eq("project_id", projectId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const discussions = (raw ?? []) as (Omit<DiscussionRow, "author" | "reply_count"> & {
        author: {
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      })[];

      const discussionIds = discussions.map((d) => d.id);
      const { data: replyCounts, error: replyCountError } =
        discussionIds.length > 0
          ? await sb.rpc("discussion_reply_counts", { p_discussion_ids: discussionIds })
          : { data: [], error: null };
      if (replyCountError) throw replyCountError;

      const countMap = new Map<string, number>();
      for (const r of replyCounts ?? []) {
        countMap.set(r.discussion_id, Number(r.reply_count));
      }

      return discussions.map((d): DiscussionRow => ({
        id: d.id,
        project_id: d.project_id,
        author_id: d.author_id,
        title: d.title,
        body: d.body,
        category: d.category,
        is_pinned: d.is_pinned,
        community_post_id: d.community_post_id,
        created_at: d.created_at,
        updated_at: d.updated_at,
        author: d.author ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
        reply_count: countMap.get(d.id) ?? 0,
      }));
    },
    enabled: !!projectId,
  });
}

// ============================================================
// Community posts
// ============================================================

export function useProjectCommunityPostCount(projectId: string) {
  return useQuery({
    // Distinct from PROJECT_COMMUNITY_POSTS_KEY — this query caches a count
    // (number), while the community-posts component caches an array of posts
    // under the shared key. Sharing a key between two data shapes lets one
    // poison the other's cache (posts.map crashes on a count).
    queryKey: ["project-community-post-count", projectId],
    queryFn: async () => {
      const { count, error } = await sb
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);

      if (error) {
        if (error.code === "42P01") return 0;
        throw error;
      }
      return count ?? 0;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useCreateDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      body: string;
      category?: DiscussionRow["category"];
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("project_discussions")
        .insert({
          project_id: input.projectId,
          author_id: user.id,
          title: input.title,
          body: input.body,
          category: input.category ?? "general",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: DISCUSSIONS_KEY(variables.projectId) });
      qc.invalidateQueries({ queryKey: PROJECT_ACTIVITY_KEY(variables.projectId) });
    },
  });
}

export function useDeleteDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await sb.from("project_discussions").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: DISCUSSIONS_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Discussion Replies
// ============================================================

export function useDiscussionReplies(discussionId: string) {
  return useQuery({
    queryKey: DISCUSSION_REPLIES_KEY(discussionId),
    queryFn: async () => {
      const { data: raw, error } = await sb
        .from("discussion_replies")
        .select("*, author:profiles!author_id(display_name, handle, avatar_url)")
        .eq("discussion_id", discussionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const replies = (raw ?? []) as (Omit<DiscussionReplyRow, "author"> & {
        author: {
          display_name: string | null;
          handle: string | null;
          avatar_url: string | null;
        } | null;
      })[];

      return replies.map((r): DiscussionReplyRow => ({
        id: r.id,
        discussion_id: r.discussion_id,
        author_id: r.author_id,
        body: r.body,
        created_at: r.created_at,
        author: r.author ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    enabled: !!discussionId,
  });
}

export function useCreateDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { discussionId: string; body: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await sb
        .from("discussion_replies")
        .insert({
          discussion_id: input.discussionId,
          author_id: user.id,
          body: input.body,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion-replies"] });
    },
  });
}
