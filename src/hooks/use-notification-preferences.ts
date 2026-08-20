import { useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ALL_CATEGORIES, type NotificationCategory } from "@/lib/notification-categories";

const PREFS_KEY = ["notification-preferences"] as const;

const DEFAULT_MUTED: NotificationCategory[] = [];

export type NotificationPreferences = {
  mutedCategories: NotificationCategory[];
};

/**
 * Per-category notification mute preferences, stored on the user's profile
 * (`profiles.notification_preferences` JSONB column, added by the
 * `20260820170000_notification_preferences` migration). Reads/writes degrade
 * gracefully to local defaults if the column hasn't been applied to the
 * database yet, so the app never blocks on schema drift.
 */
export function useNotificationPreferences() {
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  const query = useQuery<NotificationPreferences>({
    queryKey: [...PREFS_KEY, meId ?? "anon"],
    enabled: !!meId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", meId as string)
        .maybeSingle();
      if (error) {
        // Column not applied yet — fall back to defaults instead of failing.
        if (error.code?.startsWith("42") || error.message?.includes("column")) {
          return { mutedCategories: DEFAULT_MUTED };
        }
        throw error;
      }
      const raw = (data as { notification_preferences?: unknown } | null)?.notification_preferences;
      const muted = parseMuted(raw);
      return { mutedCategories: muted };
    },
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async (mutedCategories: NotificationCategory[]) => {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: { mutedCategories } })
        .eq("id", meId as string);
      if (error) {
        if (error.code?.startsWith("42") || error.message?.includes("column")) return;
        throw error;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });

  const toggle = useCallback(
    (category: NotificationCategory) => {
      const current = query.data?.mutedCategories ?? DEFAULT_MUTED;
      const next = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category];
      // Optimistic update, then persist.
      queryClient.setQueryData<NotificationPreferences>([...PREFS_KEY, meId ?? "anon"], {
        mutedCategories: next,
      });
      save.mutate(next);
    },
    [query.data, queryClient, meId, save],
  );

  const isMuted = useCallback(
    (category: NotificationCategory) =>
      (query.data?.mutedCategories ?? DEFAULT_MUTED).includes(category),
    [query.data],
  );

  return {
    mutedCategories: query.data?.mutedCategories ?? DEFAULT_MUTED,
    isLoading: query.isLoading,
    toggle,
    isMuted,
  };
}

function parseMuted(raw: unknown): NotificationCategory[] {
  if (!raw || typeof raw !== "object") return DEFAULT_MUTED;
  const list = (raw as { mutedCategories?: unknown }).mutedCategories;
  if (!Array.isArray(list)) return DEFAULT_MUTED;
  return list.filter(
    (c): c is NotificationCategory =>
      typeof c === "string" && (ALL_CATEGORIES as string[]).includes(c),
  );
}
