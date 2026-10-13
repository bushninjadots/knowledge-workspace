// A team's, challenge's or project's own space (20261014110000_linked_spaces):
// read whether it exists, and start it (the person who runs the thing only).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACES_KEY } from "@/hooks/community-space-types";

const sb = supabase;

export type LinkedKind = "team" | "challenge" | "project";

const COLUMN: Record<LinkedKind, "team_id" | "challenge_id" | "project_id"> = {
  team: "team_id",
  challenge: "challenge_id",
  project: "project_id",
};

export type LinkedSpace = {
  id: string;
  slug: string;
  name: string;
  visibility: string;
};

const LINKED_SPACE_KEY = (kind: LinkedKind, id: string) => ["linked-space", kind, id] as const;

/** The linked space, if one exists and you can see it (private ones: members). */
export function useLinkedSpace(kind: LinkedKind, id: string | null | undefined) {
  return useQuery({
    queryKey: LINKED_SPACE_KEY(kind, id ?? ""),
    queryFn: async (): Promise<LinkedSpace | null> => {
      const { data, error } = await sb
        .from("community_spaces")
        .select("id, slug, name, visibility")
        .eq(COLUMN[kind], id as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

/** Open the linked space, creating it first if it doesn't exist yet. */
export function useOpenLinkedSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: LinkedKind; id: string }) => {
      const { data, error } = await sb.rpc("open_linked_space", {
        p_kind: input.kind,
        p_id: input.id,
      });
      if (error) throw error;
      return data as { slug: string; created: boolean };
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: LINKED_SPACE_KEY(input.kind, input.id) });
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}
