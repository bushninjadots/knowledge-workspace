import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { addSecurityHeaders, securityErrorResponse } from "./lib/security-headers";
import { renderRobots, renderSitemap } from "./lib/sitemap";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

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
const NO_INDEX_PATHS = [
  "/dashboard",
  "/explore",
  "/library",
  "/profile",
  "/messages",
  "/notifications",
  "/sessions",
  "/community",
  "/challenges",
  "/spaces",
  "/login",
  "/signup",
  "/reset-password",
];

function shouldNoIndex(pathname: string) {
  return NO_INDEX_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function addNoIndexHeader(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return addSecurityHeaders(response);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return addSecurityHeaders(response);

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return addSecurityHeaders(response);
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return securityErrorResponse(renderErrorPage());
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/sitemap.xml") {
        const sitemap = await renderSitemap(url.origin);
        return addSecurityHeaders(
          new Response(sitemap, {
            headers: { "content-type": "application/xml; charset=utf-8" },
          }),
        );
      }
      if (url.pathname === "/robots.txt") {
        return addSecurityHeaders(
          new Response(renderRobots(url.origin), {
            headers: { "content-type": "text/plain; charset=utf-8" },
          }),
        );
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return shouldNoIndex(url.pathname)
        ? addNoIndexHeader(normalizedResponse)
        : normalizedResponse;
    } catch (error) {
      console.error(error);
      const errorResponse = securityErrorResponse(renderErrorPage());
      return shouldNoIndex(new URL(request.url).pathname)
        ? addNoIndexHeader(errorResponse)
        : errorResponse;
    }
  },
};
