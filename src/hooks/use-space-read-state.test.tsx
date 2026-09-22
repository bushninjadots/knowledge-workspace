import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSpaceReadState } from "./use-space-read-state";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

/**
 * The "Unread" divider in a space's chat hangs off this cursor. The writes go
 * through the `mark_space_read` RPC (the members table's UPDATE policy is
 * owner/moderator only), so the interesting behaviour is the optimistic update
 * and what happens when that RPC is refused — a divider that stays cleared
 * after a failed write is a lie the feed then shows as "no unread".
 */
const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  },
  user: { data: { userId: "user-1" } as { userId: string } | null },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));
vi.mock("@/hooks/use-current-user", () => ({ useCurrentUser: () => ({ data: fake.user.data }) }));

const handle = createFakeSupabase();

function renderState(spaceId: string | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.rpc = handle.client.rpc;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useSpaceReadState(spaceId), { wrapper }), qc };
}

const READ_KEY = ["space-read", "space-1"];

beforeEach(() => {
  handle.reset();
  handle.client.from.mockClear();
  handle.client.rpc.mockReset();
  handle.client.rpc.mockResolvedValue({ data: null, error: null });
  fake.user.data = { userId: "user-1" };
});

describe("useSpaceReadState", () => {
  it("reads the member's own last_read_at cursor", async () => {
    handle.on("community_space_members:select", () => ({
      data: { last_read_at: "2026-09-01T10:00:00Z" },
      error: null,
    }));

    const { result } = renderState("space-1");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-01T10:00:00Z"));

    expect(handle.calls).toEqual([
      { table: "community_space_members", action: "select", projection: "last_read_at" },
    ]);
  });

  it("treats a missing member row as no cursor", async () => {
    handle.on("community_space_members:select", () => ({ data: null, error: null }));

    const { result } = renderState("space-1");
    await waitFor(() => expect(handle.calls).toHaveLength(1));
    expect(result.current.lastReadAt).toBeNull();
  });

  it("does not query without a space or a signed-in user", async () => {
    const { result } = renderState(null);
    expect(handle.calls).toHaveLength(0);
    expect(result.current.lastReadAt).toBeNull();

    fake.user.data = null;
    renderState("space-1");
    await waitFor(() => expect(fake.supabase.from).toHaveBeenCalledTimes(0));
  });

  it("advances the cursor optimistically and persists via the RPC", async () => {
    handle.on("community_space_members:select", () => ({
      data: { last_read_at: "2026-09-01T10:00:00Z" },
      error: null,
    }));
    const { result, qc } = renderState("space-1");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-01T10:00:00Z"));

    await act(async () => {
      await result.current.markRead("2026-09-02T00:00:00Z");
    });

    expect(qc.getQueryData(READ_KEY)).toBe("2026-09-02T00:00:00Z");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-02T00:00:00Z"));
    expect(handle.client.rpc).toHaveBeenCalledWith("mark_space_read", { p_space_id: "space-1" });
  });

  it("defaults the cursor to now", async () => {
    handle.on("community_space_members:select", () => ({
      data: { last_read_at: "2026-09-01T10:00:00Z" },
      error: null,
    }));
    const { result } = renderState("space-1");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-01T10:00:00Z"));

    const before = Date.now();
    await act(async () => {
      await result.current.markRead();
    });

    await waitFor(() => expect(result.current.lastReadAt).not.toBeNull());
    const written = new Date(result.current.lastReadAt!).getTime();
    expect(written).toBeGreaterThanOrEqual(before);
    expect(written).toBeLessThanOrEqual(Date.now());
  });

  it("rolls the optimistic value back and reconciles when the RPC is refused", async () => {
    let readAt = "2026-09-01T10:00:00Z";
    handle.on("community_space_members:select", () => ({
      data: { last_read_at: readAt },
      error: null,
    }));
    handle.client.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { result, qc } = renderState("space-1");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-01T10:00:00Z"));

    // The server value moves between the write and the refetch, so the final
    // cache can only hold it if the rollback actually refetched.
    readAt = "2026-09-03T00:00:00Z";
    await act(async () => {
      await result.current.markRead("2026-09-02T00:00:00Z");
    });

    expect(qc.getQueryData(READ_KEY)).toBe("2026-09-03T00:00:00Z");
    await waitFor(() => expect(result.current.lastReadAt).toBe("2026-09-03T00:00:00Z"));
  });

  it("does nothing without a space", async () => {
    const { result } = renderState(null);
    await act(async () => {
      await result.current.markRead();
    });
    expect(handle.client.rpc).not.toHaveBeenCalled();
  });
});
