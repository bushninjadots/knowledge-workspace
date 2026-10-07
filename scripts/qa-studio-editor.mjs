// Studio editor regression harness (dev tool, not shipped).
//
// Re-checks the editor behaviours fixed after the 2026-10-06 editor audit, in
// a live browser: nothing is written just by opening the editor, edits are
// never lost on the way out, links inside blocks don't navigate while
// editing, selection always reaches the block's settings (desktop rail and
// phone sheet), blocks take keyboard focus, undo covers typing as one step and
// the width stepper, the device preview is the real page at a real width, and
// a second tab's write pauses saving instead of being overwritten.
//
// Every check edits and then undoes, so the account ends where it started,
// except `--restore`, which also exercises Version history → Restore and
// replaces the draft with the latest published version. Run it only on a
// throwaway account.
//
//   node scripts/qa-studio-editor.mjs [--base URL] [--restore]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const RESTORE = process.argv.includes("--restore");

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function login(context) {
  const page = await context.newPage();
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    const ok = await page
      .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return page;
  }
  throw new Error("login failed");
}

async function openStudio(page) {
  await page.goto(`${BASE}/studio`, { waitUntil: "load" });
  await page.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await page.waitForTimeout(3000);
}

const canvas = (page) => page.locator('[aria-label="Studio canvas"]');
const blank = (page) => canvas(page).click({ position: { x: 5, y: 5 } });
const status = (page) =>
  page.locator("[data-studio-builder] header [role=status]").first().innerText();
const railTab = (page) =>
  page
    .locator('[role=tablist][aria-label="Studio panels"] [aria-selected=true]')
    .innerText()
    .catch(() => "(closed)");
/** Click a block's frame edge: its content may be a link. */
const selectBlock = (page, n) =>
  page
    .locator(".react-grid-item")
    .nth(n)
    .click({ position: { x: 4, y: 40 } });
const areaToggle = (page, n) =>
  page
    .locator("section[data-section-id] header")
    .nth(n)
    .getByRole("button", { name: /area$/ })
    .last();

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await login(context);

  // 1 ─ opening the editor writes nothing and leaves the draft clean
  const writes = [];
  const onRequest = (r) => {
    if (
      ["PATCH", "POST", "PUT"].includes(r.method()) &&
      /rest\/v1\/(pages|layouts|rpc\/apply)/.test(r.url())
    )
      writes.push(r.url());
  };
  page.on("request", onRequest);
  await openStudio(page);
  await page.waitForTimeout(3000);
  page.off("request", onRequest);
  const openStatus = await status(page);
  log("opening the editor writes nothing", writes.length === 0, writes.join(", "));
  log("opening the editor leaves the draft clean", !/unsaved/i.test(openStatus), openStatus);

  // 2 ─ links inside blocks don't navigate while editing
  const link = page.locator(".react-grid-item a[href]").first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(1200);
    log(
      "a link inside a block selects it instead of navigating",
      page.url().endsWith("/studio"),
      page.url(),
    );
    if (!page.url().endsWith("/studio")) await openStudio(page);
  } else {
    console.log("  · no links inside blocks on this account; link check skipped");
  }

  // 3 ─ selection reaches settings, and the palette can't hide them
  await blank(page);
  await selectBlock(page, 1);
  await page.waitForTimeout(400);
  log(
    "selecting a block shows its settings",
    (await railTab(page)) === "Block",
    await railTab(page),
  );
  const before = await canvas(page).evaluate((e) => e.getBoundingClientRect().width);
  await page
    .getByRole("button", { name: /^Add block$/ })
    .first()
    .click();
  await selectBlock(page, 2);
  await page.waitForTimeout(400);
  const after = await canvas(page).evaluate((e) => e.getBoundingClientRect().width);
  log(
    "selecting a block while Add is open switches to its settings",
    (await railTab(page)) === "Block",
  );
  log(
    "selecting a block doesn't resize the canvas",
    Math.abs(after - before) < 2,
    `${before} → ${after}`,
  );

  // 4 ─ keyboard path to blocks
  const focusable = await page.locator(".react-grid-item[tabindex='0']").count();
  const frames = await page.locator(".react-grid-item").count();
  log(
    "every block takes keyboard focus",
    focusable === frames && frames > 0,
    `${focusable}/${frames}`,
  );
  await blank(page);
  await page.locator(".react-grid-item").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  log("Enter on a focused block selects it", (await railTab(page)) === "Block");

  // 5 ─ typing is one undo step; the new block goes on undo
  await page
    .getByRole("button", { name: /^Add block$/ })
    .first()
    .click();
  await page
    .locator("#studio-rail-panel")
    .getByRole("button", { name: /^Heading/ })
    .click();
  await page.waitForTimeout(500);
  const input = page
    .locator("#studio-rail-panel")
    .locator("input:not([type=range]):not([type=checkbox]):not([type=color]), textarea")
    .first();
  await input.fill("");
  await input.pressSequentially("Regression check", { delay: 40 });
  await page.waitForTimeout(1200);
  const headings = () => page.locator(".react-grid-item[aria-label='Heading block']").count();
  const added = await headings();
  await blank(page);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  const typedGone = !(await canvas(page).innerText()).includes("Regression check");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  log("a typed phrase is one undo step", typedGone);
  log("the next undo removes the added block", (await headings()) === added - 1);

  // 6 ─ the width stepper is its own undo step
  await selectBlock(page, 0);
  await page.waitForTimeout(300);
  const width = () =>
    page
      .locator("#studio-rail-panel span.w-5.font-mono")
      .first()
      .innerText()
      .catch(() => "?");
  const w0 = await width();
  const narrower = page.locator("#studio-rail-panel").getByRole("button", { name: "Narrower" });
  if (await narrower.isEnabled().catch(() => false)) {
    await narrower.click();
    await blank(page);
    await page.keyboard.press("Control+z");
    await selectBlock(page, 0);
    await page.waitForTimeout(300);
    log("undo reverts a width-stepper change", (await width()) === w0, `${w0} → ${await width()}`);
  }
  await page.waitForTimeout(2500);

  // 6a ─ multi-select: shift-click builds a selection; bulk edits are one undo step
  await blank(page);
  await selectBlock(page, 1);
  await page.keyboard.down("Shift");
  await selectBlock(page, 2);
  await selectBlock(page, 3);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(400);
  const multiTitle = await page
    .locator("#studio-rail-panel h2")
    .first()
    .innerText()
    .catch(() => "-");
  log("shift-click selects several blocks", /^3 blocks selected$/.test(multiTitle), multiTitle);
  const areas = () => page.locator("section[data-section-id]").count();
  const areas0 = await areas();
  await page
    .locator("#studio-rail-panel")
    .getByRole("button", { name: "Group into a new area" })
    .click();
  await page.waitForTimeout(600);
  const grouped = (await areas()) === areas0 + 1;
  await blank(page);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(600);
  log(
    "Group into a new area makes one area, undone in one step",
    grouped && (await areas()) === areas0,
    `${areas0} → ${grouped ? areas0 + 1 : "?"} → ${await areas()}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);

  // 6c ─ Shift+arrows resize the selected block, one undo step each
  await blank(page);
  await selectBlock(page, 1);
  await page.waitForTimeout(300);
  const w1 = await width();
  await page.keyboard.press("Shift+ArrowLeft");
  await page.waitForTimeout(300);
  const w2 = await width();
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  log(
    "Shift+arrow resizes the selected block and undo restores it",
    Number(w2) === Number(w1) - 1 && (await width()) === w1,
    `${w1} → ${w2} → ${await width()}`,
  );

  // 6d ─ Ctrl+J opens the command palette; a command runs and undoes
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+j");
  const palette = page.getByRole("dialog", { name: "Studio commands" });
  const paletteOpen = await palette.isVisible().catch(() => false);
  const headings0 = await headings();
  await palette.getByRole("combobox").fill("add heading");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const headings1 = await headings();
  await blank(page);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(500);
  log(
    "Ctrl+J opens the command palette and runs a command",
    paletteOpen && headings1 === headings0 + 1 && (await headings()) === headings0,
    `open=${paletteOpen} headings ${headings0} → ${headings1} → ${await headings()}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);

  // 6b ─ snap: a near-miss drag lines back up with its neighbour
  const pair = page
    .locator("section[data-section-id]")
    .filter({ has: page.locator(".react-grid-item:nth-child(2)") })
    .first();
  const mover = pair.locator(".react-grid-item").nth(1);
  if (await mover.count()) {
    await mover.scrollIntoViewIfNeeded();
    const before = await mover.boundingBox();
    await page.mouse.move(before.x + 30, before.y + 8);
    await page.mouse.down();
    await page.mouse.move(before.x + 50, before.y + 60, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    const after = await mover.boundingBox();
    log(
      "Snap lines a near-miss drop back up with its neighbour",
      Math.abs(after.y - before.y) < 4,
      `top ${Math.round(before.y)} → ${Math.round(after.y)}`,
    );
    await blank(page);
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(2500);
  }

  // 7 ─ leaving straight after an edit doesn't lose it (then put it back)
  const label0 = await areaToggle(page, 1).getAttribute("aria-label");
  await areaToggle(page, 1).click();
  await page.waitForTimeout(250);
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await page.waitForTimeout(2500);
  await openStudio(page);
  const label1 = await areaToggle(page, 1).getAttribute("aria-label");
  log("an edit made just before leaving is saved", label1 !== label0, `${label0} → ${label1}`);
  if (label1 !== label0) {
    await areaToggle(page, 1).click();
    await page.waitForTimeout(2500);
  }

  // 8 ─ the phone preview is the real page at a phone width
  await page.getByRole("radio", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Preview on a phone" }).click();
  await page.waitForTimeout(6000);
  const frame = page.locator("iframe[title^='Your Studio']");
  const frameWidth = await frame.evaluate((e) => e.clientWidth).catch(() => 0);
  const innerWidth = await page
    .frameLocator("iframe[title^='Your Studio']")
    .locator("body")
    .evaluate(() => window.innerWidth)
    .catch(() => 0);
  log(
    "phone preview is a 390px viewport",
    frameWidth === 390 && innerWidth === 390,
    `${frameWidth}/${innerWidth}`,
  );
  await page.getByRole("radio", { name: "Edit" }).click();
  await page.waitForTimeout(1500);

  // 9 ─ another tab's write pauses saving instead of being overwritten
  const second = await context.newPage();
  await openStudio(second);
  await areaToggle(second, 2).click();
  await second.waitForTimeout(3000);
  await areaToggle(page, 3).click();
  await page.waitForTimeout(3000);
  const conflict = page.getByRole("dialog").filter({ hasText: "changed somewhere else" });
  const paused = await conflict.isVisible().catch(() => false);
  log("a second tab's write pauses saving and asks", paused);
  if (paused) {
    await page.getByRole("button", { name: "Load the latest version" }).click();
    await page.waitForTimeout(2000);
  } else {
    // The write went through instead of pausing: undo it too, or the area
    // stays hidden in the account's draft for every later run.
    await areaToggle(page, 3).click();
    await page.waitForTimeout(3000);
  }
  // Put both toggles back from a fresh editor.
  await areaToggle(second, 2).click();
  await second.waitForTimeout(3000);
  await second.close();

  // 10 ─ (opt-in) Restore re-seeds the editor
  if (RESTORE) {
    await openStudio(page);
    await page.getByRole("button", { name: "More Studio actions" }).click();
    await page.getByRole("menuitem", { name: /version history/i }).click();
    const restore = page
      .getByRole("dialog", { name: "Published versions" })
      .getByRole("button")
      .filter({ hasText: /Discard draft|Restore/ })
      .first();
    await restore.click();
    await page.getByRole("button", { name: /Replace draft|Discard draft changes/ }).click();
    await page.waitForTimeout(3500);
    const shown = await status(page);
    log("after Restore the editor shows the restored draft", !/unsaved/i.test(shown), shown);
  }

  // Phone: tapping a block opens its settings in the sheet.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const m = await login(phone);
  await openStudio(m);
  await m
    .locator("[data-studio-builder] .studio-block")
    .nth(1)
    .tap({ position: { x: 120, y: 12 } });
  await m.waitForTimeout(900);
  const sheet = m.locator('section[aria-label="Mobile Studio editor"]');
  const sheetTab = await sheet
    .locator("[role=tab][aria-selected=true]")
    .innerText()
    .catch(() => "-");
  log("tapping a block on a phone opens its settings", sheetTab === "Block", sheetTab);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
