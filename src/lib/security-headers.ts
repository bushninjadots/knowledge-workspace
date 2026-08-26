const isDevelopment = import.meta.env.DEV === true || process.env.NODE_ENV === "development";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Sentry Replay uses a blob: worker for session recording; without
    // worker-src the browser falls back to script-src and blocks it.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http://localhost:54321 http://127.0.0.1:54321",
    // *.ingest.sentry.io + regional ingest hosts: without these, CSP silently
    // blocks every Sentry envelope and error tracking is dead in production.
    "connect-src 'self' http://localhost:54321 http://127.0.0.1:54321 ws://localhost:54321 ws://127.0.0.1:54321 wss://*.supabase.co https://*.supabase.co https://raw.githubusercontent.com https://api.github.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
    "frame-ancestors 'none'",
  ].join("; "),
};

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
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
