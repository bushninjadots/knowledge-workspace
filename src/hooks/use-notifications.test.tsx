import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useNotifications,
  useUnreadNotificationCount,
  useNotificationsByCategory,
  useMarkAsRead,
  useMarkAllAsRead,
  useArchiveNotification,
  useDeleteNotification,
  NOTIFICATIONS_KEY,
  UNREAD_COUNT_KEY,
  BY_CATEGORY_KEY,
} from "./use-notifications";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: { userId: "user-1" } }),
}));

const handle = createFakeSupabase();

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

function notificationCalls() {
  return handle.calls.filter((c) => c.table === "notifications");
}

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  user_id: "user-1",
  actor_id: "actor-1",
  type: "follow",
  title: "Someone followed you",
  body: null,
  entity_type: null,
  entity_id: null,
  read_at: null,
  archived_at: null,
  metadata: { deep_link: "/u/ada" },
  created_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

describe("useNotifications", () => {
  it("lists notifications with metadata normalized", async () => {
    handle.on("notifications:select", () => ({
      data: [row(), row({ id: "n2", type: "comment", metadata: null })],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({
      type: "follow",
      metadata: { deep_link: "/u/ada" },
    });
    expect(result.current.data?.[1].metadata).toEqual({});
  });

  it("returns an empty list when the feed is empty", async () => {
    handle.on("notifications:select", () => ({ data: [], error: null }));
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces query errors", async () => {
    handle.on("notifications:select", () => ({
      data: null,
      error: { message: "select blocked" },
    }));
    const { result } = renderHookWithClient(() => useNotifications());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUnreadNotificationCount", () => {
  it("returns the exact unread count", async () => {
    handle.on("notifications:select", () => ({ data: null, count: 3, error: null }));
    const { result } = renderHookWithClient(() => useUnreadNotificationCount());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
    expect(notificationCalls()).toEqual([
      { table: "notifications", action: "select", projection: "id" },
    ]);
  });
});

describe("useNotificationsByCategory", () => {
  it("groups unread notifications by type", async () => {
    handle.on("notifications:select", () => ({
      data: [
        row({ type: "follow" }),
        row({ id: "n2", type: "follow" }),
        row({ id: "n3", type: "comment" }),
      ],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useNotificationsByCategory());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ follow: 2, comment: 1 });
  });
});

describe("useMarkAsRead", () => {
  it("updates read_at for the given ids and invalidates feed + counts", async () => {
    handle.on("notifications:update", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useMarkAsRead());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync(["n1", "n2"]);
    });
    const [update] = notificationCalls();
    expect(update.action).toBe("update");
    expect(update.value).toMatchObject({ read_at: expect.any(String) });
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(
      expect.arrayContaining([NOTIFICATIONS_KEY, UNREAD_COUNT_KEY, BY_CATEGORY_KEY]),
    );
  });
});

describe("useMarkAllAsRead", () => {
  it("marks every unread notification as read", async () => {
    handle.on("notifications:update", () => ({ data: null, error: null }));
    const { result } = renderHookWithClient(() => useMarkAllAsRead());
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(notificationCalls()).toEqual([
      { table: "notifications", action: "update", value: { read_at: expect.any(String) } },
    ]);
  });
});

describe("useArchiveNotification", () => {
  it("sets archived_at on the notification", async () => {
    handle.on("notifications:update", () => ({ data: null, error: null }));
    const { result } = renderHookWithClient(() => useArchiveNotification());
    await act(async () => {
      await result.current.mutateAsync("n1");
    });
    expect(notificationCalls()).toEqual([
      { table: "notifications", action: "update", value: { archived_at: expect.any(String) } },
    ]);
  });
});

describe("useDeleteNotification", () => {
  it("deletes the notification row", async () => {
    handle.on("notifications:delete", () => ({ data: null, error: null }));
    const { result } = renderHookWithClient(() => useDeleteNotification());
    await act(async () => {
      await result.current.mutateAsync("n1");
    });
    expect(notificationCalls()).toEqual([{ table: "notifications", action: "delete" }]);
  });
});
