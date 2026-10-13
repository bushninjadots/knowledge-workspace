// Owner edits to a project page: presentation, GitHub display, gallery and
// resources, README and tools. Each patches the project-detail cache.
// Re-exported from use-projects.ts, so callers keep importing from there.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectPresentationPreset } from "@/lib/project-presentation";
import type { GithubDisplay } from "@/lib/github";
import { PROJECT_KEY } from "./project-keys";
import type { ProjectDetail, GalleryItem, ResourceItem } from "./use-projects";

const sb = supabase;

// ============================================================
// Project Content (gallery + resources)
// ============================================================

// The project-detail query cache shape (matches the route's queryFn return).
type ProjectDetailCache = {
  project: ProjectDetail;
  contributors: unknown[];
  skills: unknown[];
  coverSigned: string | null;
  avatarSigned: Record<string, string>;
};

export function useUpdateProjectPresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      presentationPreset: ProjectPresentationPreset;
    }) => {
      const { error } = await sb
        .from("projects")
        .update({ presentation_preset: input.presentationPreset })
        .eq("id", input.projectId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = PROJECT_KEY(input.projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetailCache>(key);
      qc.setQueryData<ProjectDetailCache>(key, (old) =>
        old
          ? {
              ...old,
              project: { ...old.project, presentation_preset: input.presentationPreset },
            }
          : old,
      );
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) qc.setQueryData(PROJECT_KEY(input.projectId), context.previous);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(input.projectId) });
    },
  });
}

/**
 * Per-project GitHub showcase preferences (which cached repo data the code
 * panel renders). Optimistic like the presentation toggle so hiding a block
 * feels instant; a null column means "all on".
 */
export function useUpdateGithubDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; display: GithubDisplay }) => {
      // github_display ships in 20260930140000 and isn't in the generated
      // Database types yet — routed through the pending-schema handle until it
      // lands there (same pattern as the other post-generation columns).
      const { error } = await supabase
        .from("projects")
        .update({ github_display: input.display })
        .eq("id", input.projectId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      const key = PROJECT_KEY(input.projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetailCache>(key);
      qc.setQueryData<ProjectDetailCache>(key, (old) =>
        old ? { ...old, project: { ...old.project, github_display: input.display } } : old,
      );
      return { previous };
    },
    onError: (_error, input, context) => {
      if (context?.previous) qc.setQueryData(PROJECT_KEY(input.projectId), context.previous);
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(input.projectId) });
    },
  });
}

export function useUpdateProjectContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      gallery?: GalleryItem[];
      resources?: ResourceItem[];
    }) => {
      const updates: { gallery?: GalleryItem[]; resources?: ResourceItem[] } = {};
      if (input.gallery !== undefined) updates.gallery = input.gallery;
      if (input.resources !== undefined) updates.resources = input.resources;
      if (Object.keys(updates).length === 0) return;

      const { error } = await sb.from("projects").update(updates).eq("id", input.projectId);
      if (error) throw error;
    },
    // Optimistic write so the UI updates instantly and the heavy project-detail
    // refetch (signed URLs, skills, contributors) isn't needed just for this.
    onMutate: async (input) => {
      const key = PROJECT_KEY(input.projectId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectDetailCache>(key);
      if (!previous) return { previous: undefined };
      qc.setQueryData<ProjectDetailCache>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          project: {
            ...old.project,
            ...(input.gallery !== undefined ? { gallery: input.gallery } : {}),
            ...(input.resources !== undefined ? { resources: input.resources } : {}),
          },
        };
      });
      return { previous };
    },
    // Roll back only the field this write touched so a concurrent edit on the
    // other field isn't clobbered by a stale full snapshot.
    onError: (_err, input, context) => {
      if (!context?.previous) return;
      qc.setQueryData<ProjectDetailCache>(PROJECT_KEY(input.projectId), (old) => {
        if (!old) return old;
        return {
          ...old,
          project: {
            ...old.project,
            ...(input.gallery !== undefined ? { gallery: context.previous!.project.gallery } : {}),
            ...(input.resources !== undefined
              ? { resources: context.previous!.project.resources }
              : {}),
          },
        };
      });
    },
    // Background refetch keeps the server as source of truth once the write lands.
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
    },
  });
}

// ============================================================
// Project README + tools
// ============================================================

export function useUpdateProjectReadme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; readme?: string | null; tools?: string[] }) => {
      const updates: { readme?: string | null; tools?: string[] } = {};
      if (input.readme !== undefined) updates.readme = input.readme;
      if (input.tools !== undefined) updates.tools = input.tools;
      if (Object.keys(updates).length === 0) return;

      const { error } = await sb.from("projects").update(updates).eq("id", input.projectId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: PROJECT_KEY(variables.projectId) });
    },
  });
}
