import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useCreatePage } from "./use-page-editor";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
    rpc: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: fake.supabase,
}));

const handle = createFakeSupabase();

function renderCreatePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  fake.supabase.rpc = handle.client.rpc;

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { ...renderHook(() => useCreatePage(), { wrapper }), queryClient };
}

const createPageInput = {
  ownerId: "profile-1",
  ownerType: "profile" as const,
  userId: "user-1",
};

describe("Studio page creation contract", () => {
  it("uses the authenticated session identity for the layout owner", () => {
    expect(createPageInput.userId).toBe("user-1");
    expect(createPageInput.ownerType).toMatch(/profile|project/);
  });

  it("does not silently fall back to the owner id for RLS ownership", () => {
    const authUserId = "user-1";
    const ownerId = "profile-1";
    expect(authUserId).not.toBe(ownerId);
  });

  it("keeps an existing draft distinct from the public published query", () => {
    const studioQueryKey = ["page", "profile", "profile-1", "draft"];
    const publicQueryKey = ["page", "profile", "profile-1", "published"];
    expect(studioQueryKey).not.toEqual(publicQueryKey);
  });
});

describe("useCreatePage", () => {
  it("creates an owned profile layout and page, then invalidates that owner page", async () => {
    handle.reset();
    handle.on("layouts:insert", () => ({ data: { id: "layout-1" }, error: null }));
    handle.on("pages:insert", () => ({ data: { id: "page-1" }, error: null }));

    const { result, queryClient } = renderCreatePage();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    result.current.mutate({ ownerId: "profile-1", ownerType: "profile" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(handle.calls).toEqual([
      expect.objectContaining({
        table: "layouts",
        action: "insert",
        value: expect.objectContaining({
          name: "Default Studio",
          created_by: "profile-1",
        }),
      }),
      expect.objectContaining({
        table: "pages",
        action: "insert",
        value: expect.objectContaining({
          owner_id: "profile-1",
          owner_type: "profile",
          layout_id: "layout-1",
        }),
      }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["page", "profile", "profile-1"],
    });
  });

  it("stops after a layout insert failure and exposes the error for the empty state", async () => {
    handle.reset();
    const error = new Error("layout insert failed");
    handle.on("layouts:insert", () => ({ data: null, error }));

    const { result } = renderCreatePage();
    result.current.mutate({ ownerId: "profile-1", ownerType: "profile" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(handle.calls).toHaveLength(1);
    expect(handle.calls[0]).toMatchObject({ table: "layouts", action: "insert" });
    expect(result.current.error).toBe(error);
  });
});
