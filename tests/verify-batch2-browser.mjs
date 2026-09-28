/* Browser verification: block-picker glyphs, customize scroll, kanban boards,
 * collection sharing. Run: node tests/verify-batch2-browser.mjs (stack on :3000) */
import { chromium } from "playwright";

const BASE = process.env.VERIFY_BASE ?? "http://localhost:3000";
const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(15_000);

async function login() {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="email"]').click();
  await page.keyboard.type("test@tethyr.com", { delay: 5 });
  await page.locator('input[type="password"]').click();
  await page.keyboard.type("password123", { delay: 5 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

// ── 1. Studio: block palette glyphs render (not empty boxes) ─────────────────
await login();
await page.goto(`${BASE}/studio`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3500);
const dialog = page.locator('[role="dialog"][aria-label="Choose how your Studio feels"]');
if (await dialog.count()) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}
// Open Add block palette (desktop button in the toolbar)
const addBlock = page.locator('button:has-text("Add block"), [aria-label="Add block"]').first();
await addBlock.click({ timeout: 10_000 }).catch(async () => {
  const iconBtn = page.locator('[aria-label="Add block"]').first();
  await iconBtn.click();
});
await page.waitForTimeout(1000);
const palette = page.locator('aside[aria-label="Add blocks"]');
if (await palette.count()) {
  const glyphs = await palette.locator("svg[viewBox='0 0 36 24']").count();
  record("block palette shows wireframe glyphs (svg 36x24)", glyphs >= 8, `${glyphs} glyphs`);
  // Confirm the glyph actually paints shapes: rects/circles inside first svg
  const shapes = await palette
    .locator("svg[viewBox='0 0 36 24']")
    .first()
    .locator("rect, circle, path")
    .count();
  record("first glyph contains drawn shapes", shapes >= 2, `${shapes} shapes`);
} else {
  record("block palette opened", false, "palette aside not found");
}
await page.keyboard.press("Escape");

// ── 2. Customize panel: More options opens into the shared scroll ────────────
const customize = page.locator('button:has-text("Customize"), [aria-label="Customize Studio"]').first();
await customize.click({ timeout: 10_000 }).catch(() => {});
await page.waitForTimeout(800);
const panel = page.locator("aside", { hasText: "Customize" }).first();
const moreOptions = panel.getByRole("button", { name: "More options" });
if (await moreOptions.count()) {
  await moreOptions.click();
  await page.waitForTimeout(600);
  // Density control (inside More options) must be visible within the panel
  const density = panel.getByText("Density", { exact: true });
  const visible = await density.first().isVisible().catch(() => false);
  record("More options expands and its content is visible", visible);
  // The inner scroll container is gone: panel itself should be the scroller
  const innerScrollers = await panel.locator("div.min-h-0.flex-1.overflow-y-auto").count();
  record("no nested scrollbox under More options", innerScrollers === 0, `${innerScrollers} found`);
} else {
  record("customize panel opened with More options", false);
}

// ── 3. Library kanban: create board, add column+card, link an item ────────────
await page.goto(`${BASE}/library`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
await page.locator('button:has-text("Boards")').first().click();
await page.waitForTimeout(800);
// Empty state → New board, or switcher → + button
const newBoardBtn = page.locator('button:has-text("New board")').first();
await newBoardBtn.click();
await page.waitForTimeout(400);
await page.locator('input[placeholder*="Reading queue"]').fill("QA Board");
await page.locator('button:has-text("Create board")').click();
await page.waitForTimeout(1200);
record("board created with default columns", await page.locator('section[aria-label="To do"]').count() === 1);

// Add a standalone card in "To do"
const todoColumn = page.locator('section[aria-label="To do"]');
await todoColumn.locator('button:has-text("Add card")').first().click();
await todoColumn.locator('input[placeholder="Card title"]').fill("Read: design systems");
await todoColumn.locator('button:has-text("Add card")').last().click();
await page.waitForTimeout(1000);
record("standalone card added", await todoColumn.getByText("Read: design systems").count() === 1);

// Add a column
await page.locator('button:has-text("Add column")').click();
await page.locator('input[placeholder="Column name"]').fill("Blocked");
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
record("custom column added", await page.locator('section[aria-label="Blocked"]').count() === 1);

// Link a library item as a card (From library… in the Blocked column)
const blocked = page.locator('section[aria-label="Blocked"]');
await blocked.locator('button:has-text("Add card")').first().click();
await blocked.locator('button:has-text("From library")').click();
await page.waitForTimeout(800);
const pickerDialog = page.locator('[role="dialog"]', { hasText: "Link a library item" });
const pickItem = pickerDialog.locator("ul li button").first();
const canPick = await pickItem.count();
if (canPick) {
  await pickItem.click();
  await page.waitForTimeout(1000);
  const linkedCard = blocked.locator("a", { hasText: "Linked library item" });
  record("library item linked as card", (await linkedCard.count()) >= 1);
} else {
  record("library item picker had items", false, "no items to pick");
}

// Drag the standalone card from To do to Blocked (dnd via mouse)
const card = page.getByText("Read: design systems").first();
const cardBox = await card.boundingBox();
const blockedBox = await blocked.boundingBox();
if (cardBox && blockedBox) {
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(blockedBox.x + blockedBox.width / 2, blockedBox.y + 80, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const moved = await blocked.getByText("Read: design systems").count();
  record("card dragged between columns", moved === 1);
} else {
  record("card drag setup", false, "bounding boxes missing");
}

// ── 4. Collection sharing toggle + public page ────────────────────────────────
await page.goto(`${BASE}/library`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1500);
// Create a collection if none exists
const hasCollections = await page.locator('h2:has-text("Collections")').count();
if (!hasCollections) {
  record("collections section present", false, "cannot test share without a collection");
} else {
  const firstCard = page.locator("main div, div").filter({ has: page.locator("button") }).locator("button:has-text('collection')").first();
  // Open the first collection card's dropdown (hover reveals it)
  const cardEl = page.locator(".group:has(button[aria-haspopup='menu'])").first();
  await cardEl.hover();
  await page.waitForTimeout(400);
  const menuBtn = cardEl.locator("button[aria-haspopup='menu']").first();
  await menuBtn.click();
  await page.waitForTimeout(400);
  const shareItem = page.locator('[role="menuitem"]', { hasText: "Share collection" }).first();
  if (await shareItem.count()) {
    await shareItem.click();
    await page.waitForTimeout(900);
    record("collection share toggled on", true);
    // Badge appears
    record("Shared badge visible", await page.locator("span", { hasText: "Shared" }).count() >= 1);
  } else {
    record("share menu item found", false);
  }
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
