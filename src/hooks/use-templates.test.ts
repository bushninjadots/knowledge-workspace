import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { useForkTemplate, usePublicTemplates } from "./use-templates";
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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );
}

beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  fake.supabase.rpc = handle.client.rpc;
  handle.client.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
});

describe("usePublicTemplates", () => {
  it("maps layout rows into templates and joins creator profiles", async () => {
    handle.on("layouts:select", () => ({
      data: [
        {
          id: "tpl-1",
          name: "Night Bench",
          description: "A dark, quiet layout.",
          category: "minimal",
          sections: [{ id: "s1", blocks: [] }],
          theme_id: "theme-1",
          created_by: "creator-1",
          usage_count: 12,
          fork_count: 3,
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [{ id: "creator-1", handle: "wren", display_name: "Wren" }],
      error: null,
    }));

    const { result } = renderHook(() => usePublicTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const templates = result.current.data!;
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "tpl-1",
      name: "Night Bench",
      creatorHandle: "wren",
      creatorDisplayName: "Wren",
      isMine: false,
      usageCount: 12,
      forkCount: 3,
    });
  });

  it("marks the member's own rows as mine", async () => {
    handle.on("layouts:select", () => ({
      data: [
        {
          id: "tpl-2",
          name: "Mine",
          sections: [],
          created_by: "user-1",
          usage_count: 0,
          fork_count: 0,
          updated_at: "2026-09-01T00:00:00Z",
        },
      ],
      error: null,
    }));
    handle.on("profiles:select", () => ({ data: [], error: null }));

    const { result } = renderHook(() => usePublicTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].isMine).toBe(true);
  });
});

describe("useForkTemplate", () => {
  it("copies the template, records the fork, and bumps the parent count", async () => {
    handle.on("layouts:select", () => ({
      data: {
        name: "Night Bench",
        description: null,
        category: "minimal",
        sections: [{ id: "s1", blocks: [] }],
        theme_id: null,
      },
      error: null,
    }));
    handle.on("layouts:insert", () => ({ data: { id: "fork-1" }, error: null }));
    handle.on("forks:insert", () => ({ data: null, error: null }));
    handle.client.rpc.mockResolvedValue({ data: null, error: null });

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const fork = renderHook(() => useForkTemplate(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    });

    fork.result.current.mutate({ templateId: "tpl-1", templateName: "Night Bench" });

    await waitFor(() => expect(fork.result.current.isSuccess).toBe(true));

    expect(handle.calls).toEqual([
      {
        table: "layouts",
        action: "select",
        projection: "name, description, category, sections, theme_id",
      },
      {
        table: "layouts",
        action: "insert",
        projection: "id",
        value: expect.objectContaining({ is_template: false }),
      },
      {
        table: "forks",
        action: "insert",
        value: expect.objectContaining({ parent_layout_id: "tpl-1" }),
      },
    ]);
    expect(handle.client.rpc).toHaveBeenCalledWith("increment_fork_count", { layout_id: "tpl-1" });
  });

  it("fails cleanly when the template no longer exists", async () => {
    handle.on("layouts:select", () => ({ data: null, error: null }));

    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const fork = renderHook(() => useForkTemplate(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    });

    fork.result.current.mutate({ templateId: "gone", templateName: "Gone" });
    await waitFor(() => expect(fork.result.current.isError).toBe(true));
  });
});
