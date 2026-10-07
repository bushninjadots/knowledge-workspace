// GitHub click-through (dev tool, not shipped), on a throwaway account.
//
//   • Settings → GitHub: connect by username; the status, the profile link
//     and "Where GitHub shows up" follow; the section passes axe
//   • Your Studio → Edit details shows the status chip linking to Settings
//   • README block: "Import from GitHub" from its empty state → pick a repo
//     → preview → use it; the block shows it with its source, and the next
//     click is "Sync from GitHub", which says "Already up to date"
//   • the skills picker suggests skills from the account's repo languages
//   • Settings → Sync everything says what it did (README up to date)
//
// Uses a public repo (octocat/Spoon-Knife) and only a handful of GitHub
// requests, so it runs within the anonymous rate limit.
//
//   node scripts/qa-github.mjs [--base URL]
// Screenshots land in qa-artifacts/github/.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const OUT = "qa-artifacts/github";
mkdirSync(OUT, { recursive: true });
const REPO = "octocat/Spoon-Knife";

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const id = Date.now().toString(36);
const HANDLE = `ghqa${id}`;
const EMAIL = `ghqa+${id}@tethyr.dev`;
const PASSWORD = "password123!A";

async function signUp(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/signup`, { waitUntil: "load" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(3000);
    if (await page.locator("#name").count()) await page.fill("#name", "Gil Hub");
    if (await page.locator("#handle").count()) await page.fill("#handle", HANDLE);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page
      .getByRole("button", { name: /sign up|create/i })
      .first()
      .click();
    const ok = await page
      .waitForURL((u) => !u.pathname.startsWith("/signup"), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }
  throw new Error("sign-up failed");
}

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

const browser = await chromium.launch();
let page;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    bypassCSP: true,
  });
  page = await context.newPage();
  await signUp(page);

  // ── Settings → GitHub ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/settings#github`, { waitUntil: "load" });
  const section = page.locator("#github");
  await section.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  log(
    "Settings has a GitHub section with both ways to connect",
    (await section.getByRole("button", { name: "Connect with GitHub" }).count()) === 1 &&
      (await section.getByRole("button", { name: /enter your username/i }).count()) === 1,
  );
  await section.getByRole("button", { name: /enter your username/i }).click();
  await section.getByPlaceholder("your-username").fill("https://github.com/octocat");
  await section.getByRole("button", { name: /^save$/i }).click();
  await section.getByText("GitHub connected").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const uses = await section.innerText();
  log(
    "connecting shows the account and the profile link",
    /@octocat/.test(uses) && /github\.com\/octocat shows in your profile links/.test(uses),
  );
  await section.screenshot({ path: `${OUT}/settings.png` });
  const violations = await axe(page, "#github");
  log("the GitHub section passes axe", violations.length === 0, violations.join(" "));

  // ── Edit profile: the chip ────────────────────────────────────────────────
  await page.goto(`${BASE}/profile`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Edit details" }).first().click({ timeout: 30000 });
  const chip = page.getByRole("link", { name: /GitHub · @octocat/ });
  await chip.waitFor({ timeout: 30000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/profile.png` });
  log(
    "Edit details shows the GitHub status, linking to Settings",
    (await chip.count()) === 1 &&
      /\/settings#github$/.test((await chip.getAttribute("href")) ?? ""),
  );

  // ── README: import, then sync ─────────────────────────────────────────────
  await page.goto(`${BASE}/studio`, { waitUntil: "load" });
  await page.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await page.waitForTimeout(2500);
  const empty = page.locator('[aria-label="Empty README block"]').first();
  await empty.scrollIntoViewIfNeeded();
  log(
    "the empty README block offers Import from GitHub",
    (await empty.getByRole("button", { name: "Import from GitHub" }).count()) === 1,
  );
  await empty.getByRole("button", { name: "Import from GitHub" }).click();
  const dialog = page.getByRole("dialog", { name: /Import from GitHub/ });
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByRole("combobox", { name: "Repository" }).click();
  const suggested = await page
    .getByRole("option", { name: "octocat/octocat — Your profile README" })
    .count();
  log("it suggests your GitHub profile README first", suggested === 1);
  await page.getByRole("option", { name: "Another repository…" }).click();
  await dialog.getByLabel("Repository as owner/name").fill(`https://github.com/${REPO}`);
  await dialog.getByRole("button", { name: "Load" }).click();
  const previewed = await dialog
    .getByRole("heading", { name: "Well hello there!" })
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  await dialog.screenshot({ path: `${OUT}/import-dialog.png` });
  log("it previews the README before anything changes", previewed);
  await dialog.getByRole("button", { name: "Use this README" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForTimeout(1500);
  const caption = page.getByText(new RegExp(`From ${REPO} · synced`));
  log("the README shows with where it came from", (await caption.count()) > 0);
  const sync = page.getByRole("button", { name: "Sync from GitHub" }).first();
  log("the next action is Sync from GitHub", (await sync.count()) > 0);
  await sync.click();
  const syncDialog = page.getByRole("dialog", { name: /Sync from GitHub/ });
  await syncDialog.waitFor({ timeout: 10000 });
  await syncDialog
    .getByText("Already up to date")
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  await syncDialog.screenshot({ path: `${OUT}/sync-dialog.png` });
  log(
    "syncing an unchanged README says it's already up to date",
    (await syncDialog.getByText("Already up to date").count()) === 1,
  );
  await syncDialog.getByRole("button", { name: "Cancel" }).click();

  // ── Skills from GitHub languages ──────────────────────────────────────────
  await page.goto(`${BASE}/profile`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Edit details" }).first().click({ timeout: 30000 });
  await page.getByRole("button", { name: "Edit section" }).first().click({ timeout: 15000 });
  const picker = page.getByRole("dialog", { name: "Add skills to share" });
  await picker.waitFor({ timeout: 10000 });
  const fromGithub = await picker
    .getByText("From your GitHub")
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  await picker.screenshot({ path: `${OUT}/skills.png` });
  log("the skills picker suggests skills from your GitHub languages", fromGithub);
  await page.keyboard.press("Escape");

  // ── Settings reflects the README source ───────────────────────────────────
  await page.goto(`${BASE}/settings#github`, { waitUntil: "load" });
  await page.locator("#github").waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  const settings = page.locator("#github");
  await settings.getByRole("button", { name: "Sync everything" }).click();
  const summary = await settings
    .getByText(/README up to date/)
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  log("Sync everything reports what it did", summary);
  log(
    "Settings lists the README's source",
    (await page
      .locator("#github")
      .getByText(new RegExp(`From ${REPO}`))
      .count()) === 1,
  );
} catch (error) {
  await page?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  console.log(`✗ stopped: ${String(error).split("\n")[0]} (see ${OUT}/failure.png)`);
  results.push({ name: "run", ok: false });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed · account @${HANDLE}`);
process.exit(failed ? 1 : 0);
