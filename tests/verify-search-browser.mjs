/* Browser verification: library + global search with special-character terms.
 * Run: node tests/verify-search-browser.mjs
 * Requires the dev stack on :3000. */
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";
const EMAIL = "test@tethyr.com";
const PASSWORD = "password123";

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15_000);

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

function httpErrs() {
  return consoleErrors.filter((e) => /PGRST|400|Failed to load/i.test(e));
}

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

// ── Library page search (the filter IS GlobalSearch inline) ─────────────────
await page.goto(`${BASE}/library`);
await page.waitForLoadState("networkidle");
const libErrsBefore = consoleErrors.length;

// Two responsive instances exist (mobile/desktop); use the visible one.
const searchBox = page.locator('input[aria-label="Search the network"]:visible').first();
await searchBox.waitFor();
await searchBox.click();
await page.keyboard.type("100%", { delay: 5 });
await page.waitForTimeout(800); // debounce (200ms) + query round-trip
record(
  "library search '100%' produces no 400/PGRST errors",
  httpErrs().length === libErrsBefore,
  httpErrs().length ? httpErrs().slice(0, 2).join(" | ") : "console clean",
);

await searchBox.fill("");
await searchBox.click();
await page.keyboard.type("(a|b)", { delay: 5 });
await page.waitForTimeout(800);
record(
  "library search '(a|b)' produces no 400/PGRST errors",
  httpErrs().length === libErrsBefore,
);

// ── Global search results listbox with special characters ────────────────────
await page
  .locator('[role="listbox"][aria-label="Search results"]')
  .waitFor({ timeout: 5_000 })
  .then(() => record("results listbox opens for '(a|b)'", true))
  .catch(() => record("results listbox opens for '(a|b)'", false));

await searchBox.fill("");
await searchBox.click();
await page.keyboard.type("100% (a|b),", { delay: 5 });
await page.waitForTimeout(800);
record(
  "search '100% (a|b),' produces no 400/PGRST errors",
  httpErrs().length === libErrsBefore,
);
record(
  "search still responsive after hostile terms",
  (await searchBox.inputValue()) === "100% (a|b),",
);

await page.keyboard.press("Escape");

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
