/* Browser verification: template previews + library sharing + search regression.
 * Run: node tests/verify-features-browser.mjs
 * Requires the dev stack on :3000. */
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";
const EMAIL = "test@tethyr.com";
const PASSWORD = "password123";
const SHARED_ID = process.env.SHARED_ID ?? "b6ee54f3-7786-4108-bbb1-e4557cce8032";

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15_000);
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

// ── Sign in ──────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`);
await page.waitForLoadState("networkidle");
await page.locator('input[type="email"]').click();
await page.keyboard.type(EMAIL, { delay: 5 });
await page.locator('input[type="password"]').click();
await page.keyboard.type(PASSWORD, { delay: 5 });
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
record("login", true, page.url());

// ── Public shared-item page (as a visitor would see it) ──────────────────────
// Use a fresh context = signed out.
const anon = await browser.newPage();
anon.setDefaultTimeout(15_000);
const anonResp = await anon.goto(`${BASE}/library/shared/${SHARED_ID}`);
record("shared page returns 200 for signed-out visitor", anonResp?.status() === 200);
await anon.waitForLoadState("networkidle");
await anon.waitForTimeout(1500);
const anonBody = (await anon.locator("body").innerText()).replace(/\s+/g, " ");
// innerText applies CSS text-transform, so check case-insensitively.
record(
  "shared page shows the shared item content",
  /shared from a tethyr library/i.test(anonBody) && /shared probe item/i.test(anonBody),
);
record("shared page shows revocation note", anonBody.includes("revoke this link"));
await anon.close();

// Revoked (unknown id) → honest unavailable state, not an error dump.
const anon2 = await browser.newPage();
const revokedResp = await anon2.goto(`${BASE}/library/shared/00000000-0000-0000-0000-000000000000`);
record("revoked/unknown shared id still serves 200 shell", revokedResp?.status() === 200);
await anon2.waitForLoadState("networkidle");
record(
  "revoked shared id shows unavailable state",
  (await anon2.locator("body").innerText()).includes("isn't available"),
);
await anon2.close();

// ── Signed-in: share toggle on the library item page ─────────────────────────
await page.goto(`${BASE}/library`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(2000); // item list hydration
// Rows are buttons/clickable divs, not anchors — click by text.
const itemRow = page.getByText("Shared probe item").first();
await itemRow.waitFor();
await itemRow.click();
await page.waitForURL((u) => /\/library\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 15_000 });
record("opened item detail page", true, page.url());
await page.waitForLoadState("networkidle");
const detail = page.locator("body");
// The item's updated_at sync can rerender the editor after load — wait for the
// share bar rather than racing a single innerText snapshot.
await page.getByText(/anyone with the link can view/i).waitFor({ timeout: 10_000 });
const shareText = await detail.innerText();
record(
  "share bar shows shared state",
  /anyone with the link can view/i.test(shareText),
);
record("share bar offers Stop sharing", /stop sharing/i.test(shareText));

// Toggle off and on again; RLS must follow immediately.
await page.getByRole("button", { name: /stop sharing/i }).click();
await page.waitForTimeout(800);
record(
  "toggle off persisted (owner view shows Share CTA)",
  /make this item readable/i.test(await detail.innerText()),
);
await page.getByRole("button", { name: "Share", exact: true }).click();
await page.waitForTimeout(800);
record(
  "toggle on persisted (share bar back to shared state)",
  /anyone with the link can view/i.test(await detail.innerText()),
);

// Copy-link button flips to "Copied".
const ctx = page.context();
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.getByRole("button", { name: /copy link/i }).click();
await page.waitForTimeout(400);
record("copy-link button confirms", /copied/i.test(await detail.innerText()));
const clip = await page.evaluate(() => navigator.clipboard.readText());
record(
  "clipboard holds the public share URL",
  clip === `${BASE}/library/shared/${SHARED_ID}`,
  clip,
);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
