import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveSupabaseEnv } from "./client";

// Regression guard: preferring the browser-facing VITE_ URL on the server made
// every SSR Supabase read fail in a containerised setup (the browser URL points
// at localhost or a public proxy the SSR runtime cannot reach). SSR routes then
// rendered loading states and disagreed with the hydrated client.
describe("resolveSupabaseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the server-only variables when running on the server", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "vite-key");
    vi.stubEnv("SUPABASE_URL", "http://host.docker.internal:54321");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "server-key");

    expect(resolveSupabaseEnv(true)).toEqual({
      url: "http://host.docker.internal:54321",
      key: "server-key",
    });
  });

  it("uses the browser-facing variables in the browser", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "vite-key");
    vi.stubEnv("SUPABASE_URL", "http://host.docker.internal:54321");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "server-key");

    expect(resolveSupabaseEnv(false)).toEqual({
      url: "http://127.0.0.1:54321",
      key: "vite-key",
    });
  });

  it("falls back to the browser variables on the server when no server value is set", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "http://browser.example");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "vite-key");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");

    expect(resolveSupabaseEnv(true)).toEqual({
      url: "http://browser.example",
      key: "vite-key",
    });
  });
});
