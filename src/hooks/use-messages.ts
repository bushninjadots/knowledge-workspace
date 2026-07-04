// Direct-message thread hook for an accepted connection.
// Realtime: subscribes to INSERTs on messages filtered by connection_id.
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useMessages(connectionId: string | null) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  useEffect(() => {
    if (!connectionId) return;
    const channel = supabase
      .channel(`messages:${connectionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `connection_id=eq.${connectionId}`,
        },
        () => qc.invalidateQueries({ queryKey: [...MESSAGES_KEY, connectionId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [connectionId, qc]);

  const query = useQuery({
    queryKey: [...MESSAGES_KEY, connectionId ?? "none"],
    enabled: !!connectionId,
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("connection_id", connectionId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
    staleTime: 10_000,
  });

  // Mark unread messages from the other side as read.
  useEffect(() => {
    if (!connectionId || !meId || !query.data) return;
    const unreadIds = query.data
      .filter((m) => m.sender_id !== meId && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then();
  }, [connectionId, meId, query.data]);

  return query;
}

export function useSendMessage(connectionId: string | null) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;
  const key = [...MESSAGES_KEY, connectionId ?? "none"];

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
      const previous = qc.getQueryData<MessageRow[]>(key);
      const optimistic: MessageRow = {
        id: `optimistic-${Date.now()}`,
        connection_id: connectionId,
        sender_id: meId,
        body: body.trim(),
        read_at: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<MessageRow[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
