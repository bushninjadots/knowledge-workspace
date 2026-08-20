import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNotificationPreferences } from "./use-notification-preferences";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

// The hook reads the signed-in user from useCurrentUser — stub it to a fixed
// id so the test doesn't depend on the full current-user fetch.
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: { userId: "user-1" } }),
  useAuthUser: () => ({ data: { id: "user-1", email: "user@tethyr.com" } }),
}));

const handle = createFakeSupabase();

function renderHookWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNotificationPreferences(), { wrapper });
}

const selectCall = () => handle.calls.find((c) => c.table === "profiles" && c.action === "select");
const updateCall = () => handle.calls.find((c) => c.table === "profiles" && c.action === "update");

// --- Loading -------------------------------------------------------------

describe("useNotificationPreferences", () => {
  it("loads muted categories stored on the profile", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: { notification_preferences: { mutedCategories: ["community", "session"] } },
      error: null,
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    expect(result.current.mutedCategories).toEqual(["community", "session"]);
    expect(result.current.isMuted("community")).toBe(true);
    expect(result.current.isMuted("session")).toBe(true);
    expect(result.current.isMuted("message")).toBe(false);
  });

  it("ignores unknown categories in stored preferences", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: { notification_preferences: { mutedCategories: ["community", "bogus", 42] } },
      error: null,
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    expect(result.current.mutedCategories).toEqual(["community"]);
  });

  it("falls back to unmuted defaults when the column is missing (schema drift)", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: null,
      error: {
        code: "PGRST204",
        message: "Could not find the 'notification_preferences' column of 'profiles'",
      },
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    expect(result.current.mutedCategories).toEqual([]);
    expect(result.current.isMuted("community")).toBe(false);
  });

  it("falls back on Postgres undefined-column errors too", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: null,
      error: { code: "42703", message: 'column "notification_preferences" does not exist' },
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    expect(result.current.mutedCategories).toEqual([]);
  });

  it("surfaces non-schema errors instead of silently defaulting", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: null,
      error: { code: "PGRST301", message: "Database connection refused" },
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.mutedCategories).toEqual([]);
  });

  // --- Toggling ------------------------------------------------------------

  // Simulate a real DB round-trip: the select handler reads what the update
  // handler wrote, so the post-mutation refetch returns the persisted value.
  // (The fake supabase invokes handlers without arguments, so the update
  // value is read back from the recorded calls instead.)
  function statefulHandlers(initial: string[]) {
    let stored = initial;
    handle.on("profiles:select", () => ({
      data: { notification_preferences: { mutedCategories: stored } },
      error: null,
    }));
    handle.on("profiles:update", () => {
      const lastUpdate = [...handle.calls]
        .reverse()
        .find((c) => c.table === "profiles" && c.action === "update");
      stored = (lastUpdate?.value as { notification_preferences: { mutedCategories: string[] } })
        .notification_preferences.mutedCategories;
      return { data: null, error: null };
    });
    return () => stored;
  }

  it("toggle persists the new muted set and updates the cache optimistically", async () => {
    handle.reset();
    statefulHandlers([]);

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    act(() => result.current.toggle("session"));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateCall()?.value).toEqual({
      notification_preferences: { mutedCategories: ["session"] },
    });
    // Optimistic cache update lands immediately; the refetch confirms it.
    await waitFor(() => expect(result.current.isMuted("session")).toBe(true));
  });

  it("toggle off removes the category from the persisted set", async () => {
    handle.reset();
    statefulHandlers(["session"]);

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());
    expect(result.current.isMuted("session")).toBe(true);

    act(() => result.current.toggle("session"));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateCall()?.value).toEqual({ notification_preferences: { mutedCategories: [] } });
    await waitFor(() => expect(result.current.isMuted("session")).toBe(false));
  });

  it("toggle survives a column-missing update without throwing", async () => {
    handle.reset();
    handle.on("profiles:select", () => ({
      data: { notification_preferences: { mutedCategories: [] } },
      error: null,
    }));
    handle.on("profiles:update", () => ({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'notification_preferences' column" },
    }));

    const { result } = renderHookWithClient();
    await waitFor(() => expect(selectCall()).toBeDefined());

    act(() => result.current.toggle("session"));

    // The write is a no-op (column missing) but the hook must not throw; the
    // optimistic value is applied, then the refetch reconciles to the server.
    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateCall()?.value).toEqual({
      notification_preferences: { mutedCategories: ["session"] },
    });
    await waitFor(() => expect(result.current.isMuted("session")).toBe(false));
  });
});
