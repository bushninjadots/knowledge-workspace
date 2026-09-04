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
import { DEFAULT_THEME_ID } from "@/lib/constants";

type LayoutSections = Database["public"]["Tables"]["layouts"]["Insert"]["sections"];

/** Owner-scoped metadata optional on most mutations so we can invalidate just
 * the affected page's queries instead of every page in the app. */
interface OwnerScope {
  ownerId?: string;
  ownerType?: PageOwnerType;
}

function invalidatePageFor(qc: ReturnType<typeof useQueryClient>, vars: OwnerScope) {
  if (vars.ownerId && vars.ownerType) invalidatePage(qc, vars.ownerId, vars.ownerType);
  else qc.invalidateQueries({ queryKey: ["page"] });
}

interface CreatePageParams {
  ownerId: string;
  ownerType: PageOwnerType;
}

interface UpdateLayoutParams extends OwnerScope {
  layout: PageLayout;
  layoutId: string;
}

interface UpdateThemeParams extends OwnerScope {
  pageId: string;
  themeId: string | null;
}

interface UpdateConfigParams extends OwnerScope {
  pageId: string;
  config: StudioConfig;
}

interface PublishParams extends OwnerScope {
  pageId: string;
}

interface ApplyStudioCompositionParams extends OwnerScope {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Never point a new page at the shared empty layout. Create an owned
      // layout so every Studio starts with real, renderable content. The
      // layout owner must be the authenticated user, not the page owner id
      // (project pages are owned by a project row).
      const starterLayout =
        ownerType === "profile" ? createDefaultProfileLayout() : createDefaultProjectLayout();
      const { data: layout, error: layoutError } = await supabase
        .from("layouts")
        .insert({
          name: ownerType === "profile" ? "Default Studio" : "Default Project Space",
          type: ownerType === "profile" ? "portfolio" : "standard",
          sections: starterLayout.sections as unknown as LayoutSections,
          is_template: false,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (layoutError || !layout) throw layoutError ?? new Error("Could not create layout");

      const { data, error } = await supabase
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
      return { pageId: data.id, layoutId: layout.id };
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
      const { error } = await supabase
        .from("layouts")
        .update({ sections: layout.sections as unknown as Json })
        .eq("id", layoutId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      invalidatePageFor(qc, vars);
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
        p_composition_id: config.compositionId ?? config.structure ?? "",
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
  });
}

/**
 * Change the theme associated with a page.
 */
export function useUpdatePageTheme() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, themeId }: UpdateThemeParams) => {
      const { error } = await supabase.from("pages").update({ theme_id: themeId }).eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
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
      const { error } = await supabase
        .from("pages")
        .update({
          config: config as unknown as Json,
        })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
  });
}

/**
 * Publish a page. Calls the `publish_page_version` RPC which snapshots the
 * current layout + theme into `page_versions`, bumps the version number,
 * and sets `pages.status = 'published'`.
 */
export function usePublishPage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId }: PublishParams) => {
      const { error } = await supabase.rpc("publish_page_version", {
        _page_id: pageId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
  });
}

/**
 * Unpublish a page (set back to draft). Does not touch version history.
 */
export function useUnpublishPage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId }: PublishParams) => {
      const { error } = await supabase
        .from("pages")
        .update({ status: "draft" as PageStatus, published_at: null })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
  });
}

interface RollbackParams extends OwnerScope {
  pageId: string;
  version: number;
}

/**
 * Roll back a page to a previous published version. Calls the
 * `rollback_page_version` RPC which restores the snapshot's layout + theme
 * and re-publishes the page.
 */
export function useRollbackPageVersion() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, version }: RollbackParams) => {
      const { error } = await supabase.rpc("rollback_page_version", {
        _page_id: pageId,
        _version: version,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidatePageFor(qc, vars),
  });
}
