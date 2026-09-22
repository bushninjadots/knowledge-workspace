import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { addSecurityHeaders } from "./lib/security-headers";
import { reportServerError } from "./lib/server-error-reporter";
import {
  buildContentSecurityPolicy,
  CSP_HEADER,
  CSP_REPORT_ONLY_HEADER,
  generateNonce,
  isDevelopment,
} from "./lib/csp";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Per-request Content Security Policy. The nonce is generated here, put on the
 * response, and passed down through the request context so the router stamps it
 * on the scripts it renders (see src/lib/csp.ts). Middleware runs outside the
 * SSR render, so a response that fails before the context exists — and every
 * non-document route below — falls back to the nonce-less policy in
 * `addSecurityHeaders`.
 *
 * Only GET gets the nonce: server-function POSTs and asset requests render no
 * HTML, and a nonce must never be reused across responses.
 */
const cspMiddleware = createMiddleware().server(({ next, request }) => {
  if (request.method !== "GET") return next();

  const nonce = generateNonce();
  setResponseHeader(
    isDevelopment ? CSP_REPORT_ONLY_HEADER : CSP_HEADER,
    buildContentSecurityPolicy(nonce),
  );

  return next({ context: { nonce } });
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    void reportServerError(error, { handler: "start-middleware" });
    return addSecurityHeaders(
      new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
  }
});

// Block cross-site requests to server functions (CSRF). Server functions are
// same-origin RPC endpoints — including the GitHub-token ones — so a malicious
// site must not be able to fire them while riding on a victim's auth cookie.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  // CSP first: every later stage (auth attach, CSRF, routes) runs with the
  // request's nonce already in the context.
  requestMiddleware: [cspMiddleware, csrfMiddleware, errorMiddleware],
}));
