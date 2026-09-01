import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { LayoutStorage, PersistedLayout } from "./use-layout-preferences";

const EMPTY: PersistedLayout = { v: 1, items: [], hidden: [], pinned: [] };

export function usePublicStudioLayout(profileId?: string | null): LayoutStorage {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["public-studio-layout", profileId] as const, [profileId]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PersistedLayout | null> => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("public_studio_layout")
        .eq("id", profileId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.public_studio_layout || typeof data.public_studio_layout !== "object") {
        return null;
      }
      return { ...EMPTY, ...(data.public_studio_layout as unknown as PersistedLayout) };
    },
    enabled: !!profileId,
    staleTime: 60_000,
  });

  const save = useCallback(
    async (layout: PersistedLayout) => {
      if (!profileId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ public_studio_layout: layout as unknown as Json })
        .eq("id", profileId);
      if (error) throw error;
      queryClient.setQueryData(queryKey, layout);
    },
    [profileId, queryClient, queryKey],
  );

  return { data: data ?? null, isLoading, save };
}
