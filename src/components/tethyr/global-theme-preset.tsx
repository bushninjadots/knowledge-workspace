import { useEffect, useRef, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useTheme as useAppTheme, THEME_PRESET_VARS_STORAGE_KEY } from "@/lib/theme";
import { useTheme as useThemeQuery } from "@/hooks/use-theme";
import {
  DEFAULT_SITE_APPEARANCE,
  normalizeAccountSiteAppearance,
  siteAppearanceVars,
  type AccountSiteAppearance,
} from "@/lib/site-appearance";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

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

/** Postgres "undefined column" and friends: the migration isn't applied yet. */
const isSchemaDrift = (error: { code?: string; message?: string }) =>
  !!error.code?.startsWith("42") || !!error.message?.includes("column");

/**
 * Keeps Site appearance (theme preset + density, shape, accent, motion) in
 * step with the signed-in member's account, so it follows them across
 * devices. The account is the source of truth once it has a value; the
 * first time, whatever this device already had is uploaded so nobody loses
 * their choice. The browser copy still paints the first frame.
 */
export function SiteAppearanceSync() {
  const { themePreset, setThemePreset, siteAppearance, setSiteAppearance } = useAppTheme();
  const { data: me } = useCurrentUser();
  const userId = me?.userId ?? null;
  // The last value known to match the account, per user.
  const synced = useRef<{ userId: string; json: string } | null>(null);
  const current = useRef<AccountSiteAppearance>({ ...siteAppearance, preset: themePreset });
  current.current = { ...siteAppearance, preset: themePreset };

  useEffect(() => {
    if (!userId) {
      synced.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("site_appearance")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if (!isSchemaDrift(error)) console.warn("Site appearance could not load", error.message);
        // Keep working locally; don't overwrite anything we couldn't read.
        synced.current = { userId, json: JSON.stringify(current.current) };
        return;
      }
      const stored = normalizeAccountSiteAppearance(
        (data as { site_appearance?: unknown } | null)?.site_appearance,
      );
      if (stored) {
        const { preset, ...appearance } = stored;
        synced.current = { userId, json: JSON.stringify(stored) };
        setThemePreset(preset);
        setSiteAppearance(appearance);
      } else {
        // First time on the account: this device's choice becomes theirs
        // (written by the effect below unless it's all defaults).
        synced.current = {
          userId,
          json: JSON.stringify({ ...DEFAULT_SITE_APPEARANCE, preset: null }),
        };
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setThemePreset, setSiteAppearance]);

  useEffect(() => {
    const base = synced.current;
    if (!userId || !base || base.userId !== userId) return; // not loaded yet
    const next = { ...siteAppearance, preset: themePreset };
    const json = JSON.stringify(next);
    if (json === base.json) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ site_appearance: next })
        .eq("id", userId);
      if (!error) synced.current = { userId, json };
      else if (!isSchemaDrift(error)) console.warn("Site appearance not saved", error.message);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [userId, themePreset, siteAppearance]);

  return null;
}

/** framer-motion follows Site appearance → Motion as well as the system
 *  setting: its animations are JavaScript, so the CSS rule can't stop them. */
export function SiteMotionConfig({ children }: { children: ReactNode }) {
  const { siteAppearance } = useAppTheme();
  return (
    <MotionConfig reducedMotion={siteAppearance.motion === "reduced" ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
