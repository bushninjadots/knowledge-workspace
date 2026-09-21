// Tethyr QA visual audit harness (dev tool, not shipped).
// Usage: node scripts/qa-audit.mjs [--base http://localhost:3000]
// Outputs: qa-artifacts/*.png + qa-artifacts/report.json + console summary.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};
const BASE = arg("base", "http://localhost:3000");
const OUT = path.resolve("qa-artifacts");
fs.mkdirSync(path.join(OUT, "desktop"), { recursive: true });
fs.mkdirSync(path.join(OUT, "mobile"), { recursive: true });

const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";

const report = { base: BASE, pages: [] };

function wireDiagnostics(page) {
  page.on("console", (m) => {
    if (m.type() === "error") report.pages.at(-1)?.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => report.pages.at(-1)?.pageErrors.push(String(e).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400)
      report.pages.at(-1)?.httpErrors.push(`${r.status()} ${r.url().slice(0, 140)}`);
  });
}

async function settle(page, ms = 1800) {
  // Wait for SSR + hydration + first data queries to land before measuring.
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(ms);
}

/**
 * page.goto with retries. On a cold dev server Vite discovers new module
 * dependencies mid-navigation, re-optimizes, and reloads the page — aborting
 * in-flight navigations with net::ERR_ABORTED. One retry after a settle
 * absorbs the class of flake (seen on /skills) without masking real 500s.
 */
async function goto(page, url, options) {
  try {
    return await page.goto(url, options);
  } catch (err) {
    const retriable =
      err?.message?.includes("ERR_ABORTED") || err?.message?.includes("ERR_CONNECTION_REFUSED");
    if (!retriable) throw err;
    await page.waitForTimeout(2500);
    return page.goto(url, options);
  }
}

async function login(page) {
  await goto(page, `${BASE}/login`, { waitUntil: "load" });
  await settle(page, 1200); // hydration must complete before interacting
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  const ok = await page
    .waitForURL(/dashboard/, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!ok)
    throw new Error(
      `login failed; still on ${page.url()}; body: ${(await page.evaluate(() => document.body.innerText)).slice(0, 200)}`,
    );
  await settle(page);
}

// Metric: leaf "card" surfaces (bordered + filled) and the closest any of their
// own text nodes comes to the card's border edge (padding + border included).
async function cardMetrics(page) {
  return page.evaluate(() => {
    const isSurface = (el) => {
      const cs = getComputedStyle(el);
      if (cs.borderTopWidth === "0px") return false;
      if (cs.backgroundColor === "rgba(0, 0, 0, 0)") return false;
      const r = el.getBoundingClientRect();
      return r.width > 90 && r.height > 40 && el.innerText.trim().length > 0;
    };
    const all = [...document.querySelectorAll("main *, [data-page_layout] *")].filter(isSurface);
    // keep only leaf surfaces (no nested surface inside)
    const leaves = all.filter((el) => ![...el.querySelectorAll("*")].some((c) => isSurface(c)));
    const out = [];
    for (const el of leaves.slice(0, 120)) {
      const r = el.getBoundingClientRect();
      let minGap = Infinity;
      let worst = null;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.textContent.trim();
        if (!t) continue;
        const rng = document.createRange();
        rng.selectNodeContents(n);
        const tr = rng.getBoundingClientRect();
        if (tr.width < 2 || tr.height < 2) continue;
        const gaps = [
          { side: "left", gap: tr.left - r.left },
          { side: "right", gap: r.right - tr.right },
          { side: "top", gap: tr.top - r.top },
          { side: "bottom", gap: r.bottom - tr.bottom },
        ];
        for (const g of gaps) {
          if (g.gap < minGap) {
            minGap = g.gap;
            worst = { side: g.side, text: t.slice(0, 40) };
          }
        }
      }
      const cs = getComputedStyle(el);
      if (minGap < 8)
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") || "").slice(0, 90),
          pad: `${cs.paddingTop}/${cs.paddingRight}/${cs.paddingBottom}/${cs.paddingLeft}`,
          minTextToBorder: Math.round(minGap * 10) / 10,
          worst,
          size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        });
    }
    return out.slice(0, 30);
  });
}

async function auditPage(page, name, opts = {}) {
  const entry = {
    name,
    url: page.url(),
    consoleErrors: [],
    pageErrors: [],
    httpErrors: [],
  };
  report.pages.push(entry);
  await settle(page);
  entry.horizontalOverflow =
    (await page.evaluate(
      () => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
    )) > 1;
  entry.cardsTight = await cardMetrics(page);
  await page.screenshot({
    path: path.join(OUT, opts.mobile ? "mobile" : "desktop", `${name}.png`),
    fullPage: true,
  });
  const flags = [
    entry.horizontalOverflow && "OVERFLOW",
    entry.cardsTight.length && `CARDS-TIGHT(${entry.cardsTight.length})`,
    entry.consoleErrors.length && `CONSOLE(${entry.consoleErrors.length})`,
    entry.pageErrors.length && `PAGEERR(${entry.pageErrors.length})`,
    entry.httpErrors.length && `HTTP(${entry.httpErrors.length})`,
  ].filter(Boolean);
  console.log(`${flags.length ? "⚠" : "✓"} ${name}${flags.length ? ": " + flags.join(" ") : ""}`);
}

const browser = await chromium.launch();
try {
  // ---- Desktop pass ----
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    wireDiagnostics(page);
    await goto(page, `${BASE}/`, { waitUntil: "domcontentloaded" });
    await auditPage(page, "landing");
    await goto(page, `${BASE}/u/maya`, { waitUntil: "domcontentloaded" });
    await auditPage(page, "public-studio-maya");
    await goto(page, `${BASE}/skills`, { waitUntil: "domcontentloaded" });
    await auditPage(page, "skills");

    await login(page);
    report.loginLandedOn = page.url();

    for (const [name, url] of [
      ["dashboard", "/dashboard"],
      ["explore", "/explore"],
      ["community", "/community"],
      ["challenges", "/challenges"],
      ["library", "/library"],
      ["sessions", "/sessions"],
      ["messages", "/messages"],
      ["connections", "/connections"],
      ["teams", "/teams"],
      ["settings", "/settings"],
      ["studio-editor", "/studio"],
      ["profile-private", "/profile"],
    ]) {
      await goto(page, `${BASE}${url}`, { waitUntil: "domcontentloaded" });
      await auditPage(page, name);
    }

    const projHref = await page.evaluate(() => {
      const a = [...document.querySelectorAll('a[href*="/projects/"]')];
      return a.length ? a[0].getAttribute("href") : null;
    });
    if (projHref) {
      await goto(page, `${BASE}${projHref}`, { waitUntil: "domcontentloaded" });
      await auditPage(page, "project-detail");
    }
    await page.context().close();
  }

  // ---- Mobile pass (core pages) ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    wireDiagnostics(page);
    await goto(page, `${BASE}/`, { waitUntil: "domcontentloaded" });
    await auditPage(page, "landing", { mobile: true });
    await goto(page, `${BASE}/u/maya`, { waitUntil: "domcontentloaded" });
    await auditPage(page, "public-studio-maya", { mobile: true });
    await login(page);
    for (const [name, url] of [
      ["dashboard", "/dashboard"],
      ["explore", "/explore"],
      ["studio-editor", "/studio"],
    ]) {
      await goto(page, `${BASE}${url}`, { waitUntil: "domcontentloaded" });
      await auditPage(page, name, { mobile: true });
    }
    await page.context().close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  const worst = report.pages
    .flatMap((p) => p.cardsTight.map((c) => ({ page: p.name, ...c })))
    .sort((a, b) => a.minTextToBorder - b.minTextToBorder)
    .slice(0, 18);
  console.log("\n--- Worst text-to-border offenders (leaf cards, <8px) ---");
  for (const w of worst)
    console.log(
      `${w.page}: gap=${w.minTextToBorder}px pad[${w.pad}] ${w.size} ${w.tag}.${w.cls.slice(0, 46)} "${w.worst?.text}" (${w.worst?.side})`,
    );
  const errCount = report.pages.reduce(
    (a, p) => a + p.consoleErrors.length + p.pageErrors.length + p.httpErrors.length,
    0,
  );
  console.log(
    `\nDone. ${report.pages.length} pages, ${errCount} errors. Artifacts in qa-artifacts/`,
  );
  // Gate on hard failures (console/page/HTTP errors). Visual metrics above are
  // informational — card-density findings need human review to separate real
  // defects from intentional design (media overlays, line-clamped text).
  process.exitCode = errCount > 0 ? 1 : 0;
}
