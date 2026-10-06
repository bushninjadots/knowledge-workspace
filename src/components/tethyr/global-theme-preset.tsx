import { useEffect, useRef } from "react";
import { useTheme as useAppTheme, THEME_PRESET_VARS_STORAGE_KEY } from "@/lib/theme";
import { useTheme as useThemeQuery } from "@/hooks/use-theme";
import { siteAppearanceVars } from "@/lib/site-appearance";

/**
 * Applies a globally-selected theme preset (from the navbar theme dropdown) to
 * the <html> element as CSS custom properties. Nothing is applied while no
 * preset is active. The resolved variables are cached so the pre-hydration init
 * script can paint the preset on the very first frame of the next visit.
 */
export function GlobalThemePreset() {
  const { themePreset, resolvedTheme, siteAppearance } = useAppTheme();
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

    // Remove variables that disappeared during a refetch or scheme change.
    // Without this diff cleanup, a stale token (especially a border or surface
    // token) can survive indefinitely and fight the newly-derived palette.
    if (prev?.preset === themePreset) {
      for (const name of Object.keys(prev.vars)) {
        if (!(name in vars)) el.style.removeProperty(name);
      }
    }

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

  // Site appearance (density, shape, accent, motion) layers over the theme.
  // Applied after the preset so its shape and accent win; previous values
  // are removed first so switching back to the theme's own leaves nothing.
  const lastSite = useRef<Record<string, string>>({});
  useEffect(() => {
    const el = document.documentElement;
    const next = siteAppearanceVars(siteAppearance);
    for (const name of Object.keys(lastSite.current)) {
      if (!(name in next)) el.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(next)) el.style.setProperty(name, value);
    lastSite.current = next;
    if (siteAppearance.motion === "reduced") el.setAttribute("data-site-motion", "reduced");
    else el.removeAttribute("data-site-motion");
  }, [siteAppearance, vars]);

  return null;
}
