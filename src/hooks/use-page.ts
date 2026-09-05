// ── Page Hook ─────────────────────────────────────────────────────────────────
// Fetches a page for a given owner (profile or project). The page includes
// its layout (section → block structure) and theme token reference.
// Public visitors can only load published pages; owners can load drafts.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabasePending } from "@/lib/supabase-pending-schema";
import type { Json } from "@/integrations/supabase/types";
import { deepMergeTokens } from "@/lib/theme-tokens";
import { normalizeStudioConfig } from "@/lib/studio-config";
import type {
  LayoutSection,
  PageData,
  PageLayout,
  PageOwnerType,
  PageVersion,
  ThemeTokens,
} from "@/lib/page-blocks";

interface PageRow {
  id: string;
  owner_id: string;
  owner_type: string;
  layout_id: string | null;
  theme_id: string | null;
  theme_overrides: Json | null;
  config: Json | null;
  composition_id?: string | null;
  vibe_id?: string | null;
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
 * `publish_page_version` snapshots `layouts.sections` — a bare array — into
 * `page_versions.layout`, while older rows may hold an object `{ sections }`.
 * Normalize both shapes so a published version never yields an undefined
 * layout for the Studio editor.
 */
export function parseVersionLayoutSections(raw: unknown): LayoutSection[] {
  return Array.isArray(raw)
    ? (raw as LayoutSection[])
    : ((raw as PageLayout | null)?.sections ?? []);
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
          "id, owner_id, owner_type, layout_id, theme_id, theme_overrides, config, status, published_at, created_at, updated_at",
        )
        .eq("owner_id", ownerId)
        .eq("owner_type", ownerType);
      let { data: row, error } = await (includeDraft
        ? pageQuery.maybeSingle()
        : pageQuery.eq("status", "published").maybeSingle());

      // Older databases may not have the newer Studio columns in their schema
      // cache. Retry with the stable page columns so the Studio can still load.
      if (
        error &&
        /composition_id|vibe_id|theme_overrides|config|column/i.test(error.message ?? "")
      ) {
        const fallbackQuery = supabase
          .from("pages")
          .select(
            "id, owner_id, owner_type, layout_id, theme_id, status, published_at, created_at, updated_at",
          )
          .eq("owner_id", ownerId)
          .eq("owner_type", ownerType);
        ({ data: row, error } = await (includeDraft
          ? fallbackQuery.maybeSingle()
          : fallbackQuery.eq("status", "published").maybeSingle()));
      }
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

      // Query 4: Get published versions (newest first). Publicly readable via RLS.
      const { data: versionRows } = await supabasePending
        .from("page_versions")
        .select("id, version, layout, published_at")
        .eq("page_id", pageRow.id)
        .order("version", { ascending: false });

      const versions: PageVersion[] = (versionRows ?? []).map((row) => {
        // publish_page_version snapshots `layouts.sections` — a bare array —
        // into page_versions.layout. Defend against both shapes (an object
        // with `sections` or the raw array) so published pages never surface
        // an undefined layout to the Studio editor.
        return {
          id: row.id,
          version: row.version,
          layout: { sections: parseVersionLayoutSections(row.layout as unknown) },
          publishedAt: row.published_at,
        };
      });

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
        themeOverrides: pageRow.theme_overrides ? (pageRow.theme_overrides as ThemeTokens) : null,
        config: normalizeStudioConfig(pageRow.config),
        versions,
        publishedVersion: versions.length > 0 ? versions[0].version : null,
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
