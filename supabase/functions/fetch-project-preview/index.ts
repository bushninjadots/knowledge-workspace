import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertPublicHost, classifyUrl, extractRepoTarget, type RepoTarget } from "./url-guard.ts";

/**
 * fetch-project-preview
 *
 * Returns preview metadata (title/description/logo/stars…) for a project URL.
 *
 * Security posture:
 * - every outbound request goes through `assertPublicHost` (scheme, port,
 *   literal-IP and hostname rules, plus DNS resolution requiring ALL resolved
 *   addresses to be public when a resolver is available)
 * - redirects are followed manually (max 3) and every hop is re-validated,
 *   so a public site cannot bounce us to an internal address
 * - response bodies are size-capped and every fetch has a timeout
 * - errors are logged server-side; clients only ever see generic messages
 */

const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 512 * 1024;

// ---------------------------------------------------------------------------
// CORS: reflect only origins on the Tethyr allowlist (never "*")
// ---------------------------------------------------------------------------

const SITE_ORIGIN = (Deno.env.get("SITE_URL") ?? "https://tethyr.com").replace(/\/$/, "");
const EXTRA_ORIGINS = (Deno.env.get("PREVIEW_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if ([SITE_ORIGIN, ...EXTRA_ORIGINS, ...DEV_ORIGINS].includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Guarded networking helpers
// ---------------------------------------------------------------------------

/** A/AAAA lookup when the runtime supports it; otherwise skip that phase. */
function getResolver() {
  if (typeof Deno.resolveDns !== "function") {
    console.error("fetch-project-preview: DNS API unavailable, static checks only");
    return null;
  }
  return async (hostname: string): Promise<string[]> => {
    const addresses: string[] = [];
    for (const type of ["A", "AAAA"] as const) {
      try {
        addresses.push(...(await Deno.resolveDns(hostname, type)).map(String));
      } catch {
        // Absent record type — the other one may still exist.
      }
    }
    return addresses;
  };
}

class GuardRejected extends Error {}

async function followPublicRedirects(
  initial: URL,
  init: RequestInit,
): Promise<{ status: number; contentType: string | null; res: Response }> {
  let current = initial;
  const resolve = getResolver();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = await assertPublicHost(current, resolve);
    if (!guard.ok) throw new GuardRejected(guard.reason);

    const res = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      try {
        await res.body?.cancel();
      } catch {
        // Body already consumed or unsupported — nothing to free.
      }
      if (!location) throw new GuardRejected("redirect-without-location");
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new GuardRejected("invalid-redirect-location");
      }
      if (next.protocol !== "https:" && next.protocol !== "http:") {
        throw new GuardRejected("redirect-scheme-not-http(s)");
      }
      current = next;
      continue;
    }

    return { status: res.status, contentType: res.headers.get("content-type"), res };
  }
  throw new GuardRejected("too-many-redirects");
}

/** Read at most `maxBytes` of the body, then stop pulling from the wire. */
async function readCapped(res: Response, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (received > maxBytes) {
      text = text.slice(0, maxBytes);
      try {
        await reader.cancel();
      } catch {
        // Already finished — ignore.
      }
      break;
    }
  }
  return text + decoder.decode();
}

// ---------------------------------------------------------------------------
// Preview builders
// ---------------------------------------------------------------------------

interface PreviewResult {
  name: string;
  description: string | null;
  platform: string;
  url: string;
  logo: string | null;
  stars?: number;
  language?: string | null;
  owner?: string | null;
}

function hostLabel(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

/** Graceful-degradation card used when a preview cannot be safely fetched. */
function stubPreview(url: URL, rawUrl: string): PreviewResult {
  return {
    name: hostLabel(url),
    description: null,
    platform: "other",
    url: rawUrl,
    logo: null,
  };
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

async function fetchRepoPreview(target: RepoTarget): Promise<PreviewResult | null> {
  const headers: Record<string, string> =
    target.platform === "github" ? { Accept: "application/vnd.github.v3+json" } : {};

  try {
    const { status, res } = await followPublicRedirects(new URL(target.api), { headers });
    if (status < 200 || status >= 300) return null;
    const data = JSON.parse(await readCapped(res)) as Record<string, unknown>;

    if (target.platform === "gitlab") {
      const owner = data.owner as Record<string, unknown> | undefined;
      return {
        name: asString(data.name) ?? "GitLab project",
        description: asString(data.description),
        platform: "gitlab",
        url: asString(data.web_url) ?? target.api,
        logo: asString(data.avatar_url),
        stars: typeof data.star_count === "number" ? data.star_count : undefined,
        language: null,
        owner: asString(owner?.username),
      };
    }

    const owner = data.owner as Record<string, unknown> | undefined;
    return {
      name: asString(data.name) ?? "Repository",
      description: asString(data.description),
      platform: target.platform,
      url: asString(data.html_url) ?? target.api,
      logo: asString(owner?.avatar_url),
      stars:
        typeof data.stargazers_count === "number"
          ? data.stargazers_count
          : typeof data.stars_count === "number"
            ? data.stars_count
            : undefined,
      language: asString(data.language),
      owner: asString(owner?.login),
    };
  } catch (err) {
    console.error(`fetch-project-preview: ${target.platform} API failed`, err);
    return null;
  }
}

async function fetchOpenGraph(url: URL, rawUrl: string): Promise<PreviewResult | null> {
  const staticCheck = classifyUrl(rawUrl);
  if (!staticCheck.ok) return null;

  try {
    const { status, contentType, res } = await followPublicRedirects(url, {
      headers: { "User-Agent": "Tethyr/1.0 (+https://tethyr.com)" },
    });

    const looksLikeHtml =
      (contentType?.includes("text/html") ?? false) ||
      (contentType?.includes("application/xhtml") ?? false);
    if (status < 200 || status >= 300 || !looksLikeHtml) return null;

    const html = await readCapped(res);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);

    return {
      name: ogTitle?.[1] ?? hostLabel(url),
      description: ogDesc?.[1] ?? null,
      platform: "website",
      url: rawUrl,
      logo: ogImage?.[1] ?? null,
    };
  } catch (err) {
    console.error("fetch-project-preview: Open Graph fetch failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const rawUrl = (body as Record<string, unknown>).url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Forge repos first (rich metadata), falling back to Open Graph, then to
    // a static stub so the client always gets a renderable preview card.
    const repoTarget = extractRepoTarget(url);
    let result: PreviewResult | null = null;
    if (repoTarget) result = await fetchRepoPreview(repoTarget);
    if (!result) result = await fetchOpenGraph(url, rawUrl);
    if (!result) result = stubPreview(url, rawUrl);

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-project-preview error:", err);
    return new Response(JSON.stringify({ error: "Failed to fetch preview" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
