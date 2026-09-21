// Explore quick-look overlay click-through: open a project card on Explore →
// overlay preview → title link → full project page → deep link
// (/explore?project=<id> reopens the preview) → close clears the URL param.
// Run against a seeded local stack:
//   node scripts/qa-explore-overlay.mjs
// Optional env: QA_BASE (default http://localhost:3000)
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const errors = [];

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
// domcontentloaded + a form wait is deterministic; networkidle flaked on the
// dev server (lingering HMR/websocket traffic after on-demand transforms).
// A click before hydration falls through to a native GET submit (the
// "/login?" tell), so retry until the SPA actually handles the submit
// (same pattern qa-project-loop/qa-challenge-loop use).
let loggedIn = false;
for (let attempt = 0; attempt < 3 && !loggedIn; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.fill("#email", "test@tethyr.com");
  await page.fill("#password", "password123");
  await page.click('button[type="submit"]');
  loggedIn = await page
    .waitForURL(/\/dashboard/, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
}
if (!loggedIn) throw new Error(`login failed; still on ${page.url()}`);
log("login", true, "→ /dashboard");

// Explore → Projects tab → open the quick-look overlay from a card.
await page.goto(`${BASE}/explore`, { waitUntil: "domcontentloaded" });
const card = page.locator('button[aria-label^="View "]').first();
await card.waitFor({ state: "visible", timeout: 20000 });
await card.click();
const overlay = page.getByRole("dialog");
await overlay.waitFor({ state: "visible", timeout: 10000 });
const overlayTitle = (await overlay.getByRole("heading").first().innerText()).trim();
log("overlay opens from card", true, overlayTitle);

// The close button must be on-screen — the panel used to overflow short
// viewports (900px) and push it out of reach.
const close = overlay.getByRole("button", { name: "Close overlay" });
const box = await close.boundingBox();
const reachable = box && box.y >= 0 && box.y + box.height <= 900;
log("close button within viewport", reachable, `y=${box && Math.round(box.y)}`);

// The title block is a real link to the full project page.
const titleLink = overlay.getByRole("link").first();
const href = await titleLink.getAttribute("href");
log("overlay title is a link", Boolean(href && href.includes("/projects/")), href ?? "");

await titleLink.click();
await page.waitForURL(/\/projects\//, { timeout: 20000 });
const projectUrl = page.url();
const projectId = projectUrl.replace(/\/$/, "").split("/").pop();
log("title click lands on project page", true, projectUrl);

// Regression: the overlay's close handler used to fire a second navigation
// back to /explore, bouncing the user off the project page. Both exits must
// STICK — wait past any bounce window and re-assert.
await page.waitForTimeout(2000);
log("title click stays on project page", /\/projects\//.test(page.url()), page.url());

// Same regression for the footer "View Project" button — back to explore,
// reopen the overlay (the shelf remounts without it), then click through.
await page.goBack();
// Let the restored explore surface finish hydrating before interacting.
await page.waitForTimeout(1500);
const reopenCard = page.locator('button[aria-label^="View "]').first();
await reopenCard.waitFor({ state: "visible", timeout: 20000 });
await reopenCard.click();
const reopenOverlay = page.getByRole("dialog");
await reopenOverlay.waitFor({ state: "visible", timeout: 10000 });
await reopenOverlay.getByRole("button", { name: "View Project" }).click();
await page.waitForURL(/\/projects\//, { timeout: 20000 });
await page.waitForTimeout(2000);
log(
  "View Project stays on project page",
  /\/projects\//.test(page.url()) && page.url().includes(projectId),
  page.url(),
);

// Deep link: /explore?project=<id> reopens the shared project's preview.
await page.goto(`${BASE}/explore?project=${projectId}`, { waitUntil: "domcontentloaded" });
const deepOverlay = page.getByRole("dialog");
await deepOverlay.waitFor({ state: "visible", timeout: 15000 });
const deepTitle = (await deepOverlay.getByRole("heading").first().innerText()).trim();
log("deep link reopens preview", deepTitle === overlayTitle, deepTitle);

// Closing clears the ?project param so back/refresh stay clean.
await deepOverlay.getByRole("button", { name: "Close overlay" }).click();
await page.waitForTimeout(800);
log("close clears URL param", !page.url().includes("project="), page.url());

await browser.close();

const failed = results.filter((r) => !r.ok);
if (failed.length > 0 || errors.length > 0) {
  console.log("page errors:", errors);
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
