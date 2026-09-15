import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFollowUser, useUnfollowUser } from "./use-follow";
import { useTogglePostAction, POSTS_KEY, type PostWithAuthor } from "./use-community";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const handle = createFakeSupabase();
beforeEach(() => {
  handle.reset();
  fake.supabase.from = handle.client.from;
  fake.supabase.auth = handle.client.auth;
  fake.supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
});

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// --- Follow optimistic updates -------------------------------------------

describe("follow optimistic updates", () => {
  it("flips the cached follow status to true before the server responds", async () => {
    const qc = makeClient();
    qc.setQueryData(["follow-status", "target-1"], { isFollowing: false });
    // The insert never resolves during the assertion window — the cache must
    // already show the optimistic value.
    let resolveInsert: (v: unknown) => void = () => {};
    const pendingHandler = () =>
      new Promise((resolve) => {
        resolveInsert = resolve;
      });
    handle.on(
      "follows:insert",
      pendingHandler as unknown as () => { data: unknown; error: unknown },
    );

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate("target-1");
    });

    await waitFor(() =>
      expect(qc.getQueryData(["follow-status", "target-1"])).toEqual({ isFollowing: true }),
    );
    resolveInsert({ data: null, error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls the cached status back when the insert fails", async () => {
    const qc = makeClient();
    qc.setQueryData(["follow-status", "target-1"], { isFollowing: false });
    handle.on("follows:insert", () => ({
      data: null,
      error: { message: "row-level security violation" },
    }));

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate("target-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["follow-status", "target-1"])).toEqual({ isFollowing: false });
  });

  it("rolls the cached status back when unfollow fails", async () => {
    const qc = makeClient();
    qc.setQueryData(["follow-status", "target-1"], { isFollowing: true });
    handle.on("follows:delete", () => ({
      data: null,
      error: { message: "row-level security violation" },
    }));

    const { result } = renderHook(() => useUnfollowUser(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate("target-1");
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["follow-status", "target-1"])).toEqual({ isFollowing: true });
  });
});

// --- Post action optimistic updates ---------------------------------------

function seedPost(overrides: Partial<PostWithAuthor> = {}): PostWithAuthor {
  return {
    id: "post-1",
    author_id: "someone",
    space_id: null,
    created_at: "2026-09-01T00:00:00Z",
    author: {
      display_name: "Ada",
      handle: "ada",
      creator_title: "Creator",
      category: "General",
      avatar_url: null,
    },
    stats: {
      likes: 4,
      helpful: 0,
      saves: 0,
      offers: 0,
      comment_count: 0,
    },
    myActions: [],
    ...overrides,
  } as PostWithAuthor;
}

describe("post action optimistic updates", () => {
  const toggleInput = {
    postId: "post-1",
    action: "like" as const,
    currentUserId: "user-1",
    isActive: false,
  };

  it("increments the like count and records myAction across all feed caches", async () => {
    const qc = makeClient();
    // Infinite-page shape (main feed).
    qc.setQueryData(POSTS_KEY, {
      pages: [{ posts: [seedPost()], nextPage: null }],
      pageParams: [],
    });
    // Plain array shape (following feed).
    qc.setQueryData(["following-feed"], [seedPost()]);
    handle.on("post_actions:insert", () => ({ data: null, error: null }));

    const { result } = renderHook(() => useTogglePostAction(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate(toggleInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const paged = qc.getQueryData<{ pages: { posts: PostWithAuthor[] }[] }>(POSTS_KEY);
    expect(paged?.pages[0].posts[0].stats.likes).toBe(5);
    expect(paged?.pages[0].posts[0].myActions).toEqual(["like"]);

    const array = qc.getQueryData<PostWithAuthor[]>(["following-feed"]);
    expect(array?.[0].stats.likes).toBe(5);
    expect(array?.[0].myActions).toEqual(["like"]);
  });

  it("decrements the count and removes myAction on untoggle", async () => {
    const qc = makeClient();
    qc.setQueryData(POSTS_KEY, {
      pages: [{ posts: [seedPost({ myActions: ["like"] })], nextPage: null }],
      pageParams: [],
    });
    handle.on("post_actions:delete", () => ({ data: null, error: null }));

    const { result } = renderHook(() => useTogglePostAction(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate({ ...toggleInput, isActive: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const paged = qc.getQueryData<{ pages: { posts: PostWithAuthor[] }[] }>(POSTS_KEY);
    expect(paged?.pages[0].posts[0].stats.likes).toBe(3);
    expect(paged?.pages[0].posts[0].myActions).toEqual([]);
  });

  it("leaves other posts untouched", async () => {
    const qc = makeClient();
    qc.setQueryData(POSTS_KEY, {
      pages: [{ posts: [seedPost(), seedPost({ id: "post-2" })], nextPage: null }],
      pageParams: [],
    });
    handle.on("post_actions:insert", () => ({ data: null, error: null }));

    const { result } = renderHook(() => useTogglePostAction(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate(toggleInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const paged = qc.getQueryData<{ pages: { posts: PostWithAuthor[] }[] }>(POSTS_KEY);
    expect(paged?.pages[0].posts[1].stats.likes).toBe(4);
    expect(paged?.pages[0].posts[1].myActions).toEqual([]);
  });

  it("refetches on failure so the optimistic delta is rolled back", async () => {
    const qc = makeClient();
    qc.setQueryData(POSTS_KEY, {
      pages: [{ posts: [seedPost()], nextPage: null }],
      pageParams: [],
    });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    handle.on("post_actions:insert", () => ({
      data: null,
      error: { message: "row-level security violation" },
    }));

    const { result } = renderHook(() => useTogglePostAction(), { wrapper: makeWrapper(qc) });
    act(() => {
      result.current.mutate(toggleInput);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});
