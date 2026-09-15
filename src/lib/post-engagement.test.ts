import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deliberately faithful to supabase-js: `rpc` reads `this.rest`, so detaching
 * it into a local and calling that throws. A plain `vi.fn()` on a plain object
 * accepts a detached call, which is how `const rpc = sb.rpc; await rpc(...)`
 * shipped and silently emptied every post-backed surface. With this mock, any
 * regression to a detached call fails the "does not fall back" assertions.
 */
const fake = vi.hoisted(() => {
  const rpcImpl = {
    fn: (..._args: unknown[]) => Promise.resolve({ data: null, error: null }),
  };
  const supabase = {
    rest: {},
    rpc(this: { rest?: unknown } | undefined, ...args: unknown[]) {
      if (!this?.rest) {
        throw new TypeError("Cannot read properties of undefined (reading 'rest')");
      }
      return rpcImpl.fn(...args);
    },
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  };
  return { supabase, rpcImpl };
});

vi.mock("@/integrations/supabase/client", () => fake);

import { fetchPostEngagement } from "./post-engagement";

describe("fetchPostEngagement", () => {
  beforeEach(() => {
    fake.rpcImpl.fn = vi.fn().mockResolvedValue({ data: null, error: null });
    fake.supabase.from.mockReset();
    fake.supabase.auth.getUser.mockReset();
  });

  it("uses the aggregate RPC and preserves per-post stats and actions", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          post_id: "post-1",
          likes: 4,
          helpful: 2,
          saves: 1,
          offers: 0,
          comment_count: 3,
          user_actions: ["like", "save"],
        },
      ],
      error: null,
    });
    fake.rpcImpl.fn = rpc;

    const result = await fetchPostEngagement(["post-1"]);

    expect(rpc).toHaveBeenCalledWith("post_engagement_counts", { p_post_ids: ["post-1"] });
    // If the call were detached it would throw, get caught, and land here.
    expect(fake.supabase.from).not.toHaveBeenCalled();
    expect(result.get("post-1")).toEqual({
      likes: 4,
      helpful: 2,
      saves: 1,
      offers: 0,
      comment_count: 3,
      myActions: ["like", "save"],
    });
  });

  it("avoids a request for an empty post set", async () => {
    const result = await fetchPostEngagement([]);

    expect(fake.rpcImpl.fn).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it("falls back to direct selects when the aggregate RPC errors", async () => {
    fake.rpcImpl.fn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "function does not exist" },
    });
    fake.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "me" } } });

    const actions = [
      { post_id: "post-1", action: "like", user_id: "someone" },
      { post_id: "post-1", action: "save", user_id: "me" },
    ];
    fake.supabase.from.mockImplementation((table: string) => ({
      select: () => ({
        in: () =>
          Promise.resolve({ data: table === "post_actions" ? actions : [{ post_id: "post-1" }] }),
      }),
    }));

    const result = await fetchPostEngagement(["post-1"]);

    expect(fake.supabase.from).toHaveBeenCalledWith("post_actions");
    expect(result.get("post-1")).toEqual({
      likes: 1,
      helpful: 0,
      saves: 1,
      offers: 0,
      comment_count: 1,
      myActions: ["save"],
    });
  });

  it("falls back when the RPC itself throws", async () => {
    // A throwing transport must degrade to the direct reads, not reject the
    // caller's whole query.
    fake.rpcImpl.fn = vi.fn().mockRejectedValue(new Error("network down"));
    fake.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "me" } } });
    fake.supabase.from.mockImplementation(() => ({
      select: () => ({ in: () => Promise.resolve({ data: [] }) }),
    }));

    const result = await fetchPostEngagement(["post-1"]);

    expect(result.get("post-1")?.likes).toBe(0);
  });
});
