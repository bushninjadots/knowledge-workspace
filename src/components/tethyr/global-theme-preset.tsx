import { useEffect, useRef } from "react";
import { useTheme as useAppTheme, THEME_PRESET_VARS_STORAGE_KEY } from "@/lib/theme";
import { useTheme as useThemeQuery } from "@/hooks/use-theme";

/**
 * Applies a globally-selected theme preset (from the navbar theme dropdown) to
 * the <html> element as CSS custom properties. Nothing is applied while no
 * preset is active. The resolved variables are cached so the pre-hydration init
 * script can paint the preset on the very first frame of the next visit.
 */
export function GlobalThemePreset() {
  const { themePreset, resolvedTheme } = useAppTheme();
  const { data: vars } = useThemeQuery(themePreset);
  const lastApplied = useRef<{ preset: string; vars: Record<string, string> } | null>(null);

  useEffect(() => {
    const el = document.documentElement;

    // Remove the previous preset's variables before switching or clearing, so a
    // cleared preset falls back to the styles.css defaults rather than leaving
    // tokens from an old theme behind.
    const prev = lastApplied.current;
    if (prev && prev.preset !== themePreset) {
      for (const name of Object.keys(prev.vars)) el.style.removeProperty(name);
      lastApplied.current = null;
    }

    if (!themePreset || !vars) return;

    for (const [name, value] of Object.entries(vars)) {
      el.style.setProperty(name, value);
    }
    lastApplied.current = { preset: themePreset, vars };

    try {
      window.localStorage.setItem(
        THEME_PRESET_VARS_STORAGE_KEY,
        JSON.stringify({ preset: themePreset, scheme: resolvedTheme, vars }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [themePreset, resolvedTheme, vars]);

  return null;
}
