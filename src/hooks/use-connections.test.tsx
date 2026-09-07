import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useConnections,
  useSendConnection,
  useRespondConnection,
  useDeleteConnection,
  CONNECTIONS_KEY,
} from "./use-connections";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
    channel: ReturnType<typeof vi.fn>;
    removeChannel: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: { userId: "user-1" } }),
  CURRENT_USER_KEY: ["current-user"],
}));

const handle = createFakeSupabase();

// Stub realtime: useConnections subscribes to a singleton channel on mount.
fake.supabase.channel = vi.fn(() => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(),
  };
  return channel;
});
fake.supabase.removeChannel = vi.fn();

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

function connectionCalls() {
  return handle.calls.filter((c) => c.table === "connections");
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    requester_id: "user-1",
    addressee_id: "other-1",
    status: "pending",
    intro_message: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    requester: {
      id: "user-1",
      display_name: "Me",
      handle: "me",
      creator_title: null,
      category: null,
      avatar_url: null,
    },
    addressee: {
      id: "other-1",
      display_name: "Other",
      handle: "other",
      creator_title: null,
      category: null,
      avatar_url: null,
    },
    ...overrides,
  };
}

const cacheKey = [...CONNECTIONS_KEY, "user-1"];

describe("useConnections", () => {
  it("maps the other side to the addressee for outgoing requests", async () => {
    handle.on("connections:select", () => ({ data: [row()], error: null }));
    const { result } = renderHookWithClient(() => useConnections());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      id: "c1",
      status: "pending",
      other: { id: "other-1", handle: "other" },
    });
  });

  it("maps the other side to the requester for incoming requests", async () => {
    handle.on("connections:select", () => ({
      data: [
        row({
          requester_id: "peer-1",
          addressee_id: "user-1",
          requester: { id: "peer-1", display_name: "Peer", handle: "peer" },
        }),
      ],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useConnections());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].other).toMatchObject({ id: "peer-1", handle: "peer" });
  });
});

describe("useSendConnection", () => {
  it("clears a stale declined request, then inserts a fresh pending one", async () => {
    handle.on("connections:delete", () => ({ data: null, error: null }));
    handle.on("connections:insert", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useSendConnection());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({
        addresseeId: "target-2",
        meId: "user-1",
        introMessage: "  Let's build something  ",
      });
    });
    const calls = connectionCalls();
    expect(calls[0]).toEqual({ table: "connections", action: "delete" });
    expect(calls[1]).toEqual({
      table: "connections",
      action: "insert",
      value: {
        requester_id: "user-1",
        addressee_id: "target-2",
        intro_message: "Let's build something",
      },
    });
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(expect.arrayContaining([CONNECTIONS_KEY, ["current-user"]]));
  });

  it("seeds an optimistic pending row and trims the intro", async () => {
    handle.on("connections:delete", () => ({ data: null, error: null }));
    handle.on("connections:insert", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useSendConnection());
    qc.setQueryData(cacheKey, [row({ id: "old", status: "declined", addressee_id: "target-2" })]);
    await act(async () => {
      await result.current.mutateAsync({
        addresseeId: "target-2",
        meId: "user-1",
        introMessage: "hi",
      });
    });
    const cached = qc.getQueryData(cacheKey) as Array<Record<string, unknown>>;
    expect(cached?.[0]).toMatchObject({
      id: "optimistic-target-2",
      requester_id: "user-1",
      addressee_id: "target-2",
      status: "pending",
      intro_message: "hi",
    });
    // The stale declined row for the same pair is dropped.
    expect(cached?.some((c) => c.id === "old")).toBe(false);
  });
});

describe("useRespondConnection", () => {
  it("optimistically updates the status", async () => {
    handle.on("connections:update", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useRespondConnection());
    qc.setQueryData(cacheKey, [row()]);
    await act(async () => {
      await result.current.mutateAsync({ id: "c1", status: "accepted" });
    });
    expect(connectionCalls()).toEqual([
      { table: "connections", action: "update", value: { status: "accepted" } },
    ]);
    const cached = qc.getQueryData(cacheKey) as Array<{ id: string; status: string }>;
    expect(cached?.[0].status).toBe("accepted");
  });

  it("rolls back to the previous status when the update fails", async () => {
    handle.on("connections:update", () => ({
      data: null,
      error: { message: "update blocked" },
    }));
    const { result, qc } = renderHookWithClient(() => useRespondConnection());
    qc.setQueryData(cacheKey, [row()]);
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "c1", status: "accepted" })).rejects.toThrow(
        "update blocked",
      );
    });
    const cached = qc.getQueryData(cacheKey) as Array<{ id: string; status: string }>;
    expect(cached?.[0].status).toBe("pending");
  });
});

describe("useDeleteConnection", () => {
  it("removes the row optimistically and calls delete", async () => {
    handle.on("connections:delete", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useDeleteConnection());
    qc.setQueryData(cacheKey, [row(), row({ id: "c2" })]);
    await act(async () => {
      await result.current.mutateAsync("c1");
    });
    expect(connectionCalls()).toEqual([{ table: "connections", action: "delete" }]);
    const cached = qc.getQueryData(cacheKey) as Array<{ id: string }>;
    expect(cached?.map((c) => c.id)).toEqual(["c2"]);
  });
});
