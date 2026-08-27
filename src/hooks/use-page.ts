// ── Page Hook ─────────────────────────────────────────────────────────────────
// Fetches a page for a given owner (profile or project). The page includes
// its layout (section → block structure) and theme token reference.
// Public visitors can only load published pages; owners can load drafts.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { deepMergeTokens } from "@/lib/theme-tokens";
import type { PageData, PageLayout, PageOwnerType, ThemeTokens } from "@/lib/page-blocks";

interface PageRow {
  id: string;
  owner_id: string;
  owner_type: string;
  layout_id: string | null;
  theme_id: string | null;
  theme_overrides: Json | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LayoutRow {
  sections: Json;
}

interface ThemeRow {
  tokens: Json;
}

interface FetchPageParams {
  ownerId: string;
  ownerType: PageOwnerType;
  /** Drafts are only requested by an authenticated owner (RLS still protects them). */
  includeDraft?: boolean;
}

/**
 * Fetch the page for a profile or project. Includes the joined layout sections
 * and theme tokens in a single query.
 *
 * Returns null when no page exists yet (the caller should render a default
 * or create one).
 */
export function usePage({ ownerId, ownerType, includeDraft = false }: FetchPageParams) {
  return useQuery({
    queryKey: ["page", ownerType, ownerId, includeDraft ? "draft" : "published"],
    queryFn: async (): Promise<PageData | null> => {
      // Query 1: Get the page record.
      const pageQuery = supabase
        .from("pages")
        .select(
          "id, owner_id, owner_type, layout_id, theme_id, theme_overrides, status, published_at, created_at, updated_at",
        )
        .eq("owner_id", ownerId)
        .eq("owner_type", ownerType);
      const { data: row, error } = await (includeDraft
        ? pageQuery.maybeSingle()
        : pageQuery.eq("status", "published").maybeSingle());

      if (error) throw error;
      if (!row) return null;

      const pageRow = row as unknown as PageRow;

      // Query 2: Get the layout sections.
      const { data: layoutRow } = await supabase
        .from("layouts")
        .select("sections")
        .eq("id", pageRow.layout_id ?? "")
        .maybeSingle();

      const layout: PageLayout = {
        sections: ((layoutRow as unknown as LayoutRow | null)?.sections ??
          []) as unknown as PageLayout["sections"],
      };

      // Query 3: Get the theme tokens (optional — null means use default).
      let theme: ThemeTokens | null = null;
      if (pageRow.theme_id) {
        const { data: themeRow } = await supabase
          .from("themes")
          .select("tokens")
          .eq("id", pageRow.theme_id)
          .maybeSingle();
        // Deep-merge theme_overrides on top of base theme tokens so partial
        // customizations (a radius change, a single font) layer onto the theme
        // instead of replacing whole groups and dropping sibling tokens.
        const baseTokens = (themeRow as unknown as ThemeRow | null)?.tokens ?? {};
        const overrides = (pageRow.theme_overrides ?? {}) as ThemeTokens;
        theme = deepMergeTokens(baseTokens as ThemeTokens, overrides);
      }

      return {
        id: pageRow.id,
        ownerId: pageRow.owner_id,
        ownerType: pageRow.owner_type as PageOwnerType,
        layoutId: pageRow.layout_id ?? "",
        themeId: pageRow.theme_id ?? "",
        status: pageRow.status as PageData["status"],
        publishedAt: pageRow.published_at,
        createdAt: pageRow.created_at,
        updatedAt: pageRow.updated_at,
        layout,
        theme,
      };
    },
    staleTime: 0, // Never serve stale page data — mutations must reflect immediately.
    enabled: !!ownerId,
  });
}

/**
 * Invalidate the page query so it refetches after a mutation (publish, layout
 * change, etc.).
 */
export function invalidatePage(
  qc: ReturnType<typeof useQueryClient>,
  ownerId: string,
  ownerType: PageOwnerType,
) {
  qc.invalidateQueries({ queryKey: ["page", ownerType, ownerId] });
  qc.invalidateQueries({ queryKey: ["page", ownerType, ownerId, "draft"] });
  qc.invalidateQueries({ queryKey: ["page", ownerType, ownerId, "published"] });
}
