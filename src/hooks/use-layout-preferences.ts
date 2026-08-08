import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PersistedLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
};

export type PersistedLayout = {
  v: 1;
  items: PersistedLayoutItem[];
  hidden: string[];
  pinned: string[];
};

const EMPTY: PersistedLayout = { v: 1, items: [], hidden: [], pinned: [] };

export function useLayoutPreferences(page: "dashboard" | "profile", userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["layout-preferences", page, userId] as const, [page, userId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PersistedLayout | null> => {
      if (!userId) return null;
      const { data, error } = await (supabase as any)
        .from("user_layout_preferences")
        .select("layout")
        .eq("user_id", userId)
        .eq("page", page)
        .maybeSingle();
      if (error) throw error;
      if (!data?.layout) return null;
      const parsed = data.layout as PersistedLayout;
      return { ...EMPTY, ...parsed };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const save = useCallback(
    async (layout: PersistedLayout) => {
      if (!userId) return;
      const { error } = await (supabase as any).from("user_layout_preferences").upsert(
        {
          user_id: userId,
          page,
          layout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,page" },
      );
      if (error) throw error;
      queryClient.setQueryData(queryKey, layout);
    },
    [userId, page, queryClient, queryKey],
  );

  return { data: data ?? null, isLoading, save };
}
