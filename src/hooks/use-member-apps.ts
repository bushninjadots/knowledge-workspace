// The member's private app launcher (20261014170000_member_apps.sql).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export type MemberApp = {
  id: string;
  app_id: string;
  label: string | null;
  url: string;
  position: number;
};

const KEY = ["member-apps"] as const;

export function useMemberApps() {
  const { data: me } = useCurrentUser();
  return useQuery({
    queryKey: [...KEY, me?.userId ?? ""],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_apps")
        .select("id, app_id, label, url, position")
        .eq("user_id", me!.userId)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as MemberApp[];
    },
    enabled: !!me?.userId,
    staleTime: 60_000,
  });
}

export function useAddMemberApps() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  return useMutation({
    mutationFn: async (apps: { app_id: string; url: string; label?: string | null }[]) => {
      const { error } = await supabase.from("member_apps").insert(
        apps.map((a, i) => ({
          user_id: me!.userId,
          app_id: a.app_id,
          url: a.url,
          label: a.label?.trim() || null,
          // Seconds since 1970 keep new apps after older ones.
          position: Math.floor(Date.now() / 1000) + i,
        })),
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRemoveMemberApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_apps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
