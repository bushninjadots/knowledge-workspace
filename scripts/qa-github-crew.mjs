// Crew GitHub check (dev tool, not shipped). Uses the seeded crew
// "atlas-core" (lead: Devon) and puts its links back as they were.
//
//   • a lead adding the crew's GitHub link brings its public repos onto the
//     crew page ("On GitHub"), with "Sync from GitHub" for leads
//   • a signed-out visitor sees the same repos (from the cache, no GitHub
//     call); the section passes axe
//   • removing the link removes the section
//
//   node scripts/qa-github-crew.mjs [--base URL]
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
const CREW = "atlas-core";
const ORG = "octocat";

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

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

const section = (page) => page.locator('section[aria-labelledby="crew-github"]');

async function saveGithubLink(page, value) {
  await page.goto(`${BASE}/teams/${CREW}`, { waitUntil: "load" });
  const input = page.getByLabel("Crew github link");
  await input.waitFor({ timeout: 30000 });
  await input.fill(value);
  await page.getByRole("button", { name: "Save links" }).click();
  await page.getByText("Links saved").first().waitFor({ timeout: 15000 });
}

const browser = await chromium.launch();
let lead;
try {
  lead = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 }, bypassCSP: true })
  ).newPage();
  let signedIn = false;
  for (let attempt = 0; attempt < 3 && !signedIn; attempt++) {
    await lead.goto(`${BASE}/login`, { waitUntil: "load" });
    await lead.waitForSelector("#email", { timeout: 20000 });
    await lead.waitForTimeout(2000);
    await lead.fill("#email", "devon@tethyr.dev");
    await lead.fill("#password", "password123");
    await lead.getByRole("button", { name: /log in/i }).click();
    signedIn = await lead
      .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
  }
  if (!signedIn) throw new Error("login failed");

  await saveGithubLink(lead, `https://github.com/${ORG}`);
  const appeared = await section(lead)
    .getByRole("link", { name: new RegExp(`@${ORG}`) })
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  const cards = await section(lead).locator("li").count();
  await section(lead)
    .screenshot({ path: `${OUT}/crew.png` })
    .catch(() => {});
  log(
    "adding the crew's GitHub link brings its repos onto the page",
    appeared && cards > 0,
    `${cards} repos`,
  );
  log(
    "leads get Sync from GitHub",
    (await section(lead).getByRole("button", { name: "Sync from GitHub" }).count()) === 1,
  );

  const visitor = await (await browser.newContext({ bypassCSP: true })).newPage();
  let githubCalls = 0;
  visitor.on("request", (request) => {
    if (/api\.github\.com|githubusercontent/.test(request.url())) githubCalls += 1;
  });
  await visitor.goto(`${BASE}/teams/${CREW}`, { waitUntil: "load" });
  await section(visitor)
    .waitFor({ timeout: 20000 })
    .catch(() => {});
  const seen = await section(visitor).locator("li").count();
  log(
    "a visitor sees the crew's repos without anything calling GitHub",
    seen === cards && githubCalls === 0,
    `${seen} repos, ${githubCalls} GitHub requests`,
  );
  const violations = await axe(visitor, 'section[aria-labelledby="crew-github"]');
  log("the crew's GitHub section passes axe", violations.length === 0, violations.join(" "));
  await visitor.context().close();
} catch (error) {
  await lead?.screenshot({ path: `${OUT}/crew-failure.png` }).catch(() => {});
  console.log(`✗ stopped: ${String(error).split("\n")[0]}`);
  results.push({ name: "run", ok: false });
} finally {
  // Put the crew back as it was: no GitHub link, no section.
  try {
    await saveGithubLink(lead, "");
    await lead.waitForTimeout(2500);
    await lead.reload({ waitUntil: "load" });
    await lead.waitForTimeout(2000);
    log("removing the link removes the section", (await section(lead).count()) === 0);
  } catch (error) {
    console.log(`✗ couldn't restore ${CREW}'s links: ${String(error).split("\n")[0]}`);
    results.push({ name: "restore", ok: false });
  }
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
