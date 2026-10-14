// Round 4: edge-tab docks; consistent Library buttons; "How it connects";
// "Selected people" access (Devon sees it, signed-out visitors don't);
// release countdown → ship → congrats → Explore "Just shipped".
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const DB = process.env.QA_DB_CONTAINER || "supabase_db_mfeinmphbsnjcchkmldi";
const OUT = "qa-artifacts/round4";
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
const errors = [];
async function session(email) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  page.on("dialog", (d) => d.accept());
  if (!email) return page;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.fill("#email", email);
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
  return page;
}

const stamp = `QA r4 ${Date.now()}`;
const maya = "(select id from auth.users where email = 'maya@tethyr.dev')";
let projectId = "";
const page = await session("maya@tethyr.dev");
try {
  // ── Docks are edge tabs ──
  const notesTab = page.getByRole("button", { name: "Notes", exact: true });
  const box = await notesTab.boundingBox();
  log(
    "docks: Notes tab hugs the right edge",
    !!box && Math.round(box.x + box.width) >= 1438,
    `right=${box && Math.round(box.x + box.width)}`,
  );
  const msgBox = await page.getByRole("button", { name: /^Messages/ }).boundingBox();
  log(
    "docks: tabs stack vertically",
    !!box &&
      !!msgBox &&
      msgBox.y > box.y &&
      Math.abs(msgBox.x + msgBox.width - (box.x + box.width)) < 2,
  );
  await notesTab.hover();
  await page.waitForTimeout(400);
  const hovered = await notesTab.boundingBox();
  log(
    "docks: hover slides the label out",
    !!hovered && !!box && hovered.width > box.width + 20,
    `${box && Math.round(box.width)}→${hovered && Math.round(hovered.width)}px`,
  );
  await notesTab.click();
  await page.waitForTimeout(500);
  const panel = await page.getByRole("region", { name: "Notes" }).boundingBox();
  log(
    "docks: panel opens to the left of the tab",
    !!panel && panel.x + panel.width <= (hovered?.x ?? 0) + 4,
  );
  await page.screenshot({ path: `${OUT}/docks.png` });
  await page.keyboard.press("Escape");

  // ── Library buttons match ──
  await page.goto(`${BASE}/library`, { waitUntil: "load" });
  await page.waitForTimeout(2000);
  const classes = await page.evaluate(() =>
    [...document.querySelectorAll("header button")]
      .filter((b) => /Code → docs|Upload|New note/.test(b.textContent ?? ""))
      .map((b) => b.className),
  );
  log(
    "library: header buttons share one style",
    classes.length >= 2 && new Set(classes).size === 1,
    `${classes.length} buttons`,
  );

  // ── A project shared with selected people ──
  await page.getByRole("button", { name: "New project" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input[placeholder*='working name']").fill(stamp);
  await dialog.locator("textarea").first().fill("Round four QA.");
  // "Who can see it" is on whichever step holds it — pick it there.
  for (let i = 0; i < 2; i++) {
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(400);
    const radio = dialog.getByRole("radio", { name: /Selected people/ });
    if (await radio.isVisible().catch(() => false)) {
      await radio.click();
      await dialog.getByLabel("Add people").fill("devon");
      await dialog.getByRole("button", { name: /Devon Okafor/ }).click();
      break;
    }
  }
  log(
    "access: Devon added to the share list",
    (await dialog.getByRole("button", { name: "Stop sharing with Devon Okafor" }).count()) === 1,
  );
  while (
    await dialog
      .getByRole("button", { name: "Continue", exact: true })
      .isVisible()
      .catch(() => false)
  ) {
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(400);
  }
  await dialog.getByRole("button", { name: /publish project/i }).click();
  await page.waitForTimeout(3000);
  projectId = sql(`select id from projects where title = '${stamp}' limit 1`);
  log(
    "access: saved as Selected people",
    sql(`select visibility from projects where id = '${projectId}'`) === "people",
  );
  log(
    "access: share list saved",
    sql(`select count(*) from project_viewers where project_id = '${projectId}'`) === "1",
  );

  const devon = await session("devon@tethyr.dev");
  await devon.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
  await devon.waitForTimeout(2500);
  log("access: Devon can open it", (await devon.getByRole("heading", { name: stamp }).count()) > 0);
  const visitor = await session(null);
  await visitor.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
  await visitor.waitForTimeout(2500);
  log(
    "access: a signed-out visitor can't",
    (await visitor.getByRole("heading", { name: stamp }).count()) === 0,
  );

  // ── Release: countdown, ship, congrats, Explore ──
  sql(`update projects set visibility = 'public', status = 'completed' where id = '${projectId}'`);
  await page.goto(`${BASE}/projects/${projectId}`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  log(
    "release: 'Ready to ship?' when the work is done",
    (await page.getByText("Ready to ship?").count()) === 1,
  );
  await page.getByRole("button", { name: "Plan the release" }).click();
  const rel = page.getByRole("dialog");
  await rel.getByPlaceholder(/App Store/).fill("Try it at app.example.com");
  await rel.getByRole("button", { name: "Start the countdown" }).click();
  await page.waitForTimeout(2500);
  log("release: countdown shows", (await page.getByText("Launching in").count()) === 1);
  const t1 = await page.locator("[aria-label=Release]").innerText();
  await page.waitForTimeout(1500);
  const t2 = await page.locator("[aria-label=Release]").innerText();
  log("release: it ticks", t1 !== t2);
  await page.screenshot({ path: `${OUT}/countdown.png` });
  await page.getByRole("button", { name: "Edit release" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ship it now" }).click();
  await page.waitForTimeout(2500);
  log(
    "release: congrats banner",
    (await page.getByText("Your project has shipped — congrats!").count()) === 1,
  );
  log("release: shows Shipped", (await page.getByText("Shipped", { exact: true }).count()) > 0);
  await page.screenshot({ path: `${OUT}/shipped.png` });
  await page.goto(`${BASE}/explore`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const shelf = page.getByRole("region", { name: "Just shipped" });
  log("explore: Just shipped lists it", (await shelf.getByText(stamp).count()) === 1);
  await page.screenshot({ path: `${OUT}/explore.png` });
} finally {
  if (projectId)
    sql(
      `delete from notifications where entity_id = '${projectId}'; delete from projects where id = '${projectId}';`,
    );
}

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
