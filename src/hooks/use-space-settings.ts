import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPACES_KEY, SPACE_POSTS_KEY } from "@/hooks/community-space-types";
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
      // Capture the space and its dependent rows so the toast's Undo action
      // can restore them. Space posts/comments are captured with their ids so
      // they can be re-linked after re-insert (rows get new ids).
      const { data: space, error } = await sb
        .from("community_spaces")
        .select("*")
        .eq("id", spaceId)
        .maybeSingle();
      if (error) throw error;
      if (!space) return { space, members: [], posts: [] };

      const [membersRes, postsRes] = await Promise.all([
        sb.from("community_space_members").select("*").eq("space_id", spaceId),
        sb.from("posts").select("*").eq("space_id", spaceId),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (postsRes.error) throw postsRes.error;

      const { error: delErr } = await sb.from("community_spaces").delete().eq("id", spaceId);
      if (delErr) throw delErr;
      return { space, members: membersRes.data ?? [], posts: postsRes.data ?? [] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
    },
  });
}

/**
 * Restore a space deleted via useDeleteSpace — powers the Undo action on the
 * deletion toast. Restores the space, its members, and its space-scoped posts
 * (comments re-attached by new post ids). Best-effort: if member/post restore
 * fails, the space itself still comes back.
 */
export function useRestoreSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      space: Record<string, unknown>;
      members: Record<string, unknown>[];
      posts: Record<string, unknown>[];
    }) => {
      const { id: _omit, ...spaceRow } = payload.space;
      const { data: recreated, error } = await sb
        .from("community_spaces")
        .insert(spaceRow as never)
        .select()
        .single();
      if (error) throw error;

      if (payload.members.length > 0) {
        const rows = payload.members.map((m) => ({ ...m, space_id: recreated.id }));
        const { error: mErr } = await sb.from("community_space_members").insert(rows as never);
        if (mErr) console.error("Failed to restore space members", mErr);
      }

      // Re-link posts (new post ids) and their comments.
      const postIdMap = new Map<string, string>();
      for (const p of payload.posts) {
        const { id, ...postRow } = p as { id: string } & Record<string, unknown>;
        const { data: newPost, error: pErr } = await sb
          .from("posts")
          .insert(postRow as never)
          .select("id")
          .single();
        if (pErr) {
          console.error("Failed to restore space post", pErr);
          continue;
        }
        postIdMap.set(id, newPost.id);
      }
      const { data: comments } = await sb
        .from("comments")
        .select("*")
        .in("post_id", [...postIdMap.keys()]);
      for (const c of comments ?? []) {
        const newId = postIdMap.get(c.post_id);
        if (!newId) continue;
        const { id: _c, post_id: _p, ...commentRow } = c as Record<string, unknown>;
        const { error: cErr } = await sb
          .from("comments")
          .insert({ ...commentRow, post_id: newId } as never);
        if (cErr) console.error("Failed to restore post comment", cErr);
      }

      return recreated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SPACES_KEY });
      qc.invalidateQueries({ queryKey: ["space-posts"] });
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
