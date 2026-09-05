import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSendMessage, useUnreadCounts, PAGE_SIZE } from "./use-messages";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// useSendMessage/useUnreadCounts only read the signed-in id, never the heavy
// profile payload — substitute a fixed identity instead of faking every query.
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ data: { userId: "user-1" } }),
}));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const handle = createFakeSupabase();

function renderHookWithClient<TReturn>(useHook: () => TReturn) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.rpc = handle.client.rpc;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

// --- useSendMessage ------------------------------------------------------

describe("useSendMessage", () => {
  it("inserts a trimmed body with the connection and current user", async () => {
    const { result } = renderHookWithClient(() => useSendMessage("conn-1"));

    await act(async () => {
      await result.current.mutateAsync("  hello there  ");
    });

    const insert = handle.calls.find((c) => c.table === "messages" && c.action === "insert");
    expect(insert?.value).toEqual({
      connection_id: "conn-1",
      sender_id: "user-1",
      body: "hello there",
      project_id: null,
    });
  });

  it("passes the project id through when sending from a project thread", async () => {
    const { result } = renderHookWithClient(() => useSendMessage("conn-1", "proj-9"));

    await act(async () => {
      await result.current.mutateAsync("let's sync");
    });

    const insert = handle.calls.find((c) => c.table === "messages" && c.action === "insert");
    expect(insert?.value).toMatchObject({ project_id: "proj-9", body: "let's sync" });
  });

  it("rejects whitespace-only bodies before touching the database", async () => {
    const { result } = renderHookWithClient(() => useSendMessage("conn-1"));

    await act(async () => {
      await expect(result.current.mutateAsync("   \n ")).rejects.toThrow("Message can't be empty");
    });

    expect(handle.calls).toEqual([]);
  });

  it("refuses to send before a connection is ready and surfaces the DB error otherwise", async () => {
    handle.on("messages:insert", () => ({
      data: null,
      error: { code: "42501", message: "row-level security" },
    }));

    const { result } = renderHookWithClient(() => useSendMessage(null));
    await act(async () => {
      await expect(result.current.mutateAsync("hi")).rejects.toThrow("Not ready");
    });

    const { result: result2 } = renderHookWithClient(() => useSendMessage("conn-1"));
    await act(async () => {
      await expect(result2.current.mutateAsync("hi")).rejects.toMatchObject({
        message: "row-level security",
      });
    });
  });

  it("prepends an optimistic row to the thread while the write is in flight", async () => {
    handle.on("messages:insert", () => ({ data: null, error: null }));

    const { result, qc } = renderHookWithClient(() => useSendMessage("conn-1"));
    qc.setQueryData(["messages", "conn-1"], {
      pages: [[{ id: "m-1", connection_id: "conn-1", sender_id: "other", body: "older" }]],
      pageParams: [null],
    });

    await act(async () => {
      await result.current.mutateAsync("optimistic me");
    });

    const state = qc.getQueryData<{ pages: unknown[][] }>(["messages", "conn-1"]);
    const firstRow = state!.pages[0][0] as { id: string; body: string };
    expect(firstRow.id.startsWith("optimistic-")).toBe(true);
    expect(firstRow.body).toBe("optimistic me");
  });

  it("has a sane page size matching the infinite-query limit", () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

// --- useUnreadCounts -----------------------------------------------------

describe("useUnreadCounts", () => {
  it("aggregates the RPC result into per-connection counts and a total", async () => {
    handle.client.rpc.mockResolvedValueOnce({
      data: [
        { connection_id: "conn-1", unread_count: 3 },
        { connection_id: "conn-2", unread_count: 7 },
        { connection_id: "conn-3", unread_count: 1 },
      ],
      error: null,
    });

    const { result } = renderHookWithClient(() => useUnreadCounts());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(handle.client.rpc).toHaveBeenCalledWith("unread_message_counts");
    expect(result.current.data).toEqual({
      byConnection: { "conn-1": 3, "conn-2": 7, "conn-3": 1 },
      total: 11,
    });
  });

  it("surfaces RPC failures instead of silently showing zero unread", async () => {
    handle.client.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });

    const { result } = renderHookWithClient(() => useUnreadCounts());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
