import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useApplyTemplate } from "./use-templates";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

function renderApplyTemplate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  fake.supabase.rpc = handle.client.rpc;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(() => useApplyTemplate(), { wrapper });
}

describe("useApplyTemplate", () => {
  it("applies to the signed-in member's profile Studio when no destination is passed", async () => {
    handle.reset();
    handle.on("pages:select", () => ({
      data: { id: "page-1", layout_id: "layout-1" },
      error: null,
    }));
    handle.on("layouts:select", () => ({
      data: { sections: [{ id: "section-1", blocks: [] }], theme_id: null },
      error: null,
    }));
    handle.on("layouts:update", () => ({ data: null, error: null }));
    handle.client.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderApplyTemplate();
    result.current.mutate({ templateId: "template-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const layoutUpdate = handle.calls.find(
      (call) => call.table === "layouts" && call.action === "update",
    );
    expect(layoutUpdate?.value).toEqual({
      sections: [{ id: "section-1", blocks: [] }],
    });
    expect(fake.supabase.from).toHaveBeenCalledWith("pages");
    expect(fake.supabase.from).toHaveBeenCalledWith("layouts");
  });
});
