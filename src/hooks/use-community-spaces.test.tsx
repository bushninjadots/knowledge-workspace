import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useJoinSpace, useLeaveSpace } from "./use-community-spaces";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
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
  fake.supabase.auth = handle.client.auth;
  fake.supabase.rpc = handle.client.rpc;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...renderHook(useHook, { wrapper }), qc };
}

beforeEach(() => handle.reset());

describe("useJoinSpace", () => {
  it("inserts a member row for the signed-in user and invalidates the spaces list", async () => {
    const { result, qc } = renderHookWithClient(() => useJoinSpace());
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync("space-1");
    });

    expect(handle.calls).toEqual([
      {
        table: "community_space_members",
        action: "insert",
        value: { space_id: "space-1", user_id: "user-1", role: "member" },
      },
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["community-spaces"] });
  });

  it("treats a duplicate membership as success so the UI stays joined", async () => {
    handle.on("community_space_members:insert", () => ({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }));
    const { result } = renderHookWithClient(() => useJoinSpace());

    await act(async () => {
      await result.current.mutateAsync("space-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("surfaces a real failure so the membership button can roll back", async () => {
    handle.on("community_space_members:insert", () => ({
      data: null,
      error: { code: "42501", message: "row-level security" },
    }));
    const { result } = renderHookWithClient(() => useJoinSpace());

    await act(async () => {
      await expect(result.current.mutateAsync("space-1")).rejects.toMatchObject({
        message: "row-level security",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useLeaveSpace", () => {
  it("deletes the caller's member row and invalidates the spaces list", async () => {
    const { result, qc } = renderHookWithClient(() => useLeaveSpace());
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    await act(async () => {
      await result.current.mutateAsync("space-1");
    });

    expect(handle.calls).toEqual([
      { table: "community_space_members", action: "delete", value: undefined },
    ]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["community-spaces"] });
  });

  it("reports failures instead of silently showing the user as left", async () => {
    handle.on("community_space_members:delete", () => ({
      data: null,
      error: { code: "42501", message: "not permitted" },
    }));
    const { result } = renderHookWithClient(() => useLeaveSpace());

    await act(async () => {
      await expect(result.current.mutateAsync("space-1")).rejects.toMatchObject({
        message: "not permitted",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("refuses to act when there is no session", async () => {
    handle.client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { result } = renderHookWithClient(() => useLeaveSpace());

    await act(async () => {
      await expect(result.current.mutateAsync("space-1")).rejects.toThrow("Not authenticated");
    });

    expect(handle.calls).toEqual([]);
  });
});
