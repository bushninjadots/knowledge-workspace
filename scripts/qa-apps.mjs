// Apps click-through: start a project with "Where it lives" (pick GitHub,
// paste a Figma link) → app tiles on the project page; dashboard launcher
// (Obsidian desktop deep link + a web app); the AI wrap-up tool; a shared
// journal entry on the project timeline; phone layout. Cleans up after.
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = "qa-artifacts/apps";
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

async function login() {
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
    ) {
      await page.waitForTimeout(1500);
      return;
    }
  }
  throw new Error(`login failed; still on ${page.url()}`);
}

await login();
const stamp = `QA apps ${Date.now()}`;

// ── Start a project with apps ──
await page.getByRole("button", { name: "New project" }).first().click();
await page.waitForTimeout(800);
const dialog = page.getByRole("dialog");
await dialog.locator("input[placeholder*='working name']").fill(stamp);
await dialog.locator("textarea").first().fill("Automated apps test project.");
log("dialog: Where it lives on step 1", (await dialog.getByText("Where it lives").count()) === 1);
await dialog.getByRole("button", { name: "GitHub", exact: true }).click();
await dialog.getByLabel("GitHub link").fill("https://github.com/acme/qa-repo");
await dialog.getByLabel("Paste a link").fill("https://www.figma.com/design/abc/QA");
await dialog.getByLabel("Paste a link").press("Enter");
log("dialog: pasted Figma link recognised", (await dialog.getByLabel("Figma link").count()) === 1);
await dialog.getByRole("button", { name: "Add an app" }).click();
await dialog.getByLabel("Search apps").fill("linear");
log(
  "dialog: picker finds Linear",
  (await dialog.getByRole("button", { name: /^Linear/ }).count()) === 1,
);
await dialog.getByRole("button", { name: "Done" }).click();
await page.screenshot({ path: `${OUT}/project-dialog.png` });
for (let i = 0; i < 2; i++) {
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForTimeout(600);
}
await dialog.getByRole("button", { name: /publish project/i }).click();
await page.waitForTimeout(3000);

// Find the project (local QA database) and open it
const projectId = execFileSync(
  "docker",
  [
    "exec",
    process.env.QA_DB_CONTAINER || "supabase_db_mfeinmphbsnjcchkmldi",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-tAc",
    `select id from projects where title = '${stamp}' limit 1`,
  ],
  { encoding: "utf8" },
).trim();
let opened = false;
if (projectId) {
  await page.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
  opened = page.url().includes(projectId);
}
log("project: created and opened", opened, page.url());
if (opened) {
  await page.waitForTimeout(2500);
  log("project: GitHub tile", (await page.getByRole("link", { name: "GitHub" }).count()) > 0);
  log("project: Figma tile", (await page.getByRole("link", { name: "Figma" }).count()) > 0);
  await page.screenshot({ path: `${OUT}/project-header.png` });
}
const projectUrl = page.url();

// ── Dashboard launcher ──
await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForTimeout(2500);
log(
  "dashboard: Your apps section",
  (await page.getByRole("heading", { name: /Your apps/ }).count()) === 1,
);
// clear leftovers
const edit = page.getByRole("button", { name: /^Edit$/ });
if (await edit.count()) {
  await edit.click();
  while (await page.getByRole("button", { name: /^Remove / }).count()) {
    await page
      .getByRole("button", { name: /^Remove / })
      .first()
      .click();
    await page.waitForTimeout(600);
  }
  const done = page.getByRole("button", { name: "Done" });
  if (await done.count()) await done.click();
}
await page
  .getByRole("button", { name: /Add an app|^Add$/ })
  .first()
  .click();
const addDialog = page.getByRole("dialog");
await addDialog.getByLabel("Search apps").fill("obsidian");
await addDialog.getByRole("button", { name: /^Obsidian/ }).click();
await addDialog.getByPlaceholder("Work notes").fill("Work notes");
log(
  "launcher: Obsidian deep link built",
  (await addDialog.getByText("obsidian://open?vault=Work%20notes").count()) === 1,
);
await addDialog.getByRole("button", { name: "Add to my apps" }).click();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Add$/ }).click();
await addDialog.getByLabel("Search apps").fill("linear");
await addDialog.getByRole("button", { name: /^Linear/ }).click();
await addDialog.getByPlaceholder(/linear\.app/).fill("https://linear.app/acme/team/QA");
await addDialog.getByRole("button", { name: "Add to my apps" }).click();
await page.waitForTimeout(1500);
const obsidianTile = page.getByRole("button", { name: "Work notes", exact: true });
log("launcher: Obsidian tile", (await obsidianTile.count()) === 1);
log(
  "launcher: marked as desktop app",
  ((await obsidianTile.getAttribute("title")) ?? "").includes("on this computer"),
);
log(
  "launcher: Linear tile",
  (await page.getByRole("button", { name: "Linear", exact: true }).count()) === 1,
);
// The click opens a new tab for web apps
const [popup] = await Promise.all([
  page.waitForEvent("popup", { timeout: 5000 }).catch(() => null),
  page.getByRole("button", { name: "Linear", exact: true }).click(),
]);
log(
  "launcher: web app opens in a new tab",
  !!popup && popup.url().includes("linear.app"),
  popup?.url(),
);
await popup?.close();
await page.screenshot({ path: `${OUT}/launcher.png` });

// ── AI wrap-up via MCP, then a shared entry on the project timeline ──
await page.goto(`${BASE}/journal`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.getByLabel("Token name").fill(`QA wrap ${stamp}`);
await page.getByRole("button", { name: "Create token" }).click();
await page.waitForTimeout(1500);
const token = (await page.locator("code").filter({ hasText: /^tth_/ }).first().innerText()).trim();
const call = (body) =>
  page.evaluate(
    async ({ base, token, body }) => {
      const r = await fetch(`${base}/api/mcp?client=claude-code`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return r.json();
    },
    { base: BASE, token, body },
  );
const prompts = await call({ jsonrpc: "2.0", id: 1, method: "prompts/list" });
log(
  "mcp: wrap_up prompt listed",
  prompts.result?.prompts?.some((p) => p.name === "wrap_up"),
);
const wrap = await call({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "wrap_up_session",
    arguments: {
      project: stamp,
      did: [`Shipped the launcher ${stamp}`],
      decided: ["Keep deep links private"],
      next: ["Polish the app picker"],
    },
  },
});
log(
  "mcp: wrap_up_session logs 3 entries",
  /3 entries/.test(wrap.result?.content?.[0]?.text ?? ""),
  wrap.result?.content?.[0]?.text,
);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(2000);
const shipped = page.locator("li", { hasText: `Shipped the launcher ${stamp}` });
log(
  "journal: wrap-up entries appear (via Claude Code)",
  (await shipped.getByText("via Claude Code").count()) === 1,
);
await shipped.hover();
await shipped.getByRole("button", { name: "Show on your profile" }).click();
await page.waitForTimeout(1200);
if (opened) {
  await page.goto(projectUrl, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const activityTab = page.getByRole("tab", { name: /activity/i });
  if (await activityTab.count()) await activityTab.first().click();
  await page.waitForTimeout(1500);
  log(
    "project: shared journal entry on the timeline",
    (await page.getByText(`Shipped the launcher ${stamp}`).count()) > 0,
  );
  await page.screenshot({ path: `${OUT}/project-timeline.png`, fullPage: true });
}

// ── Phone ──
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForTimeout(2000);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
log("phone: dashboard has no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
await page.screenshot({ path: `${OUT}/phone.png`, fullPage: false });

// Clean up (local QA database)
execFileSync(
  "docker",
  [
    "exec",
    process.env.QA_DB_CONTAINER || "supabase_db_mfeinmphbsnjcchkmldi",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-c",
    `delete from journal_entries where project_id = (select id from projects where title = '${stamp}');
     delete from journal_tokens where name = 'QA wrap ${stamp}';
     delete from member_apps where url in ('obsidian://open?vault=Work%20notes', 'https://linear.app/acme/team/QA');
     delete from projects where title = '${stamp}';`,
  ],
  { stdio: "ignore" },
);

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
