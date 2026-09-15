// ── Theme Hook ────────────────────────────────────────────────────────────────
// Fetches a theme by ID from the themes table and exposes the token-derived
// CSS variable map for application to a container element.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ThemeTokens } from "@/lib/page-blocks";
import { themeTokensToVars } from "@/lib/theme-tokens";
import { useTheme as useAppTheme, THEME_PRESET_STORAGE_KEY } from "@/lib/theme";
import { DEFAULT_THEME_ID } from "@/lib/constants";

interface ThemeRecord {
  tokens: Json;
}

/** A curated preset row from the `themes` table (id + raw tokens). */
export interface ThemePreset {
  id: string;
  name: string;
  tokens: ThemeTokens;
}

/**
 * Fetch every curated theme preset for pickers (navbar style menu, Studio
 * Customize panel). Raw tokens are cached; each consumer derives the CSS
 * variables for its own active light/dark scheme.
 */
export function useThemePresets() {
  return useQuery({
    queryKey: ["theme-presets"],
    queryFn: async (): Promise<ThemePreset[]> => {
      const { data, error } = await supabase
        .from("themes")
        .select("id, name, tokens")
        .order("name", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as (ThemeRecord & { id: string; name: string })[];
      const presets = rows.map((row) => ({
        id: row.id,
        name: row.name,
        tokens: ((row.tokens ?? {}) as Json) as ThemeTokens,
      }));

      // Self-heal: if the globally-selected preset was deleted from the themes
      // table, clear the stale selection so the app falls back to the Tethyr
      // default instead of dangling on a nonexistent theme id.
      if (typeof window !== "undefined") {
        try {
          const selected = window.localStorage.getItem(THEME_PRESET_STORAGE_KEY);
          if (selected && !presets.some((preset) => preset.id === selected)) {
            window.localStorage.removeItem(THEME_PRESET_STORAGE_KEY);
          }
        } catch {
          /* storage unavailable */
        }
      }

      return presets;
    },
    staleTime: 60 * 1000,
  });
}

/** A small stable colour to badge a theme preset in a picker.
 *  Prefers the authored primary, then border, background, card. */
export function presetSwatch(preset: ThemePreset): string {
  const colors = (preset.tokens as { colors?: Record<string, string> }).colors ?? {};
  return colors.primary ?? colors.border ?? colors.background ?? colors.card ?? "#e5e7eb";
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
