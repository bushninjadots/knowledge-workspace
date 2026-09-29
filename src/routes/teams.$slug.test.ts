// ── /teams/$slug route surface ────────────────────────────────────────────────
// Pins the two-null contract for the crew route loader:
//
//   fetchTeamData resolving null = the crew does not exist (a fact) → the
//   loader throws notFound() and the router answers a real 404.
//
//   The catalog being unreadable (missing env on a key-free smoke runner,
//   a Supabase outage) = an outage → the loader degrades to a soft 200 and
//   the page renders its own states. Same contract as the profile, skills,
//   and project routes: every public route must answer for crawlers even
//   when its catalog is down.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => from(...a) },
}));

import { Route } from "./teams.$slug";

const routeOptions = Route.options as unknown as {
  loader: (ctx: {
    params: { slug: string };
    context: { queryClient: QueryClient };
  }) => Promise<unknown>;
};

function chain(result: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    in: () => q,
    maybeSingle: () => Promise.resolve({ data: result, error: null }),
  };
  return q;
}

beforeEach(() => {
  from.mockReset();
});

describe("/teams/$slug loader degradation", () => {
  it("resolves the team name on the happy path", async () => {
    from.mockImplementation((table: string) => {
      if (table === "teams") {
        return chain({ id: "t1", slug: "threadline-crew", name: "Threadline Crew" });
      }
      // Members / projects / profiles reads — empty is fine for the name.
      return chain([]);
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data = (await routeOptions.loader({
      params: { slug: "threadline-crew" },
      context: { queryClient: client },
    })) as { teamName: string | null };

    expect(data.teamName).toBe("Threadline Crew");
  });

  it("throws notFound when the crew does not exist — a fact, so a real 404", async () => {
    // fetchTeamData resolves null ONLY for a missing row. Throwing notFound
    // here (not in the page component) is what makes the router answer a
    // real 404 — a page-level throw only errors the SSR render and falls
    // back to client rendering with a 200.
    from.mockImplementation((table: string) => {
      if (table === "teams") return chain(null);
      return chain([]);
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(
      routeOptions.loader({
        params: { slug: "ghost-crew" },
        context: { queryClient: client },
      }),
    ).rejects.toThrow();
  });

  it("resolves null — never throws — when the roster read fails", async () => {
    from.mockImplementation(() => {
      throw new Error("Missing Supabase environment variable(s)");
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data = await routeOptions.loader({
      params: { slug: "any" },
      context: { queryClient: client },
    });

    expect(data).toEqual({ teamName: null });
  });
});
