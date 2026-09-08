import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("@/integrations/supabase/client", () => fake);

import { fetchPostEngagement } from "./post-engagement";

describe("fetchPostEngagement", () => {
  beforeEach(() => {
    fake.supabase.rpc.mockReset();
    fake.supabase.from.mockReset();
    fake.supabase.auth.getUser.mockReset();
  });

  it("uses the aggregate RPC and preserves per-post stats and actions", async () => {
    fake.supabase.rpc.mockResolvedValue({
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

    const result = await fetchPostEngagement(["post-1"]);

    expect(fake.supabase.rpc).toHaveBeenCalledWith("post_engagement_counts", {
      p_post_ids: ["post-1"],
    });
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

    expect(fake.supabase.rpc).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });
});
