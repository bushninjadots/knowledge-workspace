// Profile-picture shape click-through: picking a shape in the appearance
// dialog must restyle the member's avatar on both their Studio (/profile)
// and their public Studio (/u/:handle) — and reset cleanly.
// Run against a seeded local stack:
//   node scripts/qa-avatar-shape.mjs
// Optional env: QA_BASE (default http://localhost:3000), QA_LOGIN_EMAIL /
// QA_LOGIN_PASSWORD (defaults: maya@tethyr.dev / password123). Restores the
// circle default at the end.
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

async function setShape(label) {
  await page.goto(`${BASE}/settings`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /open appearance editor/i }).click();
  await page.waitForTimeout(800);
  await page
    .getByRole("button", { name: new RegExp(label, "i") })
    .first()
    .click();
  await page.getByRole("button", { name: /save background/i }).click();
  await page.waitForTimeout(1500);
}

/** Count elements on the page that render with a polygon clip (exotic shapes). */
async function polygonCount() {
  return page.evaluate(
    () =>
      [...document.querySelectorAll("*")].filter((el) => {
        const clip = getComputedStyle(el).clipPath;
        return clip && clip.includes("polygon");
      }).length,
  );
}

await login();

// ── 1. Pick the hexagon shape in the appearance dialog ──────────────────────
await setShape("Hexagon");

// ── 2. Owner's Studio: the identity avatar takes the shape ──────────────────
await page.goto(`${BASE}/profile`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const ownerPolys = await polygonCount();
log("owner studio renders the shape", ownerPolys > 0, `clipped=${ownerPolys}`);

// ── 3. Public Studio: same shape for visitors ────────────────────────────────
await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const pubPolys = await polygonCount();
log("public studio renders the shape", pubPolys > 0, `clipped=${pubPolys}`);
log("same clip presence on both", ownerPolys > 0 && pubPolys > 0);

// ── 4. No runtime errors ─────────────────────────────────────────────────────
log("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

// ── 5. Restore the circle default and confirm it clears the clip ─────────────
await setShape("Circle");
await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const resetPolys = await polygonCount();
log("reset clears the shape", resetPolys === 0, `clipped=${resetPolys}`);

await browser.close();

const failed = results.filter((r) => !r.ok);
process.exitCode = failed.length > 0 ? 1 : 0;
if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed`);
} else {
  console.log("\nAll avatar-shape checks passed");
}
