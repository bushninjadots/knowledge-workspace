import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useLibraryItems,
  useLibrarySearch,
  useCreateItem,
  useUpdateItem,
  useToggleFavorite,
  useTogglePin,
  useDeleteItem,
  useCreateCollection,
  useAddTagToItem,
  useRemoveTagFromItem,
  libraryKeys,
} from "./use-library";
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

function libraryCalls() {
  return handle.calls.filter((c) => c.table === "library_items");
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    user_id: "user-1",
    title: "My note",
    content: "Hello",
    type: "note",
    collection_id: null,
    url: null,
    file_url: null,
    file_type: null,
    file_size: null,
    thumbnail_url: null,
    is_pinned: false,
    is_favorite: false,
    project_id: null,
    reading_progress: 0,
    content_format: "html",
    github_source: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("useLibraryItems", () => {
  it("lists items and normalizes content_format + github_source", async () => {
    handle.on("library_items:select", () => ({
      data: [
        item({
          content_format: "markdown",
          github_source: { repo: "a/b", path: "README.md" },
        }),
        item({
          id: "i2",
          content_format: "weird",
          github_source: "not-an-object",
        }),
      ],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useLibraryItems());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({
      content_format: "markdown",
      github_source: { repo: "a/b", path: "README.md", branch: null },
    });
    // Unrecognized formats fall back to html; invalid github_source becomes null.
    expect(result.current.data?.[1]).toMatchObject({
      content_format: "html",
      github_source: null,
    });
  });

  it("returns an empty list when there are no items", async () => {
    handle.on("library_items:select", () => ({ data: [], error: null }));
    const { result } = renderHookWithClient(() => useLibraryItems());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces query errors", async () => {
    handle.on("library_items:select", () => ({
      data: null,
      error: { message: "select blocked" },
    }));
    const { result } = renderHookWithClient(() => useLibraryItems());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useLibrarySearch", () => {
  it("runs the search only once the query has two characters", async () => {
    handle.on("library_items:select", () => ({
      data: [item({ id: "hit", title: "React hooks" })],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useLibrarySearch("re"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe("hit");
    expect(libraryCalls()).toHaveLength(1);
  });

  it("does not query while the search is below the minimum length", async () => {
    handle.on("library_items:select", () => ({ data: [], error: null }));
    renderHookWithClient(() => useLibrarySearch("r"));
    await act(async () => {});
    expect(libraryCalls()).toHaveLength(0);
  });
});

describe("useCreateItem", () => {
  it("inserts with sensible defaults and invalidates the item list", async () => {
    handle.on("library_items:insert", () => ({ data: item(), error: null }));
    const { result, qc } = renderHookWithClient(() => useCreateItem());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({ title: "Draft" });
    });
    expect(libraryCalls()).toEqual([
      {
        table: "library_items",
        action: "insert",
        value: {
          user_id: "user-1",
          title: "Draft",
          content: "",
          type: "note",
          collection_id: null,
          project_id: null,
          url: null,
        },
      },
    ]);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(expect.arrayContaining([libraryKeys.items()]));
  });
});

describe("useUpdateItem", () => {
  it("updates only the changed fields and invalidates item queries", async () => {
    handle.on("library_items:update", () => ({ data: item(), error: null }));
    const { result, qc } = renderHookWithClient(() => useUpdateItem());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync({ id: "i1", title: "Renamed", is_pinned: true });
    });
    expect(libraryCalls()).toEqual([
      { table: "library_items", action: "update", value: { title: "Renamed", is_pinned: true } },
    ]);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(expect.arrayContaining([libraryKeys.items(), libraryKeys.item("i1")]));
  });
});

describe("useToggleFavorite / useTogglePin", () => {
  it("toggles favorite and pin with the given value", async () => {
    handle.on("library_items:update", () => ({ data: null, error: null }));
    const fav = renderHookWithClient(() => useToggleFavorite());
    await act(async () => {
      await fav.result.current.mutateAsync({ id: "i1", is_favorite: true });
    });
    const pin = renderHookWithClient(() => useTogglePin());
    await act(async () => {
      await pin.result.current.mutateAsync({ id: "i1", is_pinned: true });
    });
    expect(libraryCalls()).toEqual([
      { table: "library_items", action: "update", value: { is_favorite: true } },
      { table: "library_items", action: "update", value: { is_pinned: true } },
    ]);
  });
});

describe("useDeleteItem", () => {
  it("deletes the item by id", async () => {
    handle.on("library_items:delete", () => ({ data: null, error: null }));
    const { result } = renderHookWithClient(() => useDeleteItem());
    await act(async () => {
      await result.current.mutateAsync("i1");
    });
    expect(libraryCalls()).toEqual([{ table: "library_items", action: "delete" }]);
  });
});

describe("useCreateCollection", () => {
  it("places a new collection after the current max position", async () => {
    handle.on("library_collections:select", () => ({
      data: [{ position: 3 }],
      error: null,
    }));
    handle.on("library_collections:insert", () => ({ data: {}, error: null }));
    const { result } = renderHookWithClient(() => useCreateCollection());
    await act(async () => {
      await result.current.mutateAsync({ name: "Reading" });
    });
    const insert = handle.calls.find(
      (c) => c.table === "library_collections" && c.action === "insert",
    );
    expect(insert?.value).toMatchObject({
      user_id: "user-1",
      name: "Reading",
      icon: "folder",
      position: 4,
    });
  });

  it("starts at position 0 when no collections exist", async () => {
    handle.on("library_collections:select", () => ({ data: [], error: null }));
    handle.on("library_collections:insert", () => ({ data: {}, error: null }));
    const { result } = renderHookWithClient(() => useCreateCollection());
    await act(async () => {
      await result.current.mutateAsync({ name: "First" });
    });
    const insert = handle.calls.find(
      (c) => c.table === "library_collections" && c.action === "insert",
    );
    expect(insert?.value).toMatchObject({ position: 0 });
  });
});

describe("tag linking", () => {
  it("adds and removes tag links and invalidates items", async () => {
    handle.on("library_item_tags:insert", () => ({ data: null, error: null }));
    handle.on("library_item_tags:delete", () => ({ data: null, error: null }));
    const add = renderHookWithClient(() => useAddTagToItem());
    const addSpy = vi.spyOn(add.qc, "invalidateQueries");
    await act(async () => {
      await add.result.current.mutateAsync({ item_id: "i1", tag_id: "t1" });
    });
    expect(
      handle.calls.filter((c) => c.table === "library_item_tags" && c.action === "insert"),
    ).toEqual([
      {
        table: "library_item_tags",
        action: "insert",
        value: { item_id: "i1", tag_id: "t1" },
      },
    ]);
    const addKeys = addSpy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(addKeys).toEqual(expect.arrayContaining([libraryKeys.items()]));

    const remove = renderHookWithClient(() => useRemoveTagFromItem());
    const removeSpy = vi.spyOn(remove.qc, "invalidateQueries");
    await act(async () => {
      await remove.result.current.mutateAsync({ item_id: "i1", tag_id: "t1" });
    });
    expect(
      handle.calls.filter((c) => c.table === "library_item_tags" && c.action === "delete"),
    ).toHaveLength(1);
    const removeKeys = removeSpy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(removeKeys).toEqual(expect.arrayContaining([libraryKeys.items()]));
  });
});
