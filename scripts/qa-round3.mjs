// Round 3: long READMEs fold; project activity folds commit runs and pages;
// Code → docs (paste code, whole project from GitHub, save to Library,
// add to README); bring-your-own-key settings refuse a bad key.
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const DB = process.env.QA_DB_CONTAINER || "supabase_db_mfeinmphbsnjcchkmldi";
const OUT = "qa-artifacts/round3";
const sql = (q) =>
  execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-tAc", q], {
    encoding: "utf8",
  }).trim();
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// A QA project with a long README, a GitHub link and 40 commits in activity.
const maya = "(select id from auth.users where email = 'maya@tethyr.dev')";
const stamp = `QA r3 ${Date.now()}`;
const longReadme = Array.from(
  { length: 60 },
  (_, i) => `## Section ${i + 1}\n\nSome text for section ${i + 1}.`,
).join("\n\n");
const projectId = sql(
  `insert into projects (profile_id, title, description, readme, links, visibility, status)
   values (${maya}, '${stamp}', 'Round three QA', $md$${longReadme}$md$, '{"github":"https://github.com/vitejs/vite"}', 'public', 'active')
   returning id`,
).split("\n")[0];
const now = Date.now();
const commits = Array.from({ length: 40 }, (_, i) => {
  const at = new Date(now - (i < 25 ? i * 60_000 : 86_400_000 * 2 + i * 60_000)).toISOString();
  return `('${projectId}', null, 'github_commit', 'commit ${i + 1}', '', '{"external_id":"qa${i}-${now}","provider":"github","repository":"vitejs/vite","url":"https://github.com/vitejs/vite"}', '${at}')`;
});
sql(
  `insert into project_activity (project_id, actor_id, kind, title, body, metadata, created_at) values ${commits.join(",")}`,
);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
page.on("dialog", (d) => d.accept());

for (let attempt = 0; attempt < 3; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.fill("#email", "maya@tethyr.dev");
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: /log in/i }).click();
  if (
    await page.waitForURL(/dashboard/, { timeout: 8000 }).then(
      () => true,
      () => false,
    )
  )
    break;
}
await page.waitForTimeout(1500);

try {
  // ── README folds ──
  await page.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const more = page.getByRole("button", { name: "Show the full README" });
  log("readme: long README folds", (await more.count()) === 1);
  const folded = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Show the full README"),
    );
    const box = btn?.parentElement?.previousElementSibling;
    return box ? box.getBoundingClientRect().height : 9999;
  });
  log("readme: folded to a short height", folded < 700, `${Math.round(folded)}px`);
  await more.click();
  await page.waitForTimeout(500);
  log(
    "readme: Show the full README opens it",
    (await page.getByRole("button", { name: "Show less" }).count()) === 1,
  );
  await page.getByRole("button", { name: "Show less" }).click();

  // ── Activity folds commits ──
  const activityTab = page.getByRole("tab", { name: /activity/i });
  if (await activityTab.count()) await activityTab.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/activity-before.png`, fullPage: true });
  const run = page.getByRole("button", { name: /\d+ commits to vite/ }).first();
  log(
    "activity: same-day commits fold into one row",
    (await run.count()) === 1 &&
      (await page.getByRole("button", { name: /commits to vite/ }).count()) === 2,
  );
  await run.click();
  await page.waitForTimeout(400);
  log(
    "activity: the row opens to show each commit",
    (await page.getByRole("link", { name: "commit 2", exact: true }).count()) >= 1,
  );
  await page.getByRole("radio", { name: "Commits" }).click();
  await page.waitForTimeout(400);
  log(
    "activity: filter to commits",
    (await page.getByRole("radio", { name: "Commits", checked: true }).count()) === 1,
  );
  await page.screenshot({ path: `${OUT}/activity.png`, fullPage: false });

  // ── Explain this project (no AI) ──
  await page.getByRole("radio", { name: "Everything" }).click();
  await page.getByRole("button", { name: "Explain this project" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Read the whole project" }).click();
  await dlg
    .getByText("Run it locally")
    .waitFor({ timeout: 30000 })
    .catch(() => {});
  const md = await dlg
    .getByRole("tab", { name: "edit" })
    .click()
    .then(() => dlg.getByLabel("Doc (Markdown)").inputValue());
  log(
    "project docs: How it works from the repo",
    md.startsWith("# How") &&
      md.includes("## Run it locally") &&
      md.includes("## Where things live"),
    md.split("\n")[0],
  );
  log(
    "project docs: no key → link to add one",
    (await dlg.getByRole("link", { name: /Add your own AI key/ }).count()) === 1,
  );
  await dlg.getByRole("button", { name: "Add to the project README" }).click();
  await page.waitForTimeout(2000);
  log(
    "project docs: added to the README",
    sql(`select readme like '%## How%' from projects where id = '${projectId}'`) === "t",
  );
  await page.screenshot({ path: `${OUT}/project-docs.png` });

  // ── Paste code → docs → Library ──
  await page.goto(`${BASE}/library`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Code → docs" }).click();
  const d2 = page.getByRole("dialog");
  await d2.getByLabel("File name").fill("money.ts");
  await d2
    .getByLabel("Code")
    .fill(
      "/** Format cents as money. */\nexport function formatMoney(cents: number) {\n  return '';\n}\n// TODO: currencies\n",
    );
  await d2.getByRole("button", { name: "Write the docs" }).click();
  await page.waitForTimeout(600);
  log(
    "paste: doc written from the code",
    (await d2.getByText("Format cents as money.").count()) > 0,
  );
  await page.screenshot({ path: `${OUT}/paste-docs.png` });
  await d2.getByLabel("Title").fill(`${stamp} money docs`);
  await d2.getByRole("button", { name: "Save to Library" }).click();
  await page.waitForTimeout(2000);
  log(
    "paste: saved to Library as Markdown",
    sql(`select content_format from library_items where title = '${stamp} money docs'`) ===
      "markdown",
  );

  // ── Bring your own key refuses a bad key ──
  await page.goto(`${BASE}/settings`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  log(
    "settings: AI key section",
    (await page.getByRole("heading", { name: /bring your own key/i }).count()) === 1,
  );
  await page.getByLabel("Anthropic API key").fill("sk-ant-api03-not-a-real-key-qa-test-0000000000");
  await page.getByRole("button", { name: "Check & save key" }).click();
  await page
    .getByText(/didn't accept that key|Couldn't reach Anthropic/)
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  log(
    "settings: a bad key is refused",
    (await page.getByText(/didn't accept that key|Couldn't reach Anthropic/).count()) > 0,
  );
  log(
    "settings: nothing saved",
    sql(`select count(*) from user_ai_keys where user_id = ${maya}`) === "0",
  );
  await page.screenshot({ path: `${OUT}/settings.png` });
} finally {
  sql(
    `delete from project_activity where project_id = '${projectId}';
     delete from library_items where title like '${stamp}%' or project_id = '${projectId}';
     delete from projects where id = '${projectId}';`,
  );
}

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
