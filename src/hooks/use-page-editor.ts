// ── Page Editor Hook ──────────────────────────────────────────────────────────
// Mutations for creating, updating layout, changing theme, publishing, and
// deleting pages. Only the page owner can call these — RLS enforces the rest.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PageLayout, PageOwnerType, PageStatus, ThemeTokens } from "@/lib/page-blocks";
import { createDefaultProfileLayout } from "@/lib/default-layouts";
import { invalidatePage } from "@/hooks/use-page";

/** The jsonb `sections` column on layouts — cast target for LayoutSection[]. */
type LayoutSectionsJson = Database["public"]["Tables"]["layouts"]["Insert"]["sections"];

const DEFAULT_THEME_ID = "00000000-0000-0000-0000-000000000001";

interface CreatePageParams {
  ownerId: string;
  ownerType: PageOwnerType;
  userId?: string;
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
    mutationFn: async ({ ownerId, ownerType, userId, defaultLayout }: CreatePageParams) => {
      // Create a layout with the default sections. For created_by, prefer
      // the explicit userId; fall back to auth.uid() so RLS allows future updates.
      const sections = defaultLayout?.sections ?? createDefaultProfileLayout().sections;
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error("You must be signed in to create a Studio page");
      }
      // Always use the verified session identity for the RLS-protected layout
      // insert. A caller-provided id is metadata only and must not decide
      // ownership.
      const effectiveUserId = authData.user.id;
      if (userId && userId !== effectiveUserId) {
        throw new Error("Your session does not match this Studio owner");
      }
      const { data: layoutData, error: layoutError } = await supabase
        .from("layouts")
        .insert({
          name: `Page for ${ownerType}`,
          sections: sections as unknown as LayoutSectionsJson,
          is_template: false,
          created_by: effectiveUserId,
        })
        .select("id")
        .single();

      if (layoutError || !layoutData) {
        throw new Error(
          `Studio layout creation failed: ${layoutError?.message ?? "no layout was returned"}`,
        );
      }

      const { data, error } = await supabase
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

      if (error) {
        throw new Error(`Studio page creation failed: ${error.message}`);
      }
      if (!data) throw new Error("Studio page creation failed: no page was returned");
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
      const { error } = await supabase
        .from("layouts")
        .update({ sections: layout.sections as unknown as LayoutSectionsJson })
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
      const { error } = await supabase.from("pages").update({ theme_id: themeId }).eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["page"] });
      qc.invalidateQueries({ queryKey: ["theme", vars.themeId] });
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
      const { error } = await supabase
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
      const { error } = await supabase
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

/**
 * Save per-page theme token overrides (radius, colors, typography).
 * These merge on top of the base theme tokens at render time.
 */
export function useUpdateThemeOverrides() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      overrides,
    }: {
      pageId: string;
      overrides: ThemeTokens | null;
    }) => {
      const { error } = await supabase
        .from("pages")
        .update({ theme_overrides: overrides as unknown as Json })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["page"] });
    },
  });
}
