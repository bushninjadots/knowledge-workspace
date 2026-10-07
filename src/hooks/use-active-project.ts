import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveProject = { id: string; title: string } | null;

/**
 * The member's most recently updated public project that is still in
 * planning or active. One source for every "building now" on a profile
 * (the header's "Currently building" and the Direction block), so they
 * never name different projects.
 */
export function useActiveProject(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-active-project", profileId],
    queryFn: async (): Promise<ActiveProject> => {
      if (!profileId) return null;
      const { data } = await supabase
        .from("projects")
        .select("id, title")
        .eq("profile_id", profileId)
        .eq("visibility", "public")
        .in("status", ["planning", "active"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id, title: data.title } : null;
    },
    enabled: !!profileId,
  });
}
