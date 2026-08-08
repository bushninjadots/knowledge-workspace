import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

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

const SPACE_JOIN_REQUESTS_KEY = (spaceId: string) => ["space-join-requests", spaceId] as const;

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

export type SpaceBan = {
  id: string;
  space_id: string;
  user_id: string;
  banned_by: string | null;
  reason: string | null;
  created_at: string;
  lifted_at: string | null;
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

      return (spaces ?? []).map((s: CommunitySpace): CommunitySpace => ({
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

      const { count } = await sb
        .from("community_space_members")
        .select("space_id", { count: "exact", head: true })
        .eq("space_id", space.id);

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
    mutationFn: async (input: {
      name: string;
      description: string;
      join_type?: SpaceJoinType;
      rules?: string[];
    }) => {
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
          join_type: input.join_type ?? "auto",
          rules: input.rules ?? [],
          report_auto_dim_threshold: 3,
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
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string;
      visibility?: SpaceVisibility;
      join_type?: SpaceJoinType;
      rules?: string[];
      report_auto_dim_threshold?: number;
    }) => {
      const { id, ...updates } = input;
      const { error } = await sb
        .from("community_spaces")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
      qc.invalidateQueries({ queryKey: ["community-space"] });
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

// ============================================================
// Join requests (review-type spaces)
// ============================================================

export function useSpaceJoinRequests(spaceId: string) {
  return useQuery({
    queryKey: SPACE_JOIN_REQUESTS_KEY(spaceId),
    queryFn: async () => {
      const { data: requests, error } = await sb
        .from("community_space_join_requests")
        .select("space_id, user_id, note, created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true });

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as JoinRequestRow[];
        }
        throw error;
      }

      const userIds = (requests ?? []).map((r: JoinRequestRow) => r.user_id);
      const { data: profiles } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", userIds)
          : { data: [] };

      const profileMap = new Map<string, Record<string, unknown>>(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return (requests ?? []).map((r: JoinRequestRow): JoinRequestRow => ({
        ...r,
        profile: (profileMap.get(r.user_id) as JoinRequestRow["profile"]) ?? {
          display_name: "Unknown",
          handle: "unknown",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useRequestToJoinSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; note?: string }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const { error } = await sb.from("community_space_join_requests").insert({
        space_id: input.spaceId,
        user_id: me.user.id,
        note: input.note?.trim() || null,
      });
      if (error) {
        if (error.code === "23505") return; // already requested
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");
      const { error } = await sb
        .from("community_space_join_requests")
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

export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string }) => {
      const { error } = await sb.rpc("approve_space_join_request", {
        p_space_id: input.spaceId,
        p_user_id: input.userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_JOIN_REQUESTS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string }) => {
      const { error } = await sb.rpc("reject_space_join_request", {
        p_space_id: input.spaceId,
        p_user_id: input.userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_JOIN_REQUESTS_KEY(variables.spaceId) });
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
// Post reports (flag for moderators)
// ============================================================

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

const POST_REPORTS_KEY = ["post-reports"] as const;
const SPACE_POST_REPORTS_KEY = (spaceId: string) => ["space-post-reports", spaceId] as const;
const MODERATION_LOG_KEY = (spaceId: string) => ["moderation-log", spaceId] as const;
const SPACE_REPORTED_POST_IDS_KEY = (spaceId: string) =>
  ["space-reported-post-ids", spaceId] as const;

/**
 * Post id → number of open reports, in a space — used by moderators to badge
 * reported posts directly in the space feed and to auto-dimm posts with many
 * reports. RLS scopes this to reports the current user can see (their own, or
 * any report in a space they moderate).
 */
export function useSpaceReportedPostCounts(spaceId: string) {
  return useQuery({
    queryKey: SPACE_REPORTED_POST_IDS_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select("post_id")
        .eq("status", "open")
        .limit(1000);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return new Map<string, number>();
        }
        throw error;
      }

      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        if (!r.post_id) continue;
        counts.set(r.post_id as string, (counts.get(r.post_id as string) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function usePostReports() {
  return useQuery({
    queryKey: POST_REPORTS_KEY,
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const [{ data: reporters }, { data: posts }] = await Promise.all([
        reporterIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("posts").select("id, title, space_id").in("id", postIds)
          : { data: [] },
      ]);

      const reporterMap = new Map(
        (reporters ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const postMap = new Map(
        (posts ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return reports.map((r): PostReportRow => ({
        ...r,
        post: r.post_id
          ? ((postMap.get(r.post_id) as PostReportRow["post"]) ?? {
              title: null,
              space_id: null,
              body: null,
              author_id: null,
            })
          : {
              title: r.post_title_snapshot ?? null,
              space_id: null,
              body: null,
              author_id: null,
            },
        reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
          display_name: "Unknown",
          handle: "user",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
  });
}

/**
 * Full report history for a space (open + resolved + dismissed) — powers the
 * moderation reports inbox. Moderators can see every status; the resolved/
 * dismissed rows carry the moderator's note and timestamp.
 */
export function useSpaceReportHistory(spaceId: string) {
  return useQuery({
    queryKey: ["space-report-history", spaceId] as const,
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, space_id_snapshot, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
      const [postsRes, reportersRes] = await Promise.all([
        postIds.length > 0
          ? supabase.from("posts").select("id, title, space_id, body, author_id").in("id", postIds)
          : { data: [] },
        reporterIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] },
      ]);
      const postAuthorIds = [
        ...new Set((postsRes.data ?? []).map((p) => p.author_id).filter(Boolean)),
      ] as string[];
      const { data: authorsData } =
        postAuthorIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle")
              .in("id", postAuthorIds)
          : { data: [] };
      const authorMap = new Map(
        (authorsData ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const postMap = new Map(
        (postsRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const reporterMap = new Map(
        (reportersRes.data ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return reports
        .filter((r) => {
          if (r.post_id != null) return postMap.get(r.post_id)?.space_id === spaceId;
          // Post removed — use the snapshot taken when it was deleted.
          return r.space_id_snapshot === spaceId;
        })
        .map((r): PostReportRow => {
          const postRow = r.post_id ? (postMap.get(r.post_id) as PostReportRow["post"]) : null;
          return {
            ...r,
            post: r.post_id
              ? (postRow ?? {
                  title: r.post_title_snapshot ?? null,
                  space_id: null,
                  body: null,
                  author_id: null,
                })
              : {
                  title: r.post_title_snapshot ?? null,
                  space_id: null,
                  body: null,
                  author_id: null,
                },
            post_author: postRow?.author_id
              ? ((authorMap.get(postRow.author_id) as PostReportRow["post_author"]) ?? {
                  display_name: "Unknown",
                  handle: "user",
                })
              : undefined,
            reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
              display_name: "Unknown",
              handle: "user",
              avatar_url: null,
            },
          };
        });
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useSpacePostReports(spaceId: string) {
  return useQuery({
    queryKey: SPACE_POST_REPORTS_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("post_reports")
        .select(
          "id, post_id, reporter_id, reason, details, status, moderator_note, resolved_at, post_title_snapshot, created_at",
        )
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as PostReportRow[];
        }
        throw error;
      }

      const reports = (data ?? []) as PostReportRow[];
      const postIds = [
        ...new Set(reports.map((r) => r.post_id).filter((id): id is string => !!id)),
      ];
      const { data: posts } = await supabase
        .from("posts")
        .select("id, title, space_id")
        .in("id", postIds);
      const postMap = new Map(
        (posts ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );
      const inSpace = reports.filter(
        (r) => r.post_id != null && postMap.get(r.post_id)?.space_id === spaceId,
      );

      const reporterIds = [...new Set(inSpace.map((r) => r.reporter_id))];
      const { data: reporters } =
        reporterIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", reporterIds)
          : { data: [] };
      const reporterMap = new Map(
        (reporters ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return inSpace.map((r): PostReportRow => ({
        ...r,
        post: r.post_id
          ? ((postMap.get(r.post_id) as PostReportRow["post"]) ?? {
              title: null,
              space_id: null,
              body: null,
              author_id: null,
            })
          : {
              title: r.post_title_snapshot ?? null,
              space_id: null,
              body: null,
              author_id: null,
            },
        reporter: (reporterMap.get(r.reporter_id) as PostReportRow["reporter"]) ?? {
          display_name: "Unknown",
          handle: "user",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      reportId: string;
      status: "resolved" | "dismissed";
      note?: string;
    }) => {
      const { error } = await sb
        .from("post_reports")
        .update({
          status: input.status,
          moderator_note: input.note?.trim() || null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POST_REPORTS_KEY });
      qc.invalidateQueries({ queryKey: ["space-post-reports"] });
      qc.invalidateQueries({ queryKey: ["space-reported-post-ids"] });
    },
  });
}

// ============================================================
// Moderation log
// ============================================================

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

// ============================================================
// Space bans
// ============================================================

const SPACE_BANS_KEY = (spaceId: string) => ["space-bans", spaceId] as const;

/** Active bans in a space — powers the banned-members list in settings. */
export function useSpaceBans(spaceId: string) {
  return useQuery({
    queryKey: SPACE_BANS_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("space_bans")
        .select("id, space_id, user_id, banned_by, reason, created_at, lifted_at")
        .eq("space_id", spaceId)
        .is("lifted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as SpaceBan[];
        }
        throw error;
      }

      const rows = (data ?? []) as SpaceBan[];
      const userIds = rows.map((r) => r.user_id);
      const { data: profiles } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, display_name, handle, avatar_url")
              .in("id", userIds)
          : { data: [] };
      const profileMap = new Map(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return rows.map((r): SpaceBan => ({
        ...r,
        profile: (profileMap.get(r.user_id) as SpaceBan["profile"]) ?? {
          display_name: "Unknown",
          handle: "user",
          avatar_url: null,
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
  });
}

export function useBanMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string; reason?: string }) => {
      const { error } = await sb.rpc("ban_space_member", {
        p_space_id: input.spaceId,
        p_user_id: input.userId,
        p_reason: input.reason?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_BANS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACE_MEMBERS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
      qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(variables.spaceId) });
    },
  });
}

export function useUnbanMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spaceId: string; userId: string }) => {
      const { error } = await sb.rpc("unban_space_member", {
        p_space_id: input.spaceId,
        p_user_id: input.userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: SPACE_BANS_KEY(variables.spaceId) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useModerationLog(spaceId: string) {
  return useQuery({
    queryKey: MODERATION_LOG_KEY(spaceId),
    queryFn: async () => {
      const { data, error } = await sb
        .from("moderation_log")
        .select("id, space_id, post_id, post_title, actor_id, action, created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.message?.includes("Could not find the table") || error.code === "42P01") {
          return [] as ModerationLogRow[];
        }
        throw error;
      }

      const rows = (data ?? []) as ModerationLogRow[];
      const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
      const { data: actors } =
        actorIds.length > 0
          ? await supabase.from("profiles").select("id, display_name, handle").in("id", actorIds)
          : { data: [] };
      const actorMap = new Map(
        (actors ?? []).map((p: Record<string, unknown>) => [p.id as string, p]),
      );

      return rows.map((r): ModerationLogRow => ({
        ...r,
        actor: (actorMap.get(r.actor_id ?? "") as ModerationLogRow["actor"]) ?? {
          display_name: "Unknown",
          handle: "user",
        },
      }));
    },
    staleTime: 15_000,
    enabled: !!spaceId,
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
