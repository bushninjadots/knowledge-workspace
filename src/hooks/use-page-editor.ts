// ── Page Editor Hook ──────────────────────────────────────────────────────────
// Mutations for creating, updating layout, changing theme, publishing, and
// deleting pages. Only the page owner can call these — RLS enforces the rest.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PageLayout, PageOwnerType, PageStatus } from "@/lib/page-blocks";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import { invalidatePage } from "@/hooks/use-page";

const DEFAULT_LAYOUT_ID = "00000000-0000-0000-0000-000000000002";
const DEFAULT_THEME_ID = "00000000-0000-0000-0000-000000000001";

interface CreatePageParams {
  ownerId: string;
  ownerType: PageOwnerType;
  defaultLayout?: PageLayout;
}

interface UpdateLayoutParams {
  pageId: string;
  layout: PageLayout;
  layoutId: string;
}

interface UpdateThemeParams {
  pageId: string;
  themeId: string | null;
}

interface PublishParams {
  pageId: string;
}

/**
 * Create a new page for an owner with the default empty layout and default
 * theme. Call this when a profile or project is first viewed and no page
 * exists yet.
 */
export function useCreatePage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, ownerType, defaultLayout }: CreatePageParams) => {
      // Create layout first with the default sections.
      const sections = defaultLayout?.sections ?? createDefaultProfileLayout().sections;
      const { data: layoutData, error: layoutError } = await (supabase as any)
        .from("layouts")
        .insert({
          name: `Page for ${ownerType}`,
          sections: sections as unknown as Record<string, unknown>[],
          is_template: false,
          created_by: ownerId,
        })
        .select("id")
        .single();

      if (layoutError || !layoutData) throw layoutError ?? new Error("Failed to create layout");

      const { data, error } = await (supabase as any)
        .from("pages")
        .insert({
          owner_id: ownerId,
          owner_type: ownerType,
          layout_id: layoutData.id,
          theme_id: DEFAULT_THEME_ID,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;
      return { pageId: data.id };
    },
    onSuccess: (_data, vars) => {
      invalidatePage(qc, vars.ownerId, vars.ownerType);
    },
  });
}

/**
 * Update the layout of an existing page. Replaces the entire sections array.
 * The layout record itself stays the same; only its sections change.
 */
export function useUpdatePageLayout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ layoutId, layout }: UpdateLayoutParams) => {
      const { error } = await (supabase as any)
        .from("layouts")
        .update({ sections: layout.sections as unknown as Record<string, unknown>[] })
        .eq("id", layoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all page queries since we don't know the owner from here.
      // The caller can also invalidate more specifically.
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}

/**
 * Change the theme associated with a page.
 */
export function useUpdatePageTheme() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, themeId }: UpdateThemeParams) => {
      const { error } = await (supabase as any)
        .from("pages")
        .update({ theme_id: themeId })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}

/**
 * Publish a page. Changes status from draft to published and sets published_at.
 * After publishing, public visitors can view the page.
 */
export function usePublishPage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId }: PublishParams) => {
      const { error } = await (supabase as any)
        .from("pages")
        .update({
          status: "published" as PageStatus,
          published_at: new Date().toISOString(),
        })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}

/**
 * Unpublish a page (set back to draft).
 */
export function useUnpublishPage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId }: PublishParams) => {
      const { error } = await (supabase as any)
        .from("pages")
        .update({ status: "draft" as PageStatus, published_at: null })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}