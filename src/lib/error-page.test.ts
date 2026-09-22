import { describe, it, expect } from "vitest";
import { renderErrorPage } from "@/lib/error-page";

/**
 * The static error page is served with the nonce-less fallback CSP
 * (`script-src 'self'`, see src/lib/csp.ts), so it cannot use inline event
 * handlers or inline scripts — they would be blocked and the page would render
 * dead. It previously did exactly that (`onclick="location.reload()"`), which
 * only surfaced once the fallback dropped 'unsafe-inline'.
 */
describe("renderErrorPage", () => {
  const html = renderErrorPage();

  it("uses no inline event handlers or scripts", () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("offers a reload as a link to the current URL", () => {
    expect(html).toContain('<a class="primary" href="">Try again</a>');
    expect(html).toContain('<a class="secondary" href="/">Go home</a>');
  });

  it("stays a self-contained document with inline styles", () => {
    // style-src keeps 'unsafe-inline', so the <style> block is fine and the
    // page must not depend on the app's stylesheet (it is served without one).
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain('<html lang="en">');
    expect(html).toMatch(/<meta charset="utf-8"\s*\/?>/);
  });
});
