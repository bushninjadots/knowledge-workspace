// GitHub block check (dev tool, not shipped), without saving anything.
//
// A signed-out visitor sees the QA account's public Studio with a GitHub
// block added and sample cached repo snapshots for its projects (both
// supplied at the network, so nothing is written and GitHub isn't called):
//   • the commit graph, the languages bar and the top repositories render,
//     repositories linking to their Tethyr projects first
//   • the block passes axe; a phone has no sideways scroll
// Then, signed in with every write blocked: the Studio's Add tab lists the
// block, and the dashboard shows the Connect GitHub card only when the
// account isn't connected.
//
//   node scripts/qa-github-block.mjs [--base URL]
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123),
// QA_HANDLE (maya). Screenshots land in qa-artifacts/github/.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const HANDLE = process.env.QA_HANDLE || "maya";
const OUT = "qa-artifacts/github";
mkdirSync(OUT, { recursive: true });
const WRITES =
  /\/rest\/v1\/(pages|layouts|profiles|page_versions|connected_accounts)|\/rest\/v1\/rpc\/(apply|publish|save|update)|\/storage\/v1\//;

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const BLOCK_SECTION = {
  id: "qa-github-area",
  title: "",
  layout: "full",
  position: 99,
  visible: true,
  blocks: [
    {
      id: "qa-github-block",
      type: "profile-github",
      config: { view: "overview", repoCount: "4" },
      position: 0,
      visible: true,
    },
  ],
  grid: [{ i: "qa-github-block", x: 0, y: 0, w: 12, h: 10 }],
};

/** 52 weeks of plausible commit activity. */
function weeks() {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 52 }, (_, i) => {
    const days = Array.from({ length: 7 }, (_, d) => ((i * 7 + d) % 5 === 0 ? 0 : (i + d) % 4));
    return { week: now - (52 - i) * 7 * 86400, total: days.reduce((a, b) => a + b, 0), days };
  });
}
const SAMPLE = [
  { full_name: "maya/bloom", language: "TypeScript", stargazers_count: 128 },
  { full_name: "maya/mascots", language: "Python", stargazers_count: 9 },
  { full_name: "maya/sketchbook", language: "CSS", stargazers_count: 0 },
];

async function axe(page, selector) {
  try {
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
    });
    return await page.evaluate(async (sel) => {
      const result = await window.axe.run(sel, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
      return result.violations.map((v) => `${v.id}×${v.nodes.length}`);
    }, selector);
  } catch (error) {
    return [`axe unavailable: ${String(error).slice(0, 60)}`];
  }
}

async function visitor(browser, options) {
  const context = await browser.newContext({ bypassCSP: true, ...options });
  await context.route(/\/rest\/v1\/(page_versions|layouts)\?/, async (route) => {
    const response = await route.fetch();
    const rows = await response.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (Array.isArray(row.layout)) row.layout = [...row.layout, BLOCK_SECTION];
      if (Array.isArray(row.sections)) row.sections = [...row.sections, BLOCK_SECTION];
    }
    await route.fulfill({ response, json: rows });
  });
  await context.route(/\/rest\/v1\/project_repositories_safe\?/, async (route) => {
    const ids = /project_id=in\.\(([^)]*)\)/.exec(decodeURIComponent(route.request().url()));
    const projectIds = ids ? ids[1].split(",").map((s) => s.replace(/"/g, "")) : [];
    const json = projectIds.map((project_id, i) => ({
      project_id,
      metadata: { ...SAMPLE[i % SAMPLE.length], private: false, commit_activity: weeks() },
    }));
    await route.fulfill({ status: 200, contentType: "application/json", json });
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "load" });
  await page.waitForSelector(".studio-canvas", { timeout: 30000 });
  await page.waitForTimeout(2500);
  return page;
}

const browser = await chromium.launch();
try {
  // ── A visitor sees the block ──────────────────────────────────────────────
  const page = await visitor(browser, { viewport: { width: 1440, height: 1000 } });
  const block = page.locator('section[aria-label="GitHub"]');
  const shown = await block
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (shown) await block.scrollIntoViewIfNeeded();
  const facts = shown
    ? await block.evaluate((el) => ({
        graph: !!el.querySelector('[role="img"][aria-label^="Commits in the last year"]'),
        languages: el
          .querySelector('[role="img"][aria-label^="Languages"]')
          ?.getAttribute("aria-label"),
        projectLinks: [...el.querySelectorAll('a[href^="/projects/"]')].length,
        repoLinks: [...el.querySelectorAll('a[href^="https://github.com/"]')].length,
      }))
    : {};
  if (shown) await block.screenshot({ path: `${OUT}/block.png` });
  log(
    "the GitHub block shows commits, languages and repositories",
    shown && facts.graph && !!facts.languages && facts.projectLinks > 0,
    JSON.stringify(facts),
  );
  const violations = shown ? await axe(page, 'section[aria-label="GitHub"]') : ["not shown"];
  log("the GitHub block passes axe", violations.length === 0, violations.join(" "));
  await page.context().close();

  const phone = await visitor(browser, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  log("no sideways scroll on a phone", overflow <= 0, `${overflow}px`);
  await phone.context().close();

  // ── The owner, writes blocked ─────────────────────────────────────────────
  const owner = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
  await owner.route("**/*", (route) =>
    route.request().method() !== "GET" && WRITES.test(route.request().url())
      ? route.abort()
      : route.continue(),
  );
  await owner.goto(`${BASE}/login`, { waitUntil: "load" });
  await owner.waitForSelector("#email", { timeout: 20000 });
  await owner.waitForTimeout(2000);
  await owner.fill("#email", EMAIL);
  await owner.fill("#password", PASSWORD);
  await owner.getByRole("button", { name: /log in/i }).click();
  await owner.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });

  await owner.goto(`${BASE}/settings#github`, { waitUntil: "load" });
  await owner.locator("#github").waitFor({ timeout: 30000 });
  await owner.waitForTimeout(2000);
  const connected = (await owner.locator("#github").getByText("GitHub connected").count()) > 0;
  await owner.goto(`${BASE}/dashboard`, { waitUntil: "load" });
  await owner.waitForTimeout(4000);
  const nudge = (await owner.locator('aside[aria-label="Connect GitHub"]').count()) > 0;
  log(
    "the dashboard offers Connect GitHub only when it isn't connected",
    nudge === !connected,
    `connected: ${connected}, card: ${nudge}`,
  );

  await owner.goto(`${BASE}/studio`, { waitUntil: "load" });
  await owner.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await owner.waitForTimeout(2500);
  await owner.getByRole("tab", { name: "Add", exact: true }).first().click();
  await owner.waitForTimeout(800);
  const listed = await owner
    .locator("#studio-rail-panel")
    .getByRole("button", { name: /^GitHub\b/ })
    .count();
  log("the Studio's Add tab lists the GitHub block", listed > 0, `${listed} found`);
} catch (error) {
  console.log(`✗ stopped: ${String(error).split("\n")[0]}`);
  results.push({ name: "run", ok: false });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
