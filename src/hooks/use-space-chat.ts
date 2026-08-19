import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACE_POSTS_KEY } from "@/hooks/community-space-types";

const sb = supabase;

export function useSpacePostsRealtime(spaceId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!spaceId) return;
    const channel = sb
      .channel(`space-posts-${spaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `space_id=eq.${spaceId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: SPACE_POSTS_KEY(spaceId) });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [spaceId, qc]);
}
