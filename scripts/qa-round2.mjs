// Round 2: edit a project from its page; new projects show on Explore;
// a project's GitHub repo feeds the journal; the launcher falls back to the
// web version when a desktop app isn't installed; Library is back in the nav
// with a simple Rich text / Markdown switch; the Dev journal Studio block.
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const DB = process.env.QA_DB_CONTAINER || "supabase_db_mfeinmphbsnjcchkmldi";
const OUT = "qa-artifacts/round2";
const sql = (q) =>
  execFileSync("docker", ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-tAc", q], {
    encoding: "utf8",
  }).trim();
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
const stamp = `QA r2 ${Date.now()}`;

// ── Explore picks up a new project (load Explore first so it's cached) ──
await page.goto(`${BASE}/explore`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "New project" }).first().click();
const dialog = page.getByRole("dialog");
await dialog.locator("input[placeholder*='working name']").fill(stamp);
await dialog.locator("textarea").first().fill("Round two QA project.");
await dialog.getByRole("button", { name: "GitHub", exact: true }).click();
await dialog.getByLabel("GitHub link").fill("https://github.com/vitejs/vite");
for (let i = 0; i < 2; i++) {
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForTimeout(500);
}
await dialog.getByRole("button", { name: /publish project/i }).click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/explore`, { waitUntil: "load" });
await page.waitForTimeout(2500);
log("explore: new project shows", (await page.getByText(stamp).count()) > 0);

// ── Edit from the project page ──
const projectId = sql(`select id from projects where title = '${stamp}' limit 1`);
await page.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const editBtn = page.getByRole("button", { name: "Edit project" });
log("project: owner sees Edit project", (await editBtn.count()) === 1);
await editBtn.click();
await page.waitForTimeout(800);
const edit = page.getByRole("dialog");
log(
  "edit: has name, cover, gallery, links",
  (await edit.getByText(/Gallery images/).count()) === 1 &&
    (await edit.getByText("Where it lives").count()) === 1,
);
await edit.locator("input[placeholder*='working name']").fill(`${stamp} renamed`);
await edit
  .getByRole("button", { name: /save|update/i })
  .last()
  .click();
await page.waitForTimeout(2500);
log(
  "edit: new name on the page",
  (await page.getByRole("heading", { name: `${stamp} renamed` }).count()) > 0,
);
await page.screenshot({ path: `${OUT}/project-edit.png` });

// ── Project repo → journal ──
// The member is connected to GitHub as someone who didn't write these
// commits, so (correctly) none are theirs. Disconnect for the check, then put
// the account back exactly as it was.
const maya = "(select id from auth.users where email = 'maya@tethyr.dev')";
sql(`create table if not exists qa_saved_accounts as select * from connected_accounts where false`);
sql(
  `insert into qa_saved_accounts select * from connected_accounts where user_id = ${maya} and provider = 'github'`,
);
sql(`delete from connected_accounts where user_id = ${maya} and provider = 'github'`);
try {
  await page.goto(`${BASE}/journal`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Sync from projects" }).click();
  await page.waitForTimeout(8000);
} finally {
  sql(`insert into connected_accounts select * from qa_saved_accounts`);
  sql(`drop table qa_saved_accounts`);
}
const synced = sql(
  `select count(*) from journal_entries where project_id = '${projectId}' and source = 'github'`,
);
log("journal: commits from the project's GitHub repo", Number(synced) > 0, `${synced} entries`);
await page.goto(`${BASE}/journal`, { waitUntil: "load" });
await page.waitForTimeout(2500);
log(
  "journal: Sync from projects button",
  (await page.getByRole("button", { name: "Sync from projects" }).count()) === 1,
);
log(
  "journal: synced entries listed (via GitHub)",
  (await page.getByText("via GitHub").count()) > 0,
);
await page.screenshot({ path: `${OUT}/journal-sync.png` });

// ── Launcher web fallback ──
sql(
  `delete from member_apps where user_id = (select id from auth.users where email = 'maya@tethyr.dev')`,
);
await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page
  .getByRole("button", { name: /Add an app/ })
  .first()
  .click();
const add = page.getByRole("dialog");
await add.getByLabel("Search apps").fill("vs code");
await add.getByRole("button", { name: /^VS Code/ }).click();
await add.getByPlaceholder("/Users/you/code/my-app").fill("/home/me/code/tethyr");
log(
  "launcher: asks for a web version",
  (await add.getByText(/isn't installed, open/).count()) === 1,
);
await add.getByPlaceholder(/vscode\.dev\/github/).fill("https://vscode.dev/github/vitejs/vite");
await add.getByRole("button", { name: "Add to my apps" }).click();
await page.waitForTimeout(1500);
const [popup] = await Promise.all([
  page.waitForEvent("popup", { timeout: 6000 }).catch(() => null),
  page.getByRole("button", { name: "tethyr", exact: true }).click(),
]);
log(
  "launcher: not installed → web version in a new tab",
  !!popup && popup.url().includes("vscode.dev"),
  popup?.url(),
);
await popup?.close();

// ── Library is back, with a simple format switch ──
log(
  "nav: Library link",
  (await page.getByRole("link", { name: "Library", exact: true }).count()) > 0,
);
const noteId = sql(
  `insert into library_items(user_id, title, content, type) values ((select id from auth.users where email = 'maya@tethyr.dev'), '${stamp} note', '<p>hi</p>', 'note') returning id`,
).split("\n")[0];
await page.goto(`${BASE}/library/${noteId}`, { waitUntil: "load" });
await page.waitForTimeout(2500);
log(
  "library: Rich text / Markdown switch",
  (await page.getByRole("tab", { name: /Rich text/ }).count()) +
    (await page.getByText("Rich text").count()) >
    0 && (await page.getByText("Code workspace").count()) === 0,
);

// ── Studio palette offers the Dev journal block ──
await page.goto(`${BASE}/studio`, { waitUntil: "load" });
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Add block" }).first().click();
await page.waitForTimeout(800);
const search = page.getByPlaceholder(/search/i).last();
if (await search.count()) await search.fill("journal");
await page.waitForTimeout(800);
log("studio: Dev journal block available", (await page.getByText("Dev journal").count()) > 0);
await page.screenshot({ path: `${OUT}/studio.png` });

// Clean up
sql(
  `delete from journal_entries where project_id = '${projectId}';
   delete from projects where id = '${projectId}';
   delete from library_items where id = '${noteId}';
   delete from member_apps where user_id = (select id from auth.users where email = 'maya@tethyr.dev')`,
);
log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
