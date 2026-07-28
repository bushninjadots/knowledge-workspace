import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type SpaceMemberRole = "owner" | "moderator" | "member";

export type CommunitySpace = {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
  my_role?: SpaceMemberRole | null;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: SpaceMemberRole;
  joined_at: string;
  profile?: {
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
};

const SPACES_KEY = ["community-spaces"] as const;
const SPACE_KEY = (slug: string) => ["community-space", slug] as const;
const SPACE_MEMBERS_KEY = (spaceId: string) => ["space-members", spaceId] as const;
const SPACE_POSTS_KEY = (spaceId: string) => ["space-posts", spaceId] as const;

// ============================================================
// Queries
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

      const spaceIds = (spaces ?? []).map((s: CommunitySpace) => s.id);
      const { data: memberCounts } = await sb
        .from("community_space_members")
        .select("space_id")
        .in("space_id", spaceIds);

      const countMap = new Map<string, number>();
      for (const row of memberCounts ?? []) {
        countMap.set(row.space_id, (countMap.get(row.space_id) ?? 0) + 1);
      }

      const myMembershipMap = new Map<string, SpaceMemberRole>();
      if (me.user) {
        const { data: myMemberships } = await sb
          .from("community_space_members")
          .select("space_id, role")
          .eq("user_id", me.user.id)
          .in("space_id", spaceIds);

        for (const row of myMemberships ?? []) {
          myMembershipMap.set(row.space_id, row.role as SpaceMemberRole);
        }
      }

      return (spaces ?? []).map((s: CommunitySpace): CommunitySpace => ({
        ...s,
        member_count: countMap.get(s.id) ?? 0,
        is_member: myMembershipMap.has(s.id),
        my_role: myMembershipMap.get(s.id) ?? null,
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

      const { count } = await sb
        .from("community_space_members")
        .select("space_id", { count: "exact", head: true })
        .eq("space_id", space.id);

      let myRole: SpaceMemberRole | null = null;
      if (me.user) {
        const { data: membership } = await sb
          .from("community_space_members")
          .select("role")
          .eq("space_id", space.id)
          .eq("user_id", me.user.id)
          .maybeSingle();
        myRole = (membership?.role as SpaceMemberRole) ?? null;
      }

      return {
        ...space,
        member_count: count ?? 0,
        is_member: !!myRole,
        my_role: myRole,
      } as CommunitySpace;
    },
    staleTime: 30_000,
    enabled: !!slug,
  });
}

// ============================================================
// CRUD Mutations
// ============================================================

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const slug = slugify(input.name);

      const { data: existing } = await sb
        .from("community_spaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) throw new Error("A space with a similar name already exists");

      const { data: space, error } = await sb
        .from("community_spaces")
        .insert({
          name: input.name,
          slug,
          description: input.description,
          created_by: me.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await sb.from("community_space_members").insert({
        space_id: space.id,
        user_id: me.user.id,
        role: "owner",
      });

      return space as CommunitySpace;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string }) => {
      const { id, ...updates } = input;
      const { error } = await sb
        .from("community_spaces")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { error } = await sb.from("community_spaces").delete().eq("id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
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

      if (error) throw error;
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
// Member Management
// ============================================================

export function useSpaceMembers(spaceId: string) {
  return useQuery({
    queryKey: SPACE_MEMBERS_KEY(spaceId),
    queryFn: async () => {
      const { data: members, error } = await sb
        .from("community_space_members")
        .select("space_id, user_id, role, joined_at")
        .eq("space_id", spaceId)
        .order("joined_at", { ascending: true });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as SpaceMember[];
        }
        throw error;
      }

      const userIds = (members ?? []).map((m: SpaceMember) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return (members ?? []).map((m: SpaceMember): SpaceMember => ({
        ...m,
        profile: (profileMap.get(m.user_id) as SpaceMember["profile"]) ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    staleTime: 30_000,
    enabled: !!spaceId,
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string; role: SpaceMemberRole }) => {
      const { error } = await sb
        .from("community_space_members")
        .update({ role: input.role })
        .eq("space_id", input.spaceId)
        .eq("user_id", input.userId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string }) => {
      const { error } = await sb
        .from("community_space_members")
        .delete()
        .eq("space_id", input.spaceId)
        .eq("user_id", input.userId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
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
// Space Posts
// ============================================================

import type { PostRow, PostWithAuthor } from "@/hooks/use-community";

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
  return useQuery({
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

      return allPosts.map((p): PostWithAuthor & { is_shared?: boolean } => ({
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
        is_shared: sharedIdSet.has(p.id),
      }));
    },
    staleTime: 30_000,
    enabled: !!spaceId,
  });
}
