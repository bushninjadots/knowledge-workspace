/**
 * Content Security Policy for SSR documents.
 *
 * The policy is built per request so inline scripts can carry a nonce instead
 * of relying on `'unsafe-inline'`. Three things have to agree on that nonce:
 *
 * 1. this module builds the header,
 * 2. `src/start.ts`'s CSP middleware generates it and passes it into the request
 *    context,
 * 3. TanStack reads it back out of `router.options.ssr.nonce` (set in
 *    `src/router.tsx` from `getGlobalStartContext()`) and stamps it on every
 *    script tag it renders — `Scripts`, `ScriptOnce`, and the SSR stream-barrier
 *    script. It also emits `<meta property="csp-nonce">` so the client router
 *    knows the nonce after hydration.
 *
 * Anything rendered by hand needs the nonce passed explicitly — today that is
 * only the theme bootstrap in `src/routes/__root.tsx`.
 *
 * `'unsafe-inline'` is kept in development (Vite injects HMR/React-refresh
 * inline scripts that no nonce covers) and in the fallback policy used for
 * responses that never went through the middleware (static error pages, sitemap,
 * robots). Since a wrong CSP silently breaks the app in production, the
 * fallback stays strict: a plumbing failure surfaces as a broken page in QA
 * rather than as a policy that is quietly not protecting anything.
 */

export const CSP_HEADER = "Content-Security-Policy";
/**
 * Development uses the report-only header: the strict policy is evaluated and
 * violations are logged, but Vite's dev-only inline scripts are not blocked.
 * That keeps the shipped policy visible (and wrong in an obvious way) while
 * editing, without breaking HMR.
 */
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

export const isDevelopment = import.meta.env.DEV === true || process.env.NODE_ENV === "development";

/** 128 bits of base64, per the CSP nonce grammar. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// `isDev` is only ever passed by tests: outside them it is the build's mode, so
// the two policies the app can actually serve (development and production) stay
// the only ones reachable in real requests.
export function buildContentSecurityPolicy(nonce?: string, isDev = isDevelopment): string {
  const scriptSrc = ["'self'"];
  if (nonce) {
    // Document response: inline scripts are covered by the nonce, so
    // 'unsafe-inline' must not be here — including in the development
    // report-only policy, whose whole job is to report what production would
    // block. ('unsafe-eval' stays in dev: Vite needs it.)
    scriptSrc.push(`'nonce-${nonce}'`);
  } else if (isDev) {
    // Fallback in dev: Vite's own inline scripts have no nonce, so nothing
    // would paint. Production's fallback stays strict (see the module comment).
    scriptSrc.push("'unsafe-inline'");
  }
  if (isDev) scriptSrc.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    // Sentry Replay uses a blob: worker for session recording; without
    // worker-src the browser falls back to script-src and blocks it.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http://localhost:54321 http://127.0.0.1:54321",
    // *.ingest.sentry.io + regional ingest hosts: without these, CSP silently
    // blocks every Sentry envelope and error tracking is dead in production.
    "connect-src 'self' http://localhost:54321 http://127.0.0.1:54321 ws://localhost:54321 ws://127.0.0.1:54321 wss://*.supabase.co https://*.supabase.co https://raw.githubusercontent.com https://api.github.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
    // Same-origin framing only: the Studio View's visitor preview embeds the
    // public page in an iframe. External embedding stays blocked, so this does
    // not weaken clickjacking protection.
    "frame-ancestors 'self'",
  ].join("; ");
}
