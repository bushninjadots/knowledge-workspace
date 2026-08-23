// ── Fork Hook ────────────────────────────────────────────────────────────────
// Forks copy a layout's structure to a new layout owned by the forking user,
// with a recorded parent→child relationship.
// Remix = fork + publish the fork as a new template.
//
//   • useForkLayout — copy a template's sections into a new layout + record fork.
//   • useRemixLayout — fork + mark the child as a template.
//   • useLineage — get the full ancestry chain for a layout.
//   • useForkCount — get the fork count for a layout.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { friendlyError } from "@/lib/error-message";
import type { ForkData, LineageNode, LayoutSection } from "@/lib/page-blocks";

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get the full lineage (ancestor chain) for a layout. */
export function useLineage(layoutId: string) {
  return useQuery({
    queryKey: ["lineage", layoutId],
    queryFn: async (): Promise<LineageNode[]> => {
      const { data, error } = await (supabase as any)
        .rpc("get_layout_lineage", { start_id: layoutId });

      if (error) throw error;
      return (data ?? []) as LineageNode[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!layoutId,
  });
}

/** Get the fork count for a layout (from the cached column). */
export function useForkCount(layoutId: string) {
  return useQuery({
    queryKey: ["forks", "count", layoutId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any)
        .from("layouts")
        .select("fork_count")
        .eq("id", layoutId)
        .maybeSingle();

      if (error) throw error;
      return data?.fork_count ?? 0;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!layoutId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

interface ForkLayoutParams {
  parentLayoutId: string;
  /** Name for the new forked layout (defaults to "Fork of ..."). */
  name?: string;
}

interface ForkResult {
  newLayoutId: string;
  forkId: string;
}

/** Copy a layout's sections into a new layout owned by the current user, recording the fork. */
export function useForkLayout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ parentLayoutId, name }: ForkLayoutParams): Promise<ForkResult> => {
      // 1. Fetch the parent layout's sections and metadata.
      const { data: parent, error: fetchErr } = await (supabase as any)
        .from("layouts")
        .select("sections, name, theme_id")
        .eq("id", parentLayoutId)
        .single();

      if (fetchErr) throw fetchErr;

      const sections: LayoutSection[] = (parent?.sections ?? []).map(
        (s: LayoutSection) => ({
          ...s,
          blocks: s.blocks.map((b) => ({ ...b, config: { ...b.config } })),
        }),
      );

      // 2. Create a new layout with the copied sections.
      //    Set created_by so the user owns the fork and can edit it.
      const forkName = name ?? `Fork of ${parent?.name ?? "layout"}`;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const { data: child, error: insertErr } = await (supabase as any)
        .from("layouts")
        .insert({
          name: forkName,
          type: "custom",
          sections,
          theme_id: parent?.theme_id ?? null,
          is_template: false,
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      const childLayoutId: string = child.id;

      // 3. Record the fork relationship.
      const { data: fork, error: forkErr } = await (supabase as any)
        .from("forks")
        .insert({
          parent_layout_id: parentLayoutId,
          child_layout_id: childLayoutId,
        })
        .select("id")
        .single();

      if (forkErr) throw forkErr;

      // 4. Bump the parent's fork count.
      await (supabase as any)
        .rpc("increment_fork_count", { layout_id: parentLayoutId })
        .catch(() => {
          // Non-critical — don't fail the whole operation.
        });

      return { newLayoutId: childLayoutId, forkId: fork.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["layouts"] });
      qc.invalidateQueries({ queryKey: ["lineage"] });
      qc.invalidateQueries({ queryKey: ["forks"] });
      toast.success("Layout forked — it's yours to customize");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to fork layout"));
    },
  });
}

interface RemixParams {
  parentLayoutId: string;
  name: string;
  description?: string;
  category?: string;
}

/** Fork a template AND publish the fork as a new template (remix). */
export function useRemixLayout() {
  const qc = useQueryClient();
  const forkLayout = useForkLayout();

  return useMutation({
    mutationFn: async (params: RemixParams): Promise<ForkResult> => {
      // 1. Fork the layout.
      const result = await forkLayout.mutateAsync({
        parentLayoutId: params.parentLayoutId,
        name: params.name,
      });

      // 2. Mark the child as a template.
      const { error } = await (supabase as any)
        .from("layouts")
        .update({
          is_template: true,
          name: params.name,
          ...(params.description !== undefined ? { description: params.description } : {}),
          ...(params.category !== undefined ? { category: params.category } : {}),
        })
        .eq("id", result.newLayoutId);

      if (error) throw error;

      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["lineage"] });
      toast.success("Remix published — your version is now in the template library");
    },
    onError: (err) => {
      toast.error(friendlyError(err, "Failed to remix layout"));
    },
  });
}