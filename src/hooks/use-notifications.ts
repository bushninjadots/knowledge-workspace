/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useNotifications(
  filters?: NotificationFilters,
  limit = 50,
) {
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
