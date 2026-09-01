// ── Theme Catalog Hook ────────────────────────────────────────────────────────
// Lists all available themes for the theme picker. Built-in themes (created_by
// is null) are always available; user-created themes are also listed.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { themeTokensToVars } from "@/lib/theme-tokens";
import type { ThemeTokens } from "@/lib/page-blocks";

interface ThemeCatalogEntry {
  id: string;
  name: string;
  description: string | null;
  /** Whether this is a built-in theme (not editable by users). */
  isBuiltIn: boolean;
  /** Number of blocks for preview visualization. */
  tokenCount: number;
  /** Pre-computed CSS vars for quick preview. */
  previewVars: Record<string, string>;
}

/** List all available themes for the picker. */
export function useThemeCatalog() {
  return useQuery({
    queryKey: ["themes", "catalog"],
    queryFn: async (): Promise<ThemeCatalogEntry[]> => {
      const { data, error } = await supabase
        .from("themes")
        .select("id, name, description, tokens, created_by")
        .order("name");

      if (error) throw error;

      return (data ?? []).map((row) => {
        const tokens = (row.tokens ?? {}) as ThemeTokens;
        const previewVars = themeTokensToVars(tokens);
        return {
          id: row.id,
          name: row.name,
          description: row.description ?? null,
          isBuiltIn: row.created_by === null,
          tokenCount: Object.keys(previewVars).length,
          previewVars,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}
