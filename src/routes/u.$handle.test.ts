// ── /u/$handle route surface ──────────────────────────────────────────────────
// Pins the route's two load-bearing contracts, both invisible to the type
// system and both shipped broken at least once:
//
//   1. Graceful degradation. The loader must resolve (not throw) when the
//      profile is unreadable — a key-free smoke runner or a Supabase outage
//      renders the page's own fallback states at 200, never a 500. This is
//      the same contract the sitemap's static fallback and the skills route
//      follow; it is what keeps every profile route reachable for crawlers.
//
//   2. The `embed` search contract. validateSearch is the boundary between
//      the URL string and the app's booleans, and z.coerce.boolean() is
//      Boolean() on the raw value — so the STRING "false" coerced to TRUE
//      and a bookmarked /u/x?embed=false rendered embed mode (chrome
//      stripped): the exact opposite of what the URL says.
//
// These tests import the real Route options — no router, no mocked search —
// so the validateSearch and head functions are exercised exactly as shipped.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: unknown[]) => from(...a),
    // fetchPublicProfile signs banner/avatar/background images alongside the
    // profile read; the storage mock resolves to null URLs so the row itself
    // is what each test varies.
    storage: {
      from: () => ({
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: null } }),
        createSignedUrls: () => Promise.resolve({ data: [] }),
      }),
    },
  },
}));

import { Route } from "./u.$handle";
import { fetchPublicProfile } from "./-u.$handle-data";

// Route.options is a heavily generic type; the test shapes only the three
// members it exercises, via unknown as the compiler suggests.
const routeOptions = Route.options as unknown as {
  loader: (ctx: {
    params: { handle: string };
    context: { queryClient: QueryClient };
  }) => Promise<unknown>;
  validateSearch: { parse: (search: Record<string, unknown>) => { embed?: boolean } };
  head: (ctx: { loaderData: unknown; params: { handle: string } }) => {
    meta: { title?: string; property?: string; content?: string }[];
  };
};

// Route.options exposes validateSearch as the raw Zod schema (the router
// parses internally). Parsing it directly exercises the exact contract the
// URL string crosses — no router needed.
const parseSearch = (search: Record<string, unknown>) => routeOptions.validateSearch.parse(search);

function chain(result: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: () => Promise.resolve({ data: result, error: null }),
  };
  return q;
}

beforeEach(() => {
  from.mockReset();
});

describe("/u/$handle loader degradation", () => {
  it("resolves to the profile on the happy path", async () => {
    // Implementation-based, not once-based: the route module's import chain
    // is alive in this test file, and any import-time query would silently
    // eat a once-mock and fail the profile read.
    from.mockImplementation((table: string) => {
      if (table !== "profiles") throw new Error(`unexpected table: ${table}`);
      return chain({
        id: "p1",
        handle: "priya",
        display_name: "Priya Nair",
        bio: "hi",
        background: null,
        public_background: null,
        banner_url: null,
        avatar_url: null,
      });
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data = (await routeOptions.loader({
      params: { handle: "priya" },
      context: { queryClient: client },
    })) as { profile: { handle: string } } | null;

    expect(data?.profile.handle).toBe("priya");
  });

  it("resolves null — never throws — when the profile fetch fails", async () => {
    // The client throws inside the queryFn (missing env, RLS error, outage…).
    from.mockImplementation(() => {
      throw new Error("Missing Supabase environment variable(s)");
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data = await routeOptions.loader({
      params: { handle: "ghost" },
      context: { queryClient: client },
    });

    expect(data).toBeNull();
  });

  it("re-throws notFound — a missing person is a 404, not a soft 200", async () => {
    // fetchPublicProfile throws notFound() for a handle with no row. The
    // degradation catch must pass that through: swallowing it turned every
    // bad handle into a 200 that renders an empty identity page.
    from.mockImplementation(() => {
      throw notFound();
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(
      routeOptions.loader({
        params: { handle: "never-existed" },
        context: { queryClient: client },
      }),
    ).rejects.toThrow();
  });
});

describe("/u/$handle validateSearch", () => {
  it("treats an absent param as undefined (component defaults it to false)", () => {
    expect(parseSearch({})).toEqual({});
  });

  it("parses embed=true as boolean true", () => {
    expect(parseSearch({ embed: "true" }).embed).toBe(true);
  });

  it("parses the string 'false' as boolean false — not Boolean('false')", () => {
    const parsed = parseSearch({ embed: "false" });
    expect(parsed.embed).toBe(false);
  });

  it("ignores junk embed values instead of failing the page", () => {
    // A throw here is a 500 for anyone opening a mangled share link; junk
    // must simply never switch embed mode on.
    expect(parseSearch({ embed: "maybe" }).embed).toBeUndefined();
  });
});

describe("/u/$handle head() social metadata", () => {
  it("names the person from the loaded profile", () => {
    const head = routeOptions.head({
      loaderData: {
        profile: { handle: "priya", display_name: "Priya Nair", bio: "Clean interfaces." },
      },
      params: { handle: "priya" },
    });
    const title = head.meta.find((m) => m.title)?.title;
    expect(title).toBe("Priya Nair (@priya) — Tethyr");
  });

  it("falls back to the handle — never a double-@ — when the profile is null", () => {
    const head = routeOptions.head({ loaderData: null, params: { handle: "priya" } });
    const title = head.meta.find((m) => m.title)?.title;
    expect(title).toBe("@priya — Tethyr");
  });

  it("leads the share description with the bio when present", () => {
    const head = routeOptions.head({
      loaderData: {
        profile: { handle: "priya", display_name: "Priya Nair", bio: "Clean interfaces." },
      },
      params: { handle: "priya" },
    });
    const ogDesc = head.meta.find((m) => m.property === "og:description")?.content;
    expect(ogDesc).toBe("Clean interfaces.");
  });

  it("stays under the ~160-char crawl limit for a long bio", () => {
    const longBio = "x".repeat(300);
    const head = routeOptions.head({
      loaderData: { profile: { handle: "priya", display_name: "Priya", bio: longBio } },
      params: { handle: "priya" },
    });
    const ogDesc = head.meta.find((m) => m.property === "og:description")?.content;
    expect(ogDesc).toBe(`${"x".repeat(157)}…`);
  });
});

// fetchPublicProfile is imported for its side effect of pinning the mock
// wiring to the same module the loader uses — and to keep the import honest
// if the data module's export surface changes.
void fetchPublicProfile;
void ({} as ReactNode);
