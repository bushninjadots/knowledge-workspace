import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NO_INDEX_PATHS } from "@/lib/seo";

/**
 * These two endpoints are bot-only, unauthenticated, and drive what search
 * engines are allowed to see, yet nothing exercised them. The pagination case
 * is the one with a real failure mode: PostgREST caps a request at 1000 rows,
 * so a bare `.limit(1000)` silently drops every later page — the sitemap keeps
 * returning 200 while losing most of the site's URLs.
 */
const h = vi.hoisted(() => {
  const state = {
    /** Rows to hand back per table, one entry per awaited query. */
    queues: {} as Record<string, { data: unknown[] | null; error: unknown }[]>,
    queries: [] as string[],
  };
  const builder = (table: string) => {
    const chain = {
      select: () => chain,
      not: () => chain,
      eq: () => chain,
      gt: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (resolve: (value: unknown) => unknown) => {
        state.queries.push(table);
        const next = state.queues[table]?.shift() ?? { data: [], error: null };
        return resolve(next);
      },
    };
    return chain;
  };
  return { state, admin: { from: (table: string) => builder(table) } };
});

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: h.admin }));

const { state } = h;

async function importSitemap() {
  // The module memoises its body for 15 minutes, so each test needs a fresh
  // module instance rather than a fresh clock.
  vi.resetModules();
  return import("@/lib/sitemap");
}

beforeEach(() => {
  state.queues = {};
  state.queries = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("renderRobots", () => {
  it("disallows every noindex path and points at the sitemap", async () => {
    const { renderRobots } = await importSitemap();
    const body = renderRobots("https://tethyr.app/");

    expect(body).toContain("User-agent: *");
    expect(body).toContain("Allow: /");
    for (const path of NO_INDEX_PATHS) expect(body, path).toContain(`Disallow: ${path}`);
    expect(body).toContain("Sitemap: https://tethyr.app/sitemap.xml");
  });

  it("prefers the configured public site URL over the request origin", async () => {
    const { renderRobots } = await importSitemap();
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://public.test/");
    expect(renderRobots("https://internal.test")).toContain(
      "Sitemap: https://public.test/sitemap.xml",
    );
  });

  it("falls back to the request origin instead of failing", async () => {
    const { renderRobots } = await importSitemap();
    expect(renderRobots("http://127.0.0.1:3000")).toContain(
      "Sitemap: http://127.0.0.1:3000/sitemap.xml",
    );
  });
});

describe("renderSitemap", () => {
  it("includes the static routes and one entry per profile, project, and skill", async () => {
    state.queues = {
      profiles: [{ data: [{ handle: "maya", updated_at: "2026-09-01T00:00:00Z" }], error: null }],
      projects: [{ data: [{ id: "p-1", updated_at: null }], error: null }],
      skills: [{ data: [{ slug: "typescript", created_at: "2026-08-01T00:00:00Z" }], error: null }],
    };

    const { renderSitemap } = await importSitemap();
    const xml = await renderSitemap("https://tethyr.app");

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://tethyr.app/</loc>");
    expect(xml).toContain("<loc>https://tethyr.app/skills</loc>");
    expect(xml).toContain("<loc>https://tethyr.app/u/maya</loc>");
    expect(xml).toContain("<lastmod>2026-09-01T00:00:00Z</lastmod>");
    expect(xml).toContain("<loc>https://tethyr.app/projects/p-1</loc>");
    expect(xml).toContain("<loc>https://tethyr.app/skills/typescript</loc>");
    // A row with no updated_at gets no lastmod rather than an empty element.
    expect(xml).not.toContain("<lastmod></lastmod>");
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("keeps the whole table when a table spans more than one page", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      handle: `user-${String(i).padStart(4, "0")}`,
      updated_at: null,
    }));
    state.queues = {
      profiles: [
        { data: firstPage, error: null },
        { data: [{ handle: "zz-last", updated_at: null }], error: null },
      ],
      projects: [{ data: [], error: null }],
      skills: [{ data: [], error: null }],
    };

    const { renderSitemap } = await importSitemap();
    const xml = await renderSitemap("https://tethyr.app");

    // The 1001st row is exactly what a single capped request loses.
    expect(xml).toContain("<loc>https://tethyr.app/u/user-0000</loc>");
    expect(xml).toContain("<loc>https://tethyr.app/u/user-0999</loc>");
    expect(xml).toContain("<loc>https://tethyr.app/u/zz-last</loc>");
    expect(state.queries.filter((table) => table === "profiles")).toHaveLength(2);
  });

  it("escapes the origin so the document stays well-formed XML", async () => {
    state.queues = {};
    const { renderSitemap } = await importSitemap();
    const xml = await renderSitemap("https://tethyr.app?a=1&b=<x>");
    expect(xml).toContain("<loc>https://tethyr.app?a=1&amp;b=&lt;x&gt;/</loc>");
  });

  it("degrades to the static routes when Supabase is unavailable", async () => {
    state.queues = {
      profiles: [{ data: null, error: new Error("connection refused") }],
      projects: [],
      skills: [],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { renderSitemap } = await importSitemap();
    const xml = await renderSitemap("https://tethyr.app");

    expect(xml).toContain("<loc>https://tethyr.app/</loc>");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("serves a cached body within the TTL", async () => {
    state.queues = {
      profiles: [{ data: [{ handle: "maya", updated_at: null }], error: null }],
      projects: [{ data: [], error: null }],
      skills: [{ data: [], error: null }],
    };

    const { renderSitemap } = await importSitemap();
    const first = await renderSitemap("https://tethyr.app");
    const queriesAfterFirst = state.queries.length;
    const second = await renderSitemap("https://tethyr.app");

    expect(second).toBe(first);
    // Regenerating per request would burn three queries per bot hit on a
    // crawler-facing endpoint.
    expect(state.queries.length).toBe(queriesAfterFirst);
  });
});
