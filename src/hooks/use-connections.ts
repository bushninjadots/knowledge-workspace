// Central hook for the current user's connections (tethrs / friend requests).
// Includes optimistic updates and realtime sync so the dashboard reflects
// changes the instant they happen — for the current user and the other side.
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_USER_KEY, useCurrentUser } from "@/hooks/use-current-user";

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  intro_message: string | null;
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
    avatar_url: string | null;
  } | null;
};

export const CONNECTIONS_KEY = ["connections"] as const;

async function fetchConnections(meId: string): Promise<ConnectionWithProfile[]> {
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
    .select("id, handle, display_name, creator_title, category, avatar_url")
    .in("id", otherIds);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    other: map.get(r.requester_id === meId ? r.addressee_id : r.requester_id) ?? null,
  }));
}

export function useConnections() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Realtime: any change to connections involving me → refetch.
  useEffect(() => {
    if (!meId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`connections:${meId}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => {
        qc.invalidateQueries({ queryKey: CONNECTIONS_KEY });
        qc.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
          filter: `profile_id=eq.${meId}`,
        },
        () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
      );
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [meId, qc]);

  return useQuery({
    queryKey: [...CONNECTIONS_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: () => fetchConnections(meId as string),
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

function connectionsQueryKey(meId: string | null) {
  return [...CONNECTIONS_KEY, meId ?? "anon"] as const;
}

export function useSendConnection() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useMutation({
    mutationFn: async ({
      addresseeId,
      meId,
      introMessage,
    }: {
      addresseeId: string;
      meId: string;
      introMessage?: string | null;
    }) => {
      const { error } = await supabase.from("connections").insert({
        requester_id: meId,
        addressee_id: addresseeId,
        intro_message: introMessage?.trim() ? introMessage.trim() : null,
      });
      if (error) throw error;
    },
    onMutate: async (vars) => {
      const key = connectionsQueryKey(meId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ConnectionWithProfile[]>(key);
      const optimistic: ConnectionWithProfile = {
        id: `optimistic-${vars.addresseeId}`,
        requester_id: vars.meId,
        addressee_id: vars.addresseeId,
        status: "pending",
        intro_message: vars.introMessage?.trim() ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other: null,
      };
      qc.setQueryData<ConnectionWithProfile[]>(key, (old) => [optimistic, ...(old ?? [])]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(connectionsQueryKey(meId), ctx.previous);
    },
    onSettled: invalidate,
  });
}

export function useRespondConnection() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("connections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      const key = connectionsQueryKey(meId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ConnectionWithProfile[]>(key);
      qc.setQueryData<ConnectionWithProfile[]>(key, (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(connectionsQueryKey(meId), ctx.previous);
    },
    onSettled: invalidate,
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("connections").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const key = connectionsQueryKey(meId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ConnectionWithProfile[]>(key);
      qc.setQueryData<ConnectionWithProfile[]>(key, (old) =>
        (old ?? []).filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(connectionsQueryKey(meId), ctx.previous);
    },
    onSettled: invalidate,
  });
}
