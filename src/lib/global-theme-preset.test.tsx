import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ThemeProvider,
  useTheme,
  THEME_STORAGE_KEY,
  THEME_PRESET_STORAGE_KEY,
  THEME_PRESET_VARS_STORAGE_KEY,
  themeInitScript,
} from "@/lib/theme";
import { GlobalThemePreset } from "@/components/tethyr/global-theme-preset";
import { useThemePresets } from "@/hooks/use-theme";

// ---------------------------------------------------------------------------
// Supabase mock — distinguishes the presets list query ("id, name, tokens")
// from the single-theme token query ("tokens" + eq(id)) which the shared fake
// helper cannot tell apart.
// ---------------------------------------------------------------------------

type PresetRow = { id: string; name: string; tokens: object };

const fake = vi.hoisted(() => ({
  supabase: {} as { from: ReturnType<typeof vi.fn> },
  rows: [] as PresetRow[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

function seedPresets(rows: PresetRow[]) {
  fake.rows = rows;
}

const from = vi.fn((_table: string) => {
  const builder = {
    _projection: undefined as string | undefined,
    _id: undefined as string | undefined,
    select(cols?: string) {
      builder._projection = cols;
      return builder;
    },
    eq(_col: string, val: string) {
      builder._id = val;
      return builder;
    },
    order() {
      return builder;
    },
    maybeSingle() {
      return builder;
    },
    then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown) {
      if (builder._projection === "tokens") {
        const row = fake.rows.find((r) => r.id === builder._id) ?? null;
        return Promise.resolve(
          onFulfilled({ data: row ? { tokens: row.tokens } : null, error: null }),
        );
      }
      return Promise.resolve(onFulfilled({ data: fake.rows, error: null }));
    },
  };
  return builder;
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ThemeProvider, null, children),
  );
}

/** Renders GlobalThemePreset and exposes the shared useTheme API. */
function renderProbe() {
  let themeApi: ReturnType<typeof useTheme> | undefined;
  function Probe() {
    themeApi = useTheme();
    return createElement(GlobalThemePreset);
  }
  render(createElement(Probe), { wrapper });
  return () => themeApi!;
}

function resetDom() {
  window.localStorage.clear();
  document.documentElement.style.cssText = "";
  document.documentElement.className = "";
}

beforeEach(() => {
  fake.rows = [];
  fake.supabase.from = from as unknown as ReturnType<typeof vi.fn>;
  from.mockClear();
  resetDom();
  // jsdom has no matchMedia; the theme provider and the init script both need it.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetDom();
});

// Light-authored palettes keep the scheme-flip logic out of the happy paths.
const TERMINAL_TOKENS = {
  colors: { background: "#f7f8fa", foreground: "#1f2328", primary: "#3f8f8a" },
};
const PAPER_TOKENS = { colors: { background: "#eef1f4", foreground: "#1f2328" } };

describe("global theme preset persistence", () => {
  it("keeps a valid stored preset selected", async () => {
    seedPresets([{ id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS }]);
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");

    renderHook(() => useThemePresets(), { wrapper });

    await waitFor(() => expect(from).toHaveBeenCalled());
    expect(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)).toBe("terminal");
  });

  it("self-heals when the stored preset no longer exists", async () => {
    seedPresets([{ id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS }]);
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "deleted-theme");

    renderHook(() => useThemePresets(), { wrapper });

    await waitFor(() =>
      expect(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)).toBeNull(),
    );
  });

  it("clearing the preset removes the storage key instead of writing an empty string", async () => {
    seedPresets([{ id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS }]);
    const api = renderProbe();

    act(() => api().setThemePreset("terminal"));
    expect(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)).toBe("terminal");

    act(() => api().setThemePreset(null));
    expect(window.localStorage.getItem(THEME_PRESET_STORAGE_KEY)).toBeNull();
  });

  it("applies preset vars to <html> and caches them for the next visit", async () => {
    seedPresets([{ id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS }]);
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");

    renderProbe();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("#f7f8fa"),
    );

    const cached = JSON.parse(
      window.localStorage.getItem(THEME_PRESET_VARS_STORAGE_KEY) ?? "null",
    );
    expect(cached).toMatchObject({ preset: "terminal", scheme: "light" });
    expect(cached.vars["--background"]).toBe("#f7f8fa");
  });

  it("removes the previous preset's vars when switching presets", async () => {
    seedPresets([
      { id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS },
      { id: "paper", name: "Paper", tokens: PAPER_TOKENS },
    ]);
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");
    const api = renderProbe();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("#f7f8fa"),
    );

    act(() => api().setThemePreset("paper"));

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("#eef1f4"),
    );
  });

  it("adapts a light palette to dark mode and records the scheme in the cache", async () => {
    seedPresets([{ id: "terminal", name: "Terminal", tokens: TERMINAL_TOKENS }]);
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");
    const api = renderProbe();

    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--background")).toBe("#f7f8fa"),
    );

    act(() => api().setTheme("dark"));

    // The authored palette is light, so dark mode rebuilds the canvas from the
    // scheme's dark base tinted by the theme's identity colour.
    const dark = document.documentElement.style.getPropertyValue("--background");
    expect(dark.startsWith("color-mix(in oklab")).toBe(true);
    const cached = JSON.parse(
      window.localStorage.getItem(THEME_PRESET_VARS_STORAGE_KEY) ?? "null",
    );
    expect(cached.scheme).toBe("dark");
  });
});

describe("theme init script preset replay", () => {
  it("replays cached vars matching the stored preset and scheme", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");
    window.localStorage.setItem(
      THEME_PRESET_VARS_STORAGE_KEY,
      JSON.stringify({
        preset: "terminal",
        scheme: "dark",
        vars: { "--background": "#101319" },
      }),
    );

    new Function(themeInitScript)();

    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#101319");
  });

  it("ignores cached vars whose preset no longer matches the stored selection", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");
    window.localStorage.setItem(
      THEME_PRESET_VARS_STORAGE_KEY,
      JSON.stringify({
        preset: "other-preset",
        scheme: "dark",
        vars: { "--background": "#101319" },
      }),
    );

    new Function(themeInitScript)();

    expect(document.documentElement.style.getPropertyValue("--background")).toBe("");
  });

  it("ignores cached vars whose scheme no longer matches", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.localStorage.setItem(THEME_PRESET_STORAGE_KEY, "terminal");
    window.localStorage.setItem(
      THEME_PRESET_VARS_STORAGE_KEY,
      JSON.stringify({
        preset: "terminal",
        scheme: "light",
        vars: { "--background": "#f7f8fa" },
      }),
    );

    new Function(themeInitScript)();

    expect(document.documentElement.style.getPropertyValue("--background")).toBe("");
  });
});
