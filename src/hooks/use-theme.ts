// ── Theme Hook ────────────────────────────────────────────────────────────────
// Fetches a theme by ID from the themes table and exposes the token-derived
// CSS variable map for application to a container element.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ThemeTokens } from "@/lib/page-blocks";
import { themeTokensToVars } from "@/lib/theme-tokens";
import { useTheme as useAppTheme } from "@/lib/theme";
import { DEFAULT_THEME_ID } from "@/lib/constants";

interface ThemeRecord {
  tokens: Json;
}

/**
 * Fetch a single theme by ID and return the CSS variable map.
 * Falls back to the built-in Tethyr Default theme when no theme is applied.
 *
 * The raw tokens are fetched (and cached) independently of the light/dark
 * toggle; the CSS variables are then derived for the *active* scheme in a memo,
 * so toggling light/dark re-derives instantly without a network refetch and a
 * full custom palette adapts to the active mode.
 */
export function useTheme(themeId: string | null | undefined) {
  const resolvedId = themeId || DEFAULT_THEME_ID;
  const { resolvedTheme } = useAppTheme();

  const query = useQuery({
    queryKey: ["theme", resolvedId],
    queryFn: async (): Promise<ThemeTokens> => {
      const { data, error } = await supabase
        .from("themes")
        .select("tokens")
        .eq("id", resolvedId)
        .maybeSingle();

      // If the theme doesn't exist (e.g. was deleted), return empty tokens —
      // the page will fall back to default styles.css tokens.
      if (error || !data) {
        return {};
      }

      const theme = data as unknown as ThemeRecord;
      return (theme.tokens ?? {}) as ThemeTokens;
    },
    staleTime: 30 * 1000, // 30s — theme queries should refetch promptly after mutations.
  });

  const vars = useMemo(
    () => themeTokensToVars((query.data ?? {}) as ThemeTokens, resolvedTheme),
    [query.data, resolvedTheme],
  );

  return { ...query, data: vars };
}
