import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase;

const FOLLOW_STATUS_KEY = (userId: string) => ["follow-status", userId] as const;
const FOLLOWERS_KEY = (userId: string) => ["followers", userId] as const;
const FOLLOWING_KEY = (userId: string) => ["following", userId] as const;
const FOLLOWING_FEED_KEY = ["following-feed"] as const;

export function useFollowStatus(targetUserId: string) {
  return useQuery({
    queryKey: FOLLOW_STATUS_KEY(targetUserId),
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return { isFollowing: false };

      const { data, error } = await sb
        .from("follows")
        .select("follower_id")
        .eq("follower_id", me.user.id)
        .eq("following_id", targetUserId)
        .maybeSingle();

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return { isFollowing: false };
        }
        throw error;
      }

      return { isFollowing: !!data };
    },
    staleTime: 30_000,
  });
}

export function useFollowers(userId: string) {
  return useQuery({
    queryKey: FOLLOWERS_KEY(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("follows")
        .select("follower_id, created_at")
        .eq("following_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [];
        }
        throw error;
      }

      return data as { follower_id: string; created_at: string }[];
    },
    staleTime: 30_000,
  });
}

export function useFollowing(userId: string) {
  return useQuery({
    queryKey: FOLLOWING_KEY(userId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("follows")
        .select("following_id, created_at")
        .eq("follower_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [];
        }
        throw error;
      }

      return data as { following_id: string; created_at: string }[];
    },
    staleTime: 30_000,
  });
}

export function useFollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("follows").insert({
        follower_id: me.user.id,
        following_id: targetUserId,
      });

      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      qc.invalidateQueries({ queryKey: FOLLOW_STATUS_KEY(targetUserId) });
      qc.invalidateQueries({ queryKey: FOLLOWING_FEED_KEY });
    },
  });
}

export function useUnfollowUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb
        .from("follows")
        .delete()
        .eq("follower_id", me.user.id)
        .eq("following_id", targetUserId);

      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      qc.invalidateQueries({ queryKey: FOLLOW_STATUS_KEY(targetUserId) });
      qc.invalidateQueries({ queryKey: FOLLOWING_FEED_KEY });
    },
  });
}

import type { PostRow, PostWithAuthor } from "@/hooks/use-community";

export function useFollowingFeed() {
  return useQuery({
    queryKey: FOLLOWING_FEED_KEY,
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [] as PostWithAuthor[];

      const { data: followRows, error: followError } = await sb
        .from("follows")
        .select("following_id")
        .eq("follower_id", me.user.id);

      if (followError) {
        if (
          followError.message?.includes("Could not find the table") ||
          followError.code === "42P01"
        ) {
          return [] as PostWithAuthor[];
        }
        throw followError;
      }

      const followedIds = (followRows ?? []).map((r: { following_id: string }) => r.following_id);
      if (followedIds.length === 0) return [] as PostWithAuthor[];

      const { data: rawPosts, error: postsError } = await sb
        .from("posts")
        .select("*")
        .in("author_id", followedIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) {
        if (
          postsError.message?.includes("Could not find the table") ||
          postsError.code === "42P01"
        ) {
          return [] as PostWithAuthor[];
        }
        throw postsError;
      }

      const posts = rawPosts as PostRow[];
      if (posts.length === 0) return [] as PostWithAuthor[];

      const authorIds = [...new Set(posts.map((p) => p.author_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, creator_title, category, avatar_url")
        .in("id", authorIds);

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      const postIds = posts.map((p) => p.id);
      const { data: rawActions } = await sb
        .from("post_actions")
        .select("post_id, action, user_id")
        .in("post_id", postIds);
      const actions = (rawActions ?? []) as { post_id: string; action: string; user_id: string }[];

      const myActions = actions.filter((a) => a.user_id === me.user.id);

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

      return posts.map((p): PostWithAuthor => ({
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
