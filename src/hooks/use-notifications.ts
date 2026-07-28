/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

// ---------- Types ----------

export type NotificationType =
  | "message"
  | "connection_request"
  | "connection_accepted"
  | "session_invite"
  | "session_update"
  | "comment"
  | "mention"
  | "endorsement"
  | "achievement"
  | "project_invite"
  | "project_join"
  | "project_post"
  | "follow";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  archived_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NotificationFilters {
  type?: NotificationType;
  unreadOnly?: boolean;
  archived?: boolean;
}

// ---------- Query keys ----------

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["unreadNotificationCount"] as const;
export const BY_CATEGORY_KEY = ["notificationsByCategory"] as const;

// ---------- Paginated feed ----------

export function useNotifications(filters?: NotificationFilters, limit = 50) {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<Notification[]>({
    queryKey: [...NOTIFICATIONS_KEY, meId ?? "anon", filters ?? {}, limit],
    enabled: !!meId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", meId as string)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters?.type) {
        q = q.eq("type", filters.type);
      }
      if (filters?.unreadOnly) {
        q = q.is("read_at", null);
      }
      if (filters?.archived === false || filters?.archived === undefined) {
        q = q.is("archived_at", null);
      } else if (filters?.archived === true) {
        q = q.not("archived_at", "is", null);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    staleTime: 10_000,
  });
}

// ---------- Unread count ----------

export function useUnreadNotificationCount() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<number>({
    queryKey: [...UNREAD_COUNT_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", meId as string)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 15_000,
  });
}

// ---------- Category counts ----------

export function useNotificationsByCategory() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useQuery<Record<string, number>>({
    queryKey: [...BY_CATEGORY_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("type")
        .eq("user_id", meId as string)
        .is("read_at", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.type] = (counts[row.type] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 15_000,
  });
}

// ---------- Mark as read ----------

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Mark all as read ----------

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  return useMutation({
    mutationFn: async () => {
      if (!meId) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", meId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Archive ----------

export function useArchiveNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Delete ----------

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
    },
  });
}

// ---------- Realtime subscription (singleton per user) ----------

let activeChannel: ReturnType<typeof supabase.channel> | null = null;
let activeUserId: string | null = null;
let refCount = 0;

export function useNotificationRealtime() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  useEffect(() => {
    if (!meId) return;

    // If a channel already exists for a DIFFERENT user, tear it down
    if (activeChannel && activeUserId !== meId) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
      activeUserId = null;
      refCount = 0;
    }

    refCount++;

    // Only create + subscribe once per user
    if (!activeChannel) {
      const channel = supabase.channel(`notifications:${meId}`);
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${meId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
          qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
          qc.invalidateQueries({ queryKey: BY_CATEGORY_KEY });
        },
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
