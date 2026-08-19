import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACES_KEY, SPACE_POSTS_KEY } from "@/hooks/community-space-types";
import type { SpaceMemberRole } from "@/hooks/community-space-types";

const sb = supabase;

export const SPACE_MEMBERS_KEY = (spaceId: string) => ["space-members", spaceId] as const;

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

const SPACE_BANS_KEY = (spaceId: string) => ["space-bans", spaceId] as const;

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
        p_reason: input.reason?.trim() || undefined,
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
