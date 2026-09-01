// ── Page Editor Hook ──────────────────────────────────────────────────────────
// Mutations for creating, updating layout, changing theme, publishing, and
// deleting pages. Only the page owner can call these — RLS enforces the rest.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PageLayout, PageOwnerType, PageStatus } from "@/lib/page-blocks";
import { invalidatePage } from "@/hooks/use-page";
import { createDefaultProfileLayout, createDefaultProjectLayout } from "@/lib/default-layouts";
import type { StudioConfig } from "@/lib/studio-config";
import type { Database, Json } from "@/integrations/supabase/types";

const DEFAULT_THEME_ID = "00000000-0000-0000-0000-000000000001";

type LayoutSections = Database["public"]["Tables"]["layouts"]["Insert"]["sections"];

interface CreatePageParams {
  ownerId: string;
  ownerType: PageOwnerType;
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

interface UpdateConfigParams {
  pageId: string;
  config: StudioConfig;
}

interface PublishParams {
  pageId: string;
}

interface ApplyStudioCompositionParams {
  pageId: string;
  layoutId: string;
  layout: PageLayout;
  config: StudioConfig;
}

/**
 * Create a new page for an owner with the default empty layout and default
 * theme. Call this when a profile or project is first viewed and no page
 * exists yet.
 */
export function useCreatePage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ownerId, ownerType }: CreatePageParams) => {
      // Never point a new page at the shared empty layout. Create an owned
      // layout so every Studio starts with real, renderable content.
      const starterLayout =
        ownerType === "profile" ? createDefaultProfileLayout() : createDefaultProjectLayout();
      const { data: layout, error: layoutError } = await (supabase as any)
        .from("layouts")
        .insert({
          name: ownerType === "profile" ? "Default Studio" : "Default Project Space",
          type: ownerType === "profile" ? "portfolio" : "standard",
          sections: starterLayout.sections as unknown as LayoutSections,
          is_template: false,
          created_by: ownerId,
        })
        .select("id")
        .single();
      if (layoutError || !layout) throw layoutError ?? new Error("Could not create layout");

      const { data, error } = await (supabase as any)
        .from("pages")
        .insert({
          owner_id: ownerId,
          owner_type: ownerType,
          layout_id: layout.id,
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

/** Apply a composition and its related config as one database transaction. */
export function useApplyStudioComposition() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, layoutId, layout, config }: ApplyStudioCompositionParams) => {
      const { error } = await supabase.rpc("apply_studio_composition", {
        p_page_id: pageId,
        p_layout_id: layoutId,
        p_sections: layout.sections as unknown as Json,
        p_config: config as unknown as Json,
        p_composition_id: config.compositionId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page"] }),
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
 * Update a page's StudioConfig (radius/typography/density/accent/personality).
 * Replaces the entire config object.
 */
export function useUpdatePageConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, config }: UpdateConfigParams) => {
      const { error } = await (supabase as any)
        .from("pages")
        .update({
          config: config as unknown as Json,
          composition_id: config.compositionId,
          vibe_id: config.vibeId,
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
