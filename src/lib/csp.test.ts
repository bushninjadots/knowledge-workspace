import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy, generateNonce } from "@/lib/csp";
import { addSecurityHeaders } from "@/lib/security-headers";

/**
 * The policy is what stands between an inline-script XSS and the app, and it is
 * invisible to every other gate in this repo: typecheck, lint, unit tests, and
 * the dev server (which serves it report-only) all stay green if the nonce
 * silently disappears or `'unsafe-inline'` creeps back. These pin the four
 * policies the app can serve and the header-preservation rule that keeps
 * `src/server.ts` from overwriting the per-request one.
 */
describe("buildContentSecurityPolicy", () => {
  const scriptSrc = (policy: string) =>
    policy.split("; ").find((directive) => directive.startsWith("script-src")) ?? "";

  it("keeps production's nonce-less fallback strict", () => {
    const policy = buildContentSecurityPolicy(undefined, false);
    expect(scriptSrc(policy)).toBe("script-src 'self'");
  });

  it("carries the nonce and no 'unsafe-inline' in production", () => {
    const policy = buildContentSecurityPolicy("abc123", false);
    expect(scriptSrc(policy)).toBe("script-src 'self' 'nonce-abc123'");
    expect(policy).not.toContain("'unsafe-inline' 'nonce");
    expect(scriptSrc(policy)).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("keeps 'unsafe-inline' and 'unsafe-eval' in the development fallback", () => {
    // Vite's HMR client and React-refresh preamble are inline and nonce-less, so
    // the dev fallback has to allow them or nothing paints.
    const policy = buildContentSecurityPolicy(undefined, true);
    expect(scriptSrc(policy)).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("leaves 'unsafe-inline' out of the development report-only policy", () => {
    // The report-only policy exists to predict production; allowing inline there
    // would silence exactly the violations it is meant to report.
    const policy = buildContentSecurityPolicy("abc123", true);
    expect(scriptSrc(policy)).toBe("script-src 'self' 'nonce-abc123' 'unsafe-eval'");
    expect(scriptSrc(policy)).not.toContain("'unsafe-inline'");
  });

  it("keeps every non-script directive", () => {
    // Each of these was added for a concrete failure (Sentry Replay's blob
    // worker, Sentry ingest, Google Fonts, the Studio preview iframe).
    const policy = buildContentSecurityPolicy("abc123", false);
    for (const directive of [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'self'",
    ])
      expect(policy).toContain(directive);
    expect(policy).toContain("https://*.ingest.sentry.io");
    expect(policy).toContain("https://*.supabase.co");
  });
});

describe("generateNonce", () => {
  it("is 128 bits of base64 and never repeats", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(atob(nonce)).toHaveLength(16);
    }
  });
});

describe("addSecurityHeaders", () => {
  it("adds the nonce-less fallback when the response has no policy", () => {
    const response = addSecurityHeaders(new Response("ok", { status: 200 }));
    expect(response.headers.get("Content-Security-Policy")).toBe(buildContentSecurityPolicy());
  });

  it("does not overwrite a policy set earlier in the request", () => {
    // src/start.ts sets the nonce policy before src/server.ts wraps the
    // response; overwriting it here would strip the nonce from every document.
    const perRequest = buildContentSecurityPolicy("abc123", false);
    const response = addSecurityHeaders(
      new Response("ok", { headers: { "Content-Security-Policy": perRequest } }),
    );
    expect(response.headers.get("Content-Security-Policy")).toBe(perRequest);
  });

  it("still sets the other security headers alongside a per-request policy", () => {
    const response = addSecurityHeaders(
      new Response("ok", {
        headers: { "Content-Security-Policy": buildContentSecurityPolicy("abc123", false) },
      }),
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });
});
