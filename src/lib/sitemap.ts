import { NO_INDEX_PATHS } from "./seo";

type SitemapEntry = {
  path: string;
  lastModified?: string | null;
};

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
  if (process.env.NODE_ENV === "production") {
    throw new Error("VITE_PUBLIC_SITE_URL must be configured in production");
  }
  return requestOrigin.replace(/\/+$/, "");
}

function entryXml(origin: string, entry: SitemapEntry) {
  const lastModified = entry.lastModified
    ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>`
    : "";
  return `  <url><loc>${escapeXml(`${origin}${entry.path}`)}</loc>${lastModified}</url>`;
}

export async function renderSitemap(requestOrigin: string) {
  const origin = publicOrigin(requestOrigin);
  // Core static indexable routes — everything else in the sitemap is dynamic
  // (profiles, projects, skills) and resolved below.
  const entries: SitemapEntry[] = [
    { path: "/", lastModified: new Date().toISOString().slice(0, 10) },
  ];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: projects }, { data: skills }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("handle, updated_at")
        .not("handle", "is", null)
        .limit(1000),
      supabaseAdmin
        .from("projects")
        .select("id, updated_at")
        .eq("visibility", "public")
        .limit(1000),
      supabaseAdmin.from("skills").select("slug, created_at").not("slug", "is", null).limit(1000),
    ]);

    for (const profile of profiles ?? []) {
      if (profile.handle) {
        entries.push({
          path: `/u/${encodeURIComponent(profile.handle)}`,
          lastModified: profile.updated_at,
        });
      }
    }
    for (const project of projects ?? []) {
      if (project.id) {
        entries.push({
          path: `/projects/${encodeURIComponent(project.id)}`,
          lastModified: project.updated_at,
        });
      }
    }
    for (const skill of skills ?? []) {
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
