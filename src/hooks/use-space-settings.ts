import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACES_KEY } from "@/hooks/community-space-types";
import type { SpaceVisibility, SpaceJoinType } from "@/hooks/community-space-types";

const sb = supabase;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string;
      visibility?: SpaceVisibility;
      join_type?: SpaceJoinType;
      rules?: string[];
      report_auto_dim_threshold?: number;
    }) => {
      const { id, ...updates } = input;
      const { error } = await sb
        .from("community_spaces")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
      qc.invalidateQueries({ queryKey: ["community-space"] });
    },
  });
}

export function useDeleteSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string) => {
      const { error } = await sb.from("community_spaces").delete().eq("id", spaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description: string;
      join_type?: SpaceJoinType;
      rules?: string[];
    }) => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) throw new Error("Not authenticated");

      const slug = slugify(input.name);

      const { data: existing } = await sb
        .from("community_spaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existing) throw new Error("A space with a similar name already exists");

      const { data: space, error } = await sb
        .from("community_spaces")
        .insert({
          name: input.name,
          slug,
          description: input.description,
          join_type: input.join_type ?? "auto",
          rules: input.rules ?? [],
          report_auto_dim_threshold: 3,
          created_by: me.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await sb.from("community_space_members").insert({
        space_id: space.id,
        user_id: me.user.id,
        role: "owner",
      });

      return space;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}
