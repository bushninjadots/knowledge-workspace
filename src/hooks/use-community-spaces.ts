import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostRow, PostWithAuthor } from "@/hooks/use-community";

import {
  SPACES_KEY,
  SPACE_KEY,
  SPACE_POSTS_KEY,
  type CommunitySpace,
  type SpaceMemberRole,
} from "@/hooks/community-space-types";

export {
  SPACES_KEY,
  SPACE_KEY,
  SPACE_POSTS_KEY,
  type CommunitySpace,
  type SpaceMemberRole,
  type SpaceVisibility,
  type SpaceJoinType,
  type JoinRequestRow,
  type PostReportRow,
  type ModerationLogRow,
} from "@/hooks/community-space-types";

export {
  SPACE_MEMBERS_KEY,
  type SpaceMember,
  type SpaceBan,
  useSpaceMembers,
  useUpdateMemberRole,
  useRemoveMember,
  useSpaceBans,
  useBanMember,
  useUnbanMember,
} from "@/hooks/use-space-members";

export { useSpacePostsRealtime } from "@/hooks/use-space-chat";

export {
  useSpaceReportedPostCounts,
  usePostReports,
  useSpaceReportHistory,
  useSpacePostReports,
  useUpdateReportStatus,
  useModerationLog,
} from "@/hooks/use-space-reports";

export {
  useSpaceJoinRequests,
  useRequestToJoinSpace,
  useCancelJoinRequest,
  useApproveJoinRequest,
  useRejectJoinRequest,
} from "@/hooks/use-space-join-requests";

export { useUpdateSpace, useDeleteSpace, useCreateSpace } from "@/hooks/use-space-settings";

const sb = supabase;

// ============================================================
// Core Space Queries
// ============================================================

export function useCommunitySpaces() {
  return useQuery({
    queryKey: SPACES_KEY,
    queryFn: async () => {
      const { data: spaces, error } = await sb
        .from("community_spaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as CommunitySpace[];
        }
        throw error;
      }

      const { data: me } = await supabase.auth.getUser();

      const spaceIds = ((spaces ?? []) as CommunitySpace[]).map((s) => s.id);
      // Member counts come from a SECURITY DEFINER aggregate — the raw table's
      // SELECT RLS only shows members of spaces you've joined, which made the
      // count on unjoined spaces read 0.
      const { data: memberCounts, error: countError } = await sb.rpc(
        "community_space_member_counts",
      );
      if (countError) throw countError;

      const countMap = new Map<string, number>();
      for (const row of memberCounts ?? []) {
        countMap.set(row.space_id, row.member_count);
      }

      const myMembershipMap = new Map<string, SpaceMemberRole>();
      const myPendingSet = new Set<string>();
      if (me.user) {
        const [myMemberships, myRequests] = await Promise.all([
          sb
            .from("community_space_members")
            .select("space_id, role")
            .eq("user_id", me.user.id)
            .in("space_id", spaceIds),
          sb
            .from("community_space_join_requests")
            .select("space_id")
            .eq("user_id", me.user.id)
            .in("space_id", spaceIds),
        ]);

        for (const row of myMemberships.data ?? []) {
          myMembershipMap.set(row.space_id, row.role as SpaceMemberRole);
        }
        for (const row of myRequests.data ?? []) {
          myPendingSet.add(row.space_id);
        }
      }

      return ((spaces ?? []) as CommunitySpace[]).map((s): CommunitySpace => ({
        ...s,
        member_count: countMap.get(s.id) ?? 0,
        is_member: myMembershipMap.has(s.id),
        my_role: myMembershipMap.get(s.id) ?? null,
        has_pending_request: myPendingSet.has(s.id),
      }));
    },
    staleTime: 30_000,
  });
}

export function useCommunitySpace(slug: string) {
  return useQuery({
    queryKey: SPACE_KEY(slug),
    queryFn: async () => {
      const { data: space, error } = await sb
        .from("community_spaces")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error || !space) return null as CommunitySpace | null;

      const { data: me } = await supabase.auth.getUser();

      const { data: counts } = await sb.rpc("community_space_member_counts");
      const count =
        ((counts ?? []) as { space_id: string; member_count: number }[]).find(
          (c) => c.space_id === space.id,
        )?.member_count ?? 0;

      let myRole: SpaceMemberRole | null = null;
      let hasPendingRequest = false;
      if (me.user) {
        const [membership, myRequest] = await Promise.all([
          sb
            .from("community_space_members")
            .select("role")
            .eq("space_id", space.id)
            .eq("user_id", me.user.id)
            .maybeSingle(),
          sb
            .from("community_space_join_requests")
            .select("space_id")
            .eq("space_id", space.id)
            .eq("user_id", me.user.id)
            .maybeSingle(),
        ]);
        myRole = (membership.data?.role as SpaceMemberRole) ?? null;
        hasPendingRequest = !!myRequest.data;
      }

      return {
        ...space,
        member_count: count ?? 0,
        is_member: !!myRole,
        my_role: myRole,
        has_pending_request: hasPendingRequest,
      } as CommunitySpace;
    },
    staleTime: 30_000,
    enabled: !!slug,
  });
}

// ============================================================
// Join / Leave
// ============================================================

export function useJoinSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("community_space_members").insert({
        space_id: spaceId,
        user_id: me.user.id,
        role: "member",
      });

      if (error) {
        // If already a member (duplicate key), treat as success
        if (error.code === "23505") return;
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useLeaveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("community_space_members")
        .delete()
        .eq("space_id", spaceId)
        .eq("user_id", me.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

// ============================================================
// Pin / Unpin
// ============================================================

export function usePinPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; spaceId: string; isPinned: boolean }) => {
      const { error } = await sb
        .from("posts")
        .update({ is_pinned: input.isPinned })
        .eq("id", input.postId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(variables.spaceId) });
    },
  });
}

// ============================================================
// Share / Unshare
// ============================================================

export function useSharePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; spaceId: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("post_space_shares").insert({
        post_id: input.postId,
        space_id: input.spaceId,
        shared_by: me.user.id,
      });

      if (error) throw error;
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(variables.spaceId) });
    },
  });
}

export function useUnsharePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; spaceId: string }) => {
      const { error } = await sb
        .from("post_space_shares")
        .delete()
        .eq("post_id", input.postId)
        .eq("space_id", input.spaceId);

      if (error) throw error;
    },
    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(variables.spaceId) });
    },
  });
}

// ============================================================
// Space Posts (includes shared posts)
// ============================================================

export function useCommunitySpacePosts(spaceId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: SPACE_POSTS_KEY(spaceId),
    queryFn: async () => {
      // Fetch native posts for this space
      const { data: rawNative, error: nativeErr } = await sb
        .from("posts")
        .select("*")
        .eq("space_id", spaceId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (nativeErr) {
        if (nativeErr.message?.includes("Could not find the table") || nativeErr.code === "42P01") {
          return [] as PostWithAuthor[];
        }
        throw nativeErr;
      }

      // Fetch shared posts for this space
      const { data: rawShares } = await sb
        .from("post_space_shares")
        .select("post_id")
        .eq("space_id", spaceId);

      const sharedPostIds = (rawShares ?? []).map((s: { post_id: string }) => s.post_id);

      let sharedPosts: PostRow[] = [];
      if (sharedPostIds.length > 0) {
        const { data: rawShared } = await sb
          .from("posts")
          .select("*")
          .in("id", sharedPostIds)
          .order("created_at", { ascending: false })
          .limit(50);
        sharedPosts = (rawShared ?? []) as PostRow[];
      }

      // Merge and deduplicate
      const nativePosts = (rawNative ?? []) as PostRow[];
      const seenIds = new Set(nativePosts.map((p) => p.id));
      const allPosts = [
        ...nativePosts,
        ...sharedPosts.filter((p) => {
          if (seenIds.has(p.id)) return false;
          seenIds.add(p.id);
          return true;
        }),
      ];

      // Sort by pinned first, then by created_at
      allPosts.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      if (allPosts.length === 0) return [] as PostWithAuthor[];

      const authorIds = [...new Set(allPosts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, category, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      const postIds = allPosts.map((p) => p.id);
      const { data: rawActions } = await sb
        .from("post_actions")
        .select("post_id, action, user_id")
        .in("post_id", postIds);
      const actions = (rawActions ?? []) as { post_id: string; action: string; user_id: string }[];

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const myActions = actions.filter((a) => a.user_id === user?.id);

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

      // Build shared-post-id set for the current space
      const sharedIdSet = new Set(sharedPostIds);

      const commentCountMap = new Map<string, number>();
      if (postIds.length > 0) {
        const { data: rawCommentRows } = await sb
          .from("comments")
          .select("post_id")
          .in("post_id", postIds);
        for (const c of (rawCommentRows ?? []) as { post_id: string }[]) {
          commentCountMap.set(c.post_id, (commentCountMap.get(c.post_id) ?? 0) + 1);
        }
      }

      return allPosts.map((p): PostWithAuthor & { is_shared?: boolean } => ({
        ...p,
        author: (profileMap.get(p.author_id) as unknown as NonNullable<PostRow["author"]>) ?? {
          display_name: "Unknown",
          handle: "unknown",
          creator_title: "Member",
          category: "General",
          avatar_url: null,
        },
        stats: {
          ...(statsMap.get(p.id) ?? { likes: 0, helpful: 0, saves: 0, offers: 0 }),
          comment_count: commentCountMap.get(p.id) ?? 0,
        },
        myActions: myActions.filter((a) => a.post_id === p.id).map((a) => a.action),
        is_shared: sharedIdSet.has(p.id),
      }));
    },
    staleTime: 30_000,
    enabled: !!spaceId,
  });

  // Stream new chat messages (and post edits/removals) into the space feed in
  // real time. The channel is scoped to this space via the postgres_changes
  // filter, so members see each other's messages without refreshing.
  useEffect(() => {
    if (!spaceId) return;
    const channel = sb
      .channel(`space-posts-${spaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `space_id=eq.${spaceId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(spaceId) });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [spaceId, qc]);

  return query;
}
