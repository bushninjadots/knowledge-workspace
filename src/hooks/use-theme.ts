// ── Theme Hook ────────────────────────────────────────────────────────────────
// Fetches a theme by ID from the themes table and exposes the token-derived
// CSS variable map for application to a container element.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ThemeTokens } from "@/lib/page-blocks";
import { themeTokensToVars } from "@/lib/theme-tokens";

const DEFAULT_THEME_ID = "00000000-0000-0000-0000-000000000001";

interface ThemeRecord {
  tokens: ThemeTokens;
}

/**
 * Fetch a single theme by ID and return the CSS variable map.
 * Falls back to the built-in Tethyr Default theme when no theme is applied.
 */
export function useTheme(themeId: string | null | undefined) {
  const resolvedId = themeId || DEFAULT_THEME_ID;

  return useQuery({
    queryKey: ["theme", resolvedId],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await (supabase as any)
        .from("themes")
        .select("tokens")
        .eq("id", resolvedId)
        .maybeSingle();

      // If the theme doesn't exist (e.g. was deleted), return empty vars —
      // the page will fall back to default styles.css tokens.
      if (error || !data) {
        return {};
      }

      const theme = data as unknown as ThemeRecord;
      return themeTokensToVars(theme.tokens ?? {});
    },
    staleTime: 5 * 60 * 1000, // 5 min — themes change rarely.
  });
}