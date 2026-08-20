// Central hook for the current user's connections (connections / friend requests).
// Includes optimistic updates and realtime sync so the dashboard reflects
// changes the instant they happen — for the current user and the other side.
// Uses a module-level singleton channel (same pattern as useNotificationRealtime)
// so multiple components calling useConnections() don't create duplicate subscriptions.
import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_USER_KEY, useCurrentUser } from "@/hooks/use-current-user";

// Module-level singleton for the Realtime channel — shared across all callers.
let activeChannel: ReturnType<typeof supabase.channel> | null = null;
let activeUserId: string | null = null;
let refCount = 0;

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
    .select(
      `*, requester:profiles!requester_id(id, display_name, handle, creator_title, category, avatar_url), addressee:profiles!addressee_id(id, display_name, handle, creator_title, category, avatar_url)`,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as (ConnectionRow & {
    requester: {
      id: string;
      display_name: string | null;
      handle: string | null;
      creator_title: string | null;
      category: string | null;
      avatar_url: string | null;
    } | null;
    addressee: {
      id: string;
      display_name: string | null;
      handle: string | null;
      creator_title: string | null;
      category: string | null;
      avatar_url: string | null;
    } | null;
  })[];
  return rows.map((r) => ({
    id: r.id,
    requester_id: r.requester_id,
    addressee_id: r.addressee_id,
    status: r.status,
    intro_message: r.intro_message,
    created_at: r.created_at,
    updated_at: r.updated_at,
    other: r.requester_id === meId ? (r.addressee ?? null) : (r.requester ?? null),
  }));
}

function useConnectionsRealtime() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  useEffect(() => {
    if (!meId) return;

    // If a channel exists for a DIFFERENT user, tear it down
    if (activeChannel && activeUserId !== meId) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
      activeUserId = null;
      refCount = 0;
    }

    refCount++;

    // Only create + subscribe once per user
    if (!activeChannel) {
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
      activeChannel = channel;
      activeUserId = meId;
    }

    return () => {
      refCount--;
      if (refCount <= 0 && activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
        activeUserId = null;
        refCount = 0;
      }
    };
  }, [meId, qc]);
}

export function useConnections() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  // Singleton realtime channel — shared across all callers.
  useConnectionsRealtime();

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
      // A declined row can never go back to 'pending' (the addressee-only UPDATE
      // policy + status check forbid it), so clear a stale declined request from
      // this pair first, then send a fresh one.
      await supabase
        .from("connections")
        .delete()
        .eq("requester_id", meId)
        .eq("addressee_id", addresseeId)
        .eq("status", "declined");
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
      qc.setQueryData<ConnectionWithProfile[]>(key, (old) => [
        optimistic,
        // Drop any stale row for this pair (e.g. a declined request being
        // re-sent) so it doesn't linger alongside the optimistic pending row.
        ...(old ?? []).filter(
          (c) => !(c.requester_id === vars.meId && c.addressee_id === vars.addresseeId),
        ),
      ]);
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
