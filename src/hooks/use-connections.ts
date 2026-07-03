// Central hook for the current user's connections (friend requests).
// Auto-invalidates the dashboard's CURRENT_USER_KEY so activity/badges
// update the moment a connection is sent, accepted, or removed.
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_USER_KEY, useCurrentUser } from "@/hooks/use-current-user";

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type ConnectionWithProfile = ConnectionRow & {
  other: {
    id: string;
    handle: string | null;
    display_name: string | null;
    creator_title: string | null;
    category: string | null;
  } | null;
};

export const CONNECTIONS_KEY = ["connections"] as const;

export function useConnections() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery({
    queryKey: [...CONNECTIONS_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async (): Promise<ConnectionWithProfile[]> => {
      const { data, error } = await supabase
        .from("connections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as ConnectionRow[];
      const otherIds = Array.from(
        new Set(rows.map((r) => (r.requester_id === meId ? r.addressee_id : r.requester_id))),
      );
      if (otherIds.length === 0) return rows.map((r) => ({ ...r, other: null }));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name, creator_title, category")
        .in("id", otherIds);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        other: map.get(r.requester_id === meId ? r.addressee_id : r.requester_id) ?? null,
      }));
    },
    staleTime: 15_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    qc.invalidateQueries({ queryKey: CURRENT_USER_KEY });
  };
}

export function useSendConnection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ addresseeId, meId }: { addresseeId: string; meId: string }) => {
      const { error } = await supabase
        .from("connections")
        .insert({ requester_id: meId, addressee_id: addresseeId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRespondConnection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("connections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteConnection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
