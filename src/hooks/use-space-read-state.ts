import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabasePending } from "@/lib/supabase-pending-schema";

const SPACE_READ_KEY = (spaceId: string) => ["space-read", spaceId] as const;

/**
 * Read-receipt state for a space's chat. `last_read_at` lives on the member's
 * own `community_space_members` row (updated through the SECURITY DEFINER
 * `mark_space_read` RPC, since the table's UPDATE policy is restricted to
 * owners/moderators). The feed uses this to draw an "Unread" divider under
 * messages newer than the cursor, then advances the cursor after the space has
 * been open a moment so the divider clears on the next visit.
 */
export function useSpaceReadState(spaceId: string | null) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const meId = me?.userId ?? null;

  const { data: lastReadAt, refetch } = useQuery({
    queryKey: SPACE_READ_KEY(spaceId ?? ""),
    queryFn: async () => {
      if (!spaceId || !meId) return null;
      const { data, error } = await supabasePending
        .from("community_space_members")
        .select("last_read_at")
        .eq("space_id", spaceId)
        .eq("user_id", meId)
        .maybeSingle();
      if (error) throw error;
      return (data?.last_read_at as string | null) ?? null;
    },
    enabled: !!spaceId && !!meId,
    staleTime: 15_000,
  });

  /** Advance the read cursor to now (or to a specific timestamp). */
  const markRead = useCallback(
    async (at?: string) => {
      if (!spaceId || !meId) return;
      const ts = at ?? new Date().toISOString();
      // Optimistically update local state so the divider clears instantly.
      qc.setQueryData(SPACE_READ_KEY(spaceId), ts);
      const { error } = await supabase.rpc("mark_space_read", {
        p_space_id: spaceId,
      });
      if (error) {
        // Roll back on failure and let the next fetch reconcile.
        qc.setQueryData(SPACE_READ_KEY(spaceId), null);
        await refetch();
      }
    },
    [spaceId, meId, qc, refetch],
  );

  return { lastReadAt: lastReadAt ?? null, markRead };
}
