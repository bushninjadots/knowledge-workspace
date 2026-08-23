// ── Page Hook ─────────────────────────────────────────────────────────────────
// Fetches a page for a given owner (profile or project). The page includes
// its layout (section → block structure) and theme token reference.
// Public visitors can only load published pages; owners can load drafts.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PageData, PageLayout, PageOwnerType, ThemeTokens } from "@/lib/page-blocks";

interface PageRow {
  id: string;
  owner_id: string;
  owner_type: PageOwnerType;
  layout_id: string;
  theme_id: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LayoutRow {
  sections: PageLayout["sections"];
}

interface ThemeRow {
  tokens: ThemeTokens;
}

interface FetchPageParams {
  ownerId: string;
  ownerType: PageOwnerType;
}

/**
 * Fetch the page for a profile or project. Includes the joined layout sections
 * and theme tokens in a single query.
 *
 * Returns null when no page exists yet (the caller should render a default
 * or create one).
 */
export function usePage({ ownerId, ownerType }: FetchPageParams) {
  const qc = useQueryClient();

  return useQuery({
    queryKey: ["page", ownerType, ownerId],
    queryFn: async (): Promise<PageData | null> => {
      // Query 1: Get the page record.
      const { data: row, error } = await (supabase as any)
        .from("pages")
        .select(
          "id, owner_id, owner_type, layout_id, theme_id, status, published_at, created_at, updated_at",
        )
        .eq("owner_id", ownerId)
        .eq("owner_type", ownerType)
        .maybeSingle();

      if (error) throw error;
      if (!row) return null;

      const pageRow = row as unknown as PageRow;

      // Query 2: Get the layout sections.
      const { data: layoutRow } = await (supabase as any)
        .from("layouts")
        .select("sections")
        .eq("id", pageRow.layout_id)
        .maybeSingle();

      const layout: PageLayout = {
        sections: (layoutRow as unknown as LayoutRow | null)?.sections ?? [],
      };

      // Query 3: Get the theme tokens (optional — null means use default).
      let theme: ThemeTokens | null = null;
      if (pageRow.theme_id) {
        const { data: themeRow } = await (supabase as any)
          .from("themes")
          .select("tokens")
          .eq("id", pageRow.theme_id)
          .maybeSingle();
        theme = (themeRow as unknown as ThemeRow | null)?.tokens ?? null;
      }

      return {
        id: pageRow.id,
        ownerId: pageRow.owner_id,
        ownerType: pageRow.owner_type,
        layoutId: pageRow.layout_id,
        themeId: pageRow.theme_id ?? "",
        status: pageRow.status as PageData["status"],
        publishedAt: pageRow.published_at,
        createdAt: pageRow.created_at,
        updatedAt: pageRow.updated_at,
        layout,
        theme,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 min — pages change only through explicit editing.
    enabled: !!ownerId,
  });
}

/**
 * Invalidate the page query so it refetches after a mutation (publish, layout
 * change, etc.).
 */
export function invalidatePage(qc: ReturnType<typeof useQueryClient>, ownerId: string, ownerType: PageOwnerType) {
  qc.invalidateQueries({ queryKey: ["page", ownerType, ownerId] });
}