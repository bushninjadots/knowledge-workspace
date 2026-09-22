import { NO_INDEX_PATHS } from "./seo";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SitemapEntry = {
  path: string;
  lastModified?: string | null;
};

const PAGE_SIZE = 1000;

type AdminClient = SupabaseClient<Database>;

/**
 * PostgREST silently caps a single request at 1000 rows, so a bare
 * `.limit(1000)` loses everything past the cap once the table grows. Follow
 * keyset pagination on the ordering column until a short page ends the stream.
 */
async function pageProfiles(admin: AdminClient) {
  const out: { handle: string; updated_at: string | null }[] = [];
  let last: string | null = null;
  for (;;) {
    let q = admin
      .from("profiles")
      .select("handle, updated_at")
      .not("handle", "is", null)
      .order("handle")
      .limit(PAGE_SIZE);
    if (last) q = q.gt("handle", last);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as { handle: string; updated_at: string | null }[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    last = rows[rows.length - 1].handle;
  }
  return out;
}

async function pageProjects(admin: AdminClient) {
  const out: { id: string; updated_at: string | null }[] = [];
  let last: string | null = null;
  for (;;) {
    let q = admin
      .from("projects")
      .select("id, updated_at")
      .eq("visibility", "public")
      .order("id")
      .limit(PAGE_SIZE);
    if (last) q = q.gt("id", last);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as { id: string; updated_at: string | null }[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    last = rows[rows.length - 1].id;
  }
  return out;
}

async function pageSkills(admin: AdminClient) {
  const out: { slug: string; created_at: string | null }[] = [];
  let last: string | null = null;
  for (;;) {
    let q = admin
      .from("skills")
      .select("slug, created_at")
      .not("slug", "is", null)
      .order("slug")
      .limit(PAGE_SIZE);
    if (last) q = q.gt("slug", last);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as { slug: string; created_at: string | null }[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    last = rows[rows.length - 1].slug;
  }
  return out;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character] ?? character;
  });
}

function normalizeOrigin(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || undefined;
}

function publicOrigin(requestOrigin: string) {
  const configuredOrigin = normalizeOrigin(process.env.VITE_PUBLIC_SITE_URL);
  if (configuredOrigin) return configuredOrigin;
  // Fall back to the request origin so a missing/blank VITE_PUBLIC_SITE_URL
  // degrades to per-request absolute URLs instead of a hard 500 on every
  // SEO endpoint (sitemap.xml / robots.txt).
  if (requestOrigin) return requestOrigin.replace(/\/+$/, "");
  throw new Error("VITE_PUBLIC_SITE_URL must be configured in production");
}

function entryXml(origin: string, entry: SitemapEntry) {
  const lastModified = entry.lastModified
    ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
    : "";
  return `  <url><loc>${escapeXml(`${origin}${entry.path}`)}</loc>${lastModified}</url>`;
}

// The sitemap hits three Supabase queries (≤1000 rows each); regenerating it
// on every request burns DB cycles on a bot-only endpoint. Cache for 15 min —
// fresh enough for crawlers, and lastmod comes from row updated_at anyway.
const SITEMAP_TTL_MS = 15 * 60 * 1000;
let sitemapCache: { body: string; at: number } | undefined;

export async function renderSitemap(requestOrigin: string) {
  const origin = publicOrigin(requestOrigin);
  if (sitemapCache && Date.now() - sitemapCache.at < SITEMAP_TTL_MS) return sitemapCache.body;
  const body = await buildSitemap(origin);
  sitemapCache = { body, at: Date.now() };
  return body;
}

async function buildSitemap(origin: string) {
  // Core static indexable routes — everything else in the sitemap is dynamic
  // (profiles, projects, skills) and resolved below.
  const entries: SitemapEntry[] = [
    { path: "/", lastModified: new Date().toISOString().slice(0, 10) },
    { path: "/skills", lastModified: new Date().toISOString().slice(0, 10) },
  ];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Keyset-paginated so the sitemap keeps working past PostgREST's 1000-row
    // per-request cap instead of silently dropping entries.
    const [profiles, projects, skills] = await Promise.all([
      pageProfiles(supabaseAdmin),
      pageProjects(supabaseAdmin),
      pageSkills(supabaseAdmin),
    ]);

    for (const profile of profiles) {
      if (profile.handle) {
        entries.push({
          path: `/u/${encodeURIComponent(profile.handle)}`,
          lastModified: profile.updated_at,
        });
      }
    }
    for (const project of projects) {
      if (project.id) {
        entries.push({
          path: `/projects/${encodeURIComponent(project.id)}`,
          lastModified: project.updated_at,
        });
      }
    }
    for (const skill of skills) {
      if (skill.slug) {
        entries.push({
          path: `/skills/${encodeURIComponent(skill.slug)}`,
          lastModified: skill.created_at,
        });
      }
    }
  } catch (error) {
    // Sitemap availability must not depend on Supabase credentials or uptime.
    console.warn("Unable to add dynamic sitemap entries", error);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => entryXml(origin, entry)),
    "</urlset>",
  ].join("\n");
}

export function renderRobots(requestOrigin: string) {
  const origin = publicOrigin(requestOrigin);
  // Disallow rules derive from the same NO_INDEX_PATHS constant that drives
  // the X-Robots-Tag header — one list to keep in sync.
  const disallows = NO_INDEX_PATHS.map((path) => `Disallow: ${path}`);
  return ["User-agent: *", "Allow: /", ...disallows, `Sitemap: ${origin}/sitemap.xml`, ""].join(
    "\n",
  );
}
