import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { initServerErrorReporting, reportServerError } from "./lib/server-error-reporter";
import { renderErrorPage } from "./lib/error-page";
import { addSecurityHeaders, securityErrorResponse } from "./lib/security-headers";
import { renderRobots, renderSitemap } from "./lib/sitemap";
import { isNoIndexPath } from "./lib/seo";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

initServerErrorReporting();

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
function addNoIndexHeader(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isTransientConnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === "ECONNRESET" ||
    error.message === "aborted" ||
    (error.cause instanceof Error && isTransientConnError(error.cause))
  );
}

async function normalizeCatastrophicSsrResponse(
  response: Response,
  path: string,
): Promise<Response> {
  if (response.status < 500) return addSecurityHeaders(response);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return addSecurityHeaders(response);

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return addSecurityHeaders(response);
  }

  // ECONNRESET / "aborted" fires when Vite tears down the SSR module for an
  // HMR reload while a request is in flight — a transient dev-mode event, not
  // a real server error. Skip the noisy logging + telemetry so logs stay clean.
  const captured = consumeLastCapturedError();
  if (isTransientConnError(captured)) return securityErrorResponse(renderErrorPage());

  const reportedError = captured ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(reportedError);
  void reportServerError(reportedError, { path });
  return securityErrorResponse(renderErrorPage());
}

/** Constant-time string comparison, so the secret can't be guessed by timing. */
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * The daily GitHub refresh (scheduled by pg_cron, migration
 * 20261007140000): fresh repo snapshots for every linked project and every
 * crew's GitHub organisation. Requires `Authorization: Bearer
 * $GITHUB_REFRESH_SECRET`; without that variable set, the endpoint doesn't
 * exist (404).
 */
async function githubRefreshCron(request: Request): Promise<Response> {
  const secret = process.env.GITHUB_REFRESH_SECRET?.trim();
  if (!secret) return new Response("Not found", { status: 404 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!sameSecret(given, secret)) return new Response("Unauthorized", { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { refreshAllGithub } = await import("./lib/github-refresh");
  const summary = await refreshAllGithub(supabaseAdmin);
  return new Response(JSON.stringify(summary), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      // Bot-only endpoints: let any layer (CDN, browser) cache briefly so
      // crawlers don't trigger three DB queries per hit. The sitemap itself is
      // additionally memoised in-memory for 15 min.
      const seoCacheControl = "public, max-age=900";
      if (url.pathname === "/sitemap.xml") {
        const sitemap = await renderSitemap(url.origin);
        return addSecurityHeaders(
          new Response(sitemap, {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": seoCacheControl,
            },
          }),
        );
      }
      if (url.pathname === "/api/cron/github-refresh") {
        return addSecurityHeaders(await githubRefreshCron(request));
      }
      if (url.pathname === "/robots.txt") {
        return addSecurityHeaders(
          new Response(renderRobots(url.origin), {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": seoCacheControl,
            },
          }),
        );
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response, url.pathname);
      return isNoIndexPath(url.pathname)
        ? addNoIndexHeader(normalizedResponse)
        : normalizedResponse;
    } catch (error) {
      console.error(error);
      void reportServerError(error, { path: new URL(request.url).pathname });
      const errorResponse = securityErrorResponse(renderErrorPage());
      return isNoIndexPath(new URL(request.url).pathname)
        ? addNoIndexHeader(errorResponse)
        : errorResponse;
    }
  },
};
