// Tethyr QA: Content Security Policy plumbing (dev tool, not shipped).
// Usage: node scripts/qa-csp.mjs [--base http://localhost:3000]
//
// The production policy forbids inline script without a nonce, so a page that
// loses the nonce — the theme bootstrap in __root.tsx, or a framework script
// TanStack renders — silently stops working in production while dev (which
// keeps 'unsafe-inline') stays green. This asserts the plumbing end to end in a
// real browser:
//
//   1. the response carries a nonce-bearing policy (enforcing in production,
//      report-only in dev, where Vite's inline scripts have no nonce),
//   2. every inline script the app/framework renders carries that same nonce,
//   3. the client router learned the nonce (<meta property="csp-nonce">), and
//   4. every CSP violation the browser reported is a nonce-less dev-only script
//      — i.e. nothing that *should* have been allowed was blocked,
//   5. no markup depends on inline event handlers, which no nonce can cover.
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
// A production runtime must enforce the nonce policy; dev serves it report-only
// so Vite's dev-only scripts are not blocked. Pass --require-enforced when
// pointing this at a built server.
const REQUIRE_ENFORCED = process.argv.includes("--require-enforced");

const PAGES = [
  ["landing", "/"],
  ["skills", "/skills"],
  ["public-studio", "/u/maya"],
  ["login", "/login"],
  ["terms", "/terms"],
];

const STYLE_TAGLESS = "script:not([src])";
const INLINE_HANDLER_ATTRS = [
  "onclick",
  "onload",
  "onerror",
  "onsubmit",
  "onchange",
  "oninput",
  "onfocus",
  "onblur",
  "onmouseover",
  "onkeydown",
];

const failures = [];

async function check(page, name, url) {
  const violations = [];
  // Report-only violations surface as console errors in Chrome, but the type
  // has varied, so match the message text instead of trusting the level.
  const onConsole = (msg) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text().slice(0, 200));
  };
  page.on("console", onConsole);

  // A dev-server reload (Vite re-optimizing dependencies on a cold start)
  // re-renders the document with a fresh nonce, so the header that matters is
  // the last document response, not the first navigation.
  let lastDocument = null;
  const onResponse = (r) => {
    if (r.request().resourceType() === "document") lastDocument = r;
  };
  page.on("response", onResponse);

  await page.goto(`${BASE}${url}`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  const headers = lastDocument ? await lastDocument.allHeaders() : {};
  const enforced = headers["content-security-policy"] ?? "";
  const reportOnly = headers["content-security-policy-report-only"] ?? "";
  // The nonce-bearing policy is the strict one; the nonce-less policy is the
  // documented fallback for responses that bypass middleware.
  const strict = /nonce-/.test(enforced) ? enforced : reportOnly;
  const enforcing = /nonce-/.test(enforced);

  const nonce = /'nonce-([^']+)'/.exec(strict)?.[1];
  if (!nonce) failures.push(`${name}: no nonce in the CSP header (${enforced || reportOnly})`);
  if (strict && /script-src[^;]*'unsafe-inline'/.test(strict))
    failures.push(`${name}: strict policy still allows 'unsafe-inline' for script-src`);
  if (REQUIRE_ENFORCED && !enforcing)
    failures.push(`${name}: the nonce policy is not enforcing (report-only)`);

  const dom = await page.evaluate(
    ({ styleTagless, handlerAttrs }) => {
      const scripts = [...document.querySelectorAll(styleTagless)];
      const inline = scripts.filter((s) => s.type !== "application/ld+json");
      const withNonce = inline.filter((s) => /^[A-Za-z0-9+/=]+$/.test(s.nonce) && s.nonce);
      const withoutNonce = inline.filter((s) => !s.nonce);
      const handlers = [
        ...document.querySelectorAll(handlerAttrs.map((a) => `[${a}]`).join(",")),
      ].map((el) => `${el.tagName.toLowerCase()}[${handlerAttrs.find((a) => el.hasAttribute(a))}]`);
      return {
        inline: inline.length,
        withNonce: withNonce.length,
        withoutNonce: withoutNonce.length,
        devScripts: withoutNonce.map((s) => (s.textContent || "").slice(0, 60)),
        handlers,
        metaNonce: document.querySelector('meta[property="csp-nonce"]')?.content ?? null,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      };
    },
    { styleTagless: STYLE_TAGLESS, handlerAttrs: INLINE_HANDLER_ATTRS },
  );

  // React deliberately keeps the nonce out of the DOM attribute (it renders
  // through the IDL property so page CSS cannot read it), so read `.nonce`.
  const nonces = await page.evaluate(
    ({ styleTagless }) =>
      [...document.querySelectorAll(styleTagless)]
        .filter((s) => s.type !== "application/ld+json")
        .map((s) => s.nonce),
    { styleTagless: STYLE_TAGLESS },
  );

  if (dom.inline === 0) failures.push(`${name}: no inline scripts rendered at all`);
  if (!nonces.includes(nonce))
    failures.push(`${name}: no inline script carries the header nonce ${nonce}`);
  const mismatched = nonces.filter((n) => n && n !== nonce);
  if (mismatched.length)
    failures.push(`${name}: ${mismatched.length} inline script(s) carry a different nonce`);
  if (dom.metaNonce !== nonce)
    failures.push(`${name}: <meta property="csp-nonce"> is ${dom.metaNonce}, expected ${nonce}`);
  if (dom.handlers.length) failures.push(`${name}: inline event handlers present: ${dom.handlers}`);
  // In dev the nonce-less scripts are Vite's own (HMR client, react-refresh);
  // each one is reported once by the report-only strict policy. Anything beyond
  // that means a script the app rendered was not covered by the nonce.
  if (violations.length > dom.withoutNonce)
    failures.push(
      `${name}: ${violations.length} CSP violations for ${dom.withoutNonce} nonce-less inline script(s): ${violations[0]}`,
    );

  page.off("console", onConsole);
  page.off("response", onResponse);
  console.log(
    `  ${name.padEnd(14)} ${enforcing ? "enforced " : "report-only"} nonce=${nonce?.slice(0, 8)}… ` +
      `inline=${dom.inline} (nonce-less ${dom.withoutNonce}, dev-only) handlers=0 violations=${violations.length} theme=${dom.theme}`,
  );
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  // Any theme must come from the nonce'd bootstrap script.
  await context.addInitScript(() => window.localStorage.setItem("tethyr-theme", "dark"));
  const page = await context.newPage();
  console.log(`CSP check against ${BASE}`);
  for (const [name, url] of PAGES) await check(page, name, url);
  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} CSP problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\nOK — ${PAGES.length} pages, nonce on every inline script, no inline handlers.`);
}
