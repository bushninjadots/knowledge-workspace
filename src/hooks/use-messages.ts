// Direct-message hooks: paginated thread, typing broadcast, read receipts,
// and per-connection unread counts. Realtime keeps everything in sync.
import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export type MessageRow = {
  id: string;
  connection_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export const MESSAGES_KEY = ["messages"] as const;
export const UNREAD_KEY = ["messages-unread"] as const;
export const LAST_MESSAGES_KEY = ["messages-last"] as const;
export const PAGE_SIZE = 25;

// ---------- Paginated thread ----------
export function useMessages(connectionId: string | null) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const key = [...MESSAGES_KEY, connectionId ?? "none"] as const;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Realtime → refetch first page (newest).
  // NOTE: deps only include primitives (connectionId, qc) — never the `key`
  // array above, which is a new reference every render. Including it here
  // used to tear down and resubscribe the channel on every render, which
  // hammers Supabase Realtime with duplicate subscriptions on the same topic
  // and can crash the whole route.
  useEffect(() => {
    if (!connectionId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channelKey = [...MESSAGES_KEY, connectionId] as const;
    const channel = supabase.channel(`messages:${connectionId}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `connection_id=eq.${connectionId}`,
      },
      () => {
        qc.invalidateQueries({ queryKey: channelKey });
        qc.invalidateQueries({ queryKey: UNREAD_KEY });
      },
    );
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [connectionId, qc]);

  const query = useInfiniteQuery({
    queryKey: key,
    enabled: !!connectionId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<MessageRow[]> => {
      let q = supabase
        .from("messages")
        .select("*")
        .eq("connection_id", connectionId as string)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) q = q.lt("created_at", pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
    getNextPageParam: (last) =>
      last.length === PAGE_SIZE ? last[last.length - 1].created_at : undefined,
    staleTime: 10_000,
  });

  // Flatten newest→oldest pages into chronological ascending order.
  const messages = (query.data?.pages ?? [])
    .flat()
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Mark unread messages (from the other side) as read.
  // Use a ref to track the last processed message IDs to avoid re-firing on every render.
  const lastReadIdsRef = useRef<string>("");

  useEffect(() => {
    if (!connectionId || !meId || messages.length === 0) return;
    const unreadIds = messages
      .filter((m) => m.sender_id !== meId && !m.read_at && !m.id.startsWith("optimistic-"))
      .map((m) => m.id);
    if (unreadIds.length === 0) return;

    const idsKey = unreadIds.join(",");
    if (idsKey === lastReadIdsRef.current) return;
    lastReadIdsRef.current = idsKey;

    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(() => qc.invalidateQueries({ queryKey: UNREAD_KEY }));
  }, [connectionId, meId, messages, qc]);

  return { ...query, messages };
}

// ---------- Send ----------
export function useSendMessage(connectionId: string | null) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const key = [...MESSAGES_KEY, connectionId ?? "none"] as const;

  return useMutation({
    mutationFn: async (body: string) => {
      if (!connectionId || !meId) throw new Error("Not ready");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Message can't be empty");
      const { error } = await supabase
        .from("messages")
        .insert({ connection_id: connectionId, sender_id: meId, body: trimmed });
      if (error) throw error;
    },
    onMutate: async (body) => {
      if (!connectionId || !meId) return;
      await qc.cancelQueries({ queryKey: key });
      const optimistic: MessageRow = {
        id: `optimistic-${Date.now()}`,
        connection_id: connectionId,
        sender_id: meId,
        body: body.trim(),
        read_at: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<{ pages: MessageRow[][]; pageParams: unknown[] }>(key, (old) => {
        if (!old) return { pages: [[optimistic]], pageParams: [null] };
        const [first, ...rest] = old.pages;
        return { ...old, pages: [[optimistic, ...(first ?? [])], ...rest] };
      });
    },
    onError: () => qc.invalidateQueries({ queryKey: key }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

// ---------- Unread counts across all conversations ----------
export function useUnreadCounts() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery({
    queryKey: [...UNREAD_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async (): Promise<{ byConnection: Record<string, number>; total: number }> => {
      const { data, error } = await supabase
        .from("messages")
        .select("connection_id, sender_id, read_at")
        .is("read_at", null)
        .neq("sender_id", meId as string);
      if (error) throw error;
      const byConnection: Record<string, number> = {};
      for (const m of data ?? []) {
        byConnection[m.connection_id] = (byConnection[m.connection_id] ?? 0) + 1;
      }
      const total = Object.values(byConnection).reduce((a, b) => a + b, 0);
      return { byConnection, total };
    },
    staleTime: 15_000,
  });
}

// ---------- Typing indicator (Realtime broadcast, no DB) ----------
export function useTyping(connectionId: string | null) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!connectionId || !meId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase.channel(`typing:${connectionId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "typing" }, (payload) => {
      const from = (payload.payload as { from?: string } | undefined)?.from;
      if (!from || from === meId) return;
      setOtherTyping(true);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setOtherTyping(false), 3000);
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setOtherTyping(false);
    };
  }, [connectionId, meId]);

  const notifyTyping = useCallback(() => {
    if (!meId || !channelRef.current) return;
    const now = Date.now();
    if (now - lastSent.current < 1500) return; // throttle
    lastSent.current = now;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { from: meId },
    });
  }, [meId]);

  return { otherTyping, notifyTyping };
}
