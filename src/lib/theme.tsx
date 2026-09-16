import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tethyr-theme";
/** ID of the globally-applied theme preset row, or null for the Tethyr default. */
export const THEME_PRESET_STORAGE_KEY = "tethyr-theme-preset";
/** Cached CSS-var map for the last applied preset, read by the init script to
 *  avoid a flash of the default palette before the token query resolves. */
export const THEME_PRESET_VARS_STORAGE_KEY = "tethyr-theme-preset-vars";

/**
 * Runs before hydration (injected in the document head) so the correct theme
 * class is on <html> before first paint — no flash of the wrong palette. Also
 * replays any cached preset-token CSS variables so a chosen global theme
 * (Minimal, Terminal, Paper…) paints on the very first frame.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var pk=${JSON.stringify(THEME_PRESET_STORAGE_KEY)};var pv=${JSON.stringify(
  THEME_PRESET_VARS_STORAGE_KEY,
)};var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="dark"||((!s||s==="system")&&m);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";var p=localStorage.getItem(pk);if(p){var c=JSON.parse(localStorage.getItem(pv)||"null");if(c&&c.preset===p&&c.scheme===(d?"dark":"light")){for(var v in c.vars){e.style.setProperty(v,c.vars[v]);}}}}catch(e){}})();`;

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  themePreset: string | null;
  setThemePreset: (id: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: ResolvedTheme) {
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [themePreset, setThemePresetState] = useState<string | null>(null);

  // Read the persisted preference after hydration.
  useEffect(() => {
    let stored: Theme = "system";
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* storage unavailable */
    }
    setThemeState(stored);
    const resolved: ResolvedTheme =
      stored === "system" ? (systemPrefersDark() ? "dark" : "light") : stored;
    setResolvedTheme(resolved);
    applyTheme(resolved);

    let presets: string | null = null;
    try {
      presets = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setThemePresetState(presets);
  }, []);

  // Follow the OS when the preference is "system" and keep other tabs in sync.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme !== "system") return;
      const resolved: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const next = event.newValue;
        const nextTheme: Theme =
          next === "light" || next === "dark" || next === "system" ? next : "system";
        setThemeState(nextTheme);
        const resolved: ResolvedTheme =
          nextTheme === "system" ? (mq.matches ? "dark" : "light") : nextTheme;
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
      if (event.key === THEME_PRESET_STORAGE_KEY) {
        setThemePresetState(event.newValue);
      }
    };
    mq.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [theme]);

  // Keep the current tab responsive when a control writes localStorage directly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onThemePresetChanged = () => {
      setThemePresetState(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY));
    };
    window.addEventListener("tethyr:theme-preset-change", onThemePresetChanged);
    return () => window.removeEventListener("tethyr:theme-preset-change", onThemePresetChanged);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    const resolved: ResolvedTheme =
      next === "system" ? (systemPrefersDark() ? "dark" : "light") : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const setThemePreset = useCallback((id: string | null) => {
    setThemePresetState(id);
    try {
      if (id === null) localStorage.removeItem(THEME_PRESET_STORAGE_KEY);
      else localStorage.setItem(THEME_PRESET_STORAGE_KEY, id);
      window.dispatchEvent(new Event("tethyr:theme-preset-change"));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme, themePreset, setThemePreset }),
    [theme, resolvedTheme, setTheme, toggleTheme, themePreset, setThemePreset],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
