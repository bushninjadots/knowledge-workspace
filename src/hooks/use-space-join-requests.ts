import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACES_KEY } from "@/hooks/community-space-types";
import type { JoinRequestRow } from "@/hooks/community-space-types";
import { SPACE_MEMBERS_KEY } from "@/hooks/use-space-members";

const sb = supabase;

const SPACE_JOIN_REQUESTS_KEY = (spaceId: string) => ["space-join-requests", spaceId] as const;

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
