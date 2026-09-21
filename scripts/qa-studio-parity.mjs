// Studio parity click-through: the owner's Studio view (/profile) and the
// public Studio (/u/:handle) must render the saved layout identically —
// same block count, same studio-block frames, same full-bleed opt-outs.
// Run against a seeded local stack:
//   node scripts/qa-studio-parity.mjs
// Optional env: QA_BASE (default http://localhost:3000), QA_LOGIN_EMAIL /
// QA_LOGIN_PASSWORD (defaults: maya@tethyr.dev / password123). The script
// publishes the owner's Studio draft when needed.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const EMAIL = process.env.QA_LOGIN_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_LOGIN_PASSWORD || "password123";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

async function login() {
  // Same hydration-aware retry the other click-throughs use: a click before
  // hydration falls through to a native GET submit (the "/login?" tell).
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    const ok = await page
      .waitForURL(/dashboard|profile/, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      await page.waitForTimeout(1000);
      return;
    }
  }
  throw new Error(`login failed; still on ${page.url()}`);
}

/** Structural census of a rendered Studio surface. */
async function census() {
  return page.evaluate(() => ({
    blocks: document.querySelectorAll(".studio-block").length,
    flush: document.querySelectorAll(".studio-block-flush").length,
    sections: document.querySelectorAll("section[data-section-id], section.group\\/section").length,
    body: document.body.innerText.slice(0, 400),
  }));
}

await login();

// ── 1. Owner view: land on /profile, make sure a Studio exists and is live ──
await page.goto(`${BASE}/profile`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const draftStrip = page.getByText(/Draft — visitors can't see your Studio yet/i);
if (
  await draftStrip
    .first()
    .isVisible()
    .catch(() => false)
) {
  const publish = page.getByRole("button", { name: /publish now/i });
  if (await publish.isVisible().catch(() => false)) {
    await publish.click();
    await page.waitForTimeout(1500);
  }
}
const owner = await census();
log(
  "owner view renders studio blocks",
  owner.blocks > 0,
  `blocks=${owner.blocks} body=${owner.body.replace(/\s+/g, " ").slice(0, 160)}`,
);

// ── 2. Public view: same layout, rendered for a visitor ──────────────────────
await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const pub = await census();
log("public view renders studio blocks", pub.blocks > 0, `blocks=${pub.blocks}`);

// ── 3. Parity: frame and full-bleed counts must match exactly ────────────────
log(
  "same studio-block frame count",
  owner.blocks === pub.blocks,
  `owner=${owner.blocks} public=${pub.blocks}`,
);
log(
  "same full-bleed opt-out count",
  owner.flush === pub.flush,
  `owner=${owner.flush} public=${pub.flush}`,
);

// ── 4. No runtime errors on either surface ───────────────────────────────────
log("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

// ── 5. Dark mode: the parity contract must hold in both schemes ──────────
// tethyr-theme is the app's light/dark toggle key (see src/lib/theme.tsx).
await page.evaluate(() => localStorage.setItem("tethyr-theme", "dark"));
await page.goto(`${BASE}/profile`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const ownerDark = await census();
await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const pubDark = await census();
await page.evaluate(() => localStorage.setItem("tethyr-theme", "light"));
log(
  "dark mode: same studio-block frame count",
  ownerDark.blocks > 0 && ownerDark.blocks === pubDark.blocks,
  `owner=${ownerDark.blocks} public=${pubDark.blocks}`,
);
log(
  "dark mode: same full-bleed opt-out count",
  ownerDark.flush === pubDark.flush,
  `owner=${ownerDark.flush} public=${pubDark.flush}`,
);
log("dark mode: no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

// ── 6. Mobile viewport: parity must hold below the md breakpoint ─────────
// Spans are md:col-span-* classes, so both surfaces collapse to one column.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/profile`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const ownerMobile = await census();
await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const pubMobile = await census();
await page.setViewportSize({ width: 1440, height: 900 });
log(
  "mobile: same studio-block frame count",
  ownerMobile.blocks > 0 && ownerMobile.blocks === pubMobile.blocks,
  `owner=${ownerMobile.blocks} public=${pubMobile.blocks}`,
);
log(
  "mobile: same full-bleed opt-out count",
  ownerMobile.flush === pubMobile.flush,
  `owner=${ownerMobile.flush} public=${pubMobile.flush}`,
);
log("mobile: no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();

const failed = results.filter((r) => !r.ok);
process.exitCode = failed.length > 0 ? 1 : 0;
if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed`);
} else {
  console.log("\nAll studio-parity checks passed");
}
