import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useFollowStatus,
  useFollowers,
  useFollowing,
  useFollowUser,
  useUnfollowUser,
  useFollowingFeed,
} from "./use-follow";
import { createFakeSupabase } from "../../tests/helpers/fake-supabase";

// --- Mocks ---------------------------------------------------------------

const fake = vi.hoisted(() => ({
  supabase: {} as {
    from: ReturnType<typeof vi.fn>;
    auth: { getUser: ReturnType<typeof vi.fn> };
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: fake.supabase }));

const missingTableError = {
  code: "42P01",
  message: 'Could not find the table "follows" in the schema cache',
};

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

function followCalls() {
  return handle.calls.filter((c) => c.table === "follows");
}

function mockUnauthenticated() {
  fake.supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
}

function restoreAuthenticated() {
  fake.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
}

// --- useFollowStatus ------------------------------------------------------

describe("useFollowStatus", () => {
  it("reports following when a row exists", async () => {
    handle.on("follows:select", () => ({ data: [{ follower_id: "user-1" }], error: null }));
    const { result } = renderHookWithClient(() => useFollowStatus("target-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ isFollowing: true });
    expect(followCalls()).toEqual([
      { table: "follows", action: "select", projection: "follower_id" },
    ]);
  });

  it("reports not following when no row exists", async () => {
    handle.on("follows:select", () => ({ data: null, error: null }));
    const { result } = renderHookWithClient(() => useFollowStatus("target-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ isFollowing: false });
  });

  it("returns not-following when unauthenticated (no DB call)", async () => {
    mockUnauthenticated();
    const { result } = renderHookWithClient(() => useFollowStatus("target-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ isFollowing: false });
    expect(followCalls()).toHaveLength(0);
    restoreAuthenticated();
  });

  it("degrades to not-following when the table is missing (42P01)", async () => {
    handle.on("follows:select", () => ({ data: null, error: missingTableError }));
    const { result } = renderHookWithClient(() => useFollowStatus("target-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ isFollowing: false });
  });
});

// --- useFollowers / useFollowing -------------------------------------------

describe("useFollowers", () => {
  it("lists followers ordered by recency", async () => {
    handle.on("follows:select", () => ({
      data: [
        { follower_id: "u1", created_at: "2026-09-01T00:00:00Z" },
        { follower_id: "u2", created_at: "2026-08-01T00:00:00Z" },
      ],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useFollowers("me-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].follower_id).toBe("u1");
    expect(followCalls()).toEqual([
      { table: "follows", action: "select", projection: "follower_id, created_at" },
    ]);
  });

  it("degrades to an empty list when the table is missing", async () => {
    handle.on("follows:select", () => ({ data: null, error: missingTableError }));
    const { result } = renderHookWithClient(() => useFollowers("me-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useFollowing", () => {
  it("lists who a user follows", async () => {
    handle.on("follows:select", () => ({
      data: [{ following_id: "maya", created_at: "2026-09-01T00:00:00Z" }],
      error: null,
    }));
    const { result } = renderHookWithClient(() => useFollowing("u1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { following_id: "maya", created_at: "2026-09-01T00:00:00Z" },
    ]);
    expect(followCalls()).toEqual([
      { table: "follows", action: "select", projection: "following_id, created_at" },
    ]);
  });
});

// --- useFollowUser / useUnfollowUser ---------------------------------------

describe("useFollowUser", () => {
  it("rejects when unauthenticated", async () => {
    mockUnauthenticated();
    const { result } = renderHookWithClient(() => useFollowUser());
    await act(async () => {
      await expect(result.current.mutateAsync("target-1")).rejects.toThrow("Not authenticated");
    });
    expect(followCalls()).toHaveLength(0);
    restoreAuthenticated();
  });

  it("inserts the follow row and invalidates follow status + feed", async () => {
    handle.on("follows:insert", () => ({ data: {}, error: null }));
    const { result, qc } = renderHookWithClient(() => useFollowUser());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync("target-1");
    });
    expect(followCalls()).toEqual([
      {
        table: "follows",
        action: "insert",
        value: { follower_id: "user-1", following_id: "target-1" },
      },
    ]);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(
      expect.arrayContaining([["follow-status", "target-1"], ["following-feed"]]),
    );
  });

  it("surfaces DB errors", async () => {
    handle.on("follows:insert", () => ({ data: null, error: { message: "insert blocked" } }));
    const { result } = renderHookWithClient(() => useFollowUser());
    await act(async () => {
      await expect(result.current.mutateAsync("target-1")).rejects.toThrow("insert blocked");
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUnfollowUser", () => {
  it("deletes the follow row and invalidates follow status + feed", async () => {
    handle.on("follows:delete", () => ({ data: null, error: null }));
    const { result, qc } = renderHookWithClient(() => useUnfollowUser());
    const spy = vi.spyOn(qc, "invalidateQueries");
    await act(async () => {
      await result.current.mutateAsync("target-1");
    });
    expect(followCalls()).toEqual([{ table: "follows", action: "delete" }]);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey).filter(Boolean);
    expect(keys).toEqual(
      expect.arrayContaining([["follow-status", "target-1"], ["following-feed"]]),
    );
  });

  it("rejects when unauthenticated", async () => {
    mockUnauthenticated();
    const { result } = renderHookWithClient(() => useUnfollowUser());
    await act(async () => {
      await expect(result.current.mutateAsync("target-1")).rejects.toThrow("Not authenticated");
    });
    expect(followCalls()).toHaveLength(0);
    restoreAuthenticated();
  });
});

// --- useFollowingFeed ------------------------------------------------------

describe("useFollowingFeed", () => {
  it("returns an empty feed when unauthenticated", async () => {
    mockUnauthenticated();
    const { result } = renderHookWithClient(() => useFollowingFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(handle.calls).toHaveLength(0);
    restoreAuthenticated();
  });

  it("returns an empty feed when the user follows nobody", async () => {
    handle.on("follows:select", () => ({ data: [], error: null }));
    const { result } = renderHookWithClient(() => useFollowingFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("builds a feed with author, stats, my actions and comment counts", async () => {
    handle.on("follows:select", () => ({ data: [{ following_id: "author-1" }], error: null }));
    handle.on("posts:select", () => ({
      data: [
        { id: "p1", author_id: "author-1", space_id: null, created_at: "2026-09-01T00:00:00Z" },
      ],
      error: null,
    }));
    handle.on("profiles:select", () => ({
      data: [
        {
          id: "author-1",
          display_name: "Ada",
          handle: "ada",
          creator_title: "Creator",
          category: "General",
          avatar_url: null,
        },
      ],
      error: null,
    }));
    handle.on("post_actions:select", () => ({
      data: [
        { post_id: "p1", action: "like", user_id: "user-1" },
        { post_id: "p1", action: "like", user_id: "someone" },
        { post_id: "p1", action: "helpful", user_id: "someone-else" },
      ],
      error: null,
    }));
    handle.on("comments:select", () => ({
      data: [{ post_id: "p1" }, { post_id: "p1" }],
      error: null,
    }));

    const { result } = renderHookWithClient(() => useFollowingFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const feed = result.current.data ?? [];
    expect(feed).toHaveLength(1);
    const [post] = feed;
    expect(post.id).toBe("p1");
    expect(post.author).toMatchObject({ handle: "ada", display_name: "Ada" });
    expect(post.stats).toEqual({ likes: 2, helpful: 1, saves: 0, offers: 0, comment_count: 2 });
    expect(post.myActions).toEqual(["like"]);
  });

  it("falls back to a placeholder author when the profile is missing", async () => {
    handle.on("follows:select", () => ({ data: [{ following_id: "ghost" }], error: null }));
    handle.on("posts:select", () => ({
      data: [{ id: "p9", author_id: "ghost", space_id: null, created_at: "2026-09-01T00:00:00Z" }],
      error: null,
    }));
    handle.on("profiles:select", () => ({ data: [], error: null }));

    const { result } = renderHookWithClient(() => useFollowingFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const feed = result.current.data ?? [];
    expect(feed).toHaveLength(1);
    expect(feed[0].author).toMatchObject({
      display_name: "Unknown",
      handle: "unknown",
      creator_title: "Member",
      category: "General",
    });
    expect(feed[0].stats).toEqual({ likes: 0, helpful: 0, saves: 0, offers: 0, comment_count: 0 });
    expect(feed[0].myActions).toEqual([]);
  });

  it("degrades to an empty feed when the follows table is missing", async () => {
    handle.on("follows:select", () => ({ data: null, error: missingTableError }));
    const { result } = renderHookWithClient(() => useFollowingFeed());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
