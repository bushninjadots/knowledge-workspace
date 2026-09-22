import { buildContentSecurityPolicy, CSP_HEADER } from "./csp";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  // The strict, nonce-carrying policy is set per request by the CSP middleware
  // in src/start.ts. This only fills in the nonce-less fallback for responses
  // that never went through middleware: static error pages, /sitemap.xml,
  // /robots.txt, and the catch-all 500s in src/server.ts.
  if (!headers.has(CSP_HEADER)) {
    headers.set(CSP_HEADER, buildContentSecurityPolicy());
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function securityErrorResponse(body: string, status = 500): Response {
  return addSecurityHeaders(
    new Response(body, {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}
