// Layout templates click-through (dev tool, not shipped).
//
// Signs up a throwaway account on the local stack, chooses a look, then
// applies every layout from the Layouts picker and checks, in a real browser:
//   • every block is still there and no two block frames overlap
//   • the look (data-vl-* on the canvas, the name's face) didn't change
//   • the composition survives a save and a reload (the grid is saved)
//   • on a phone the public page never scrolls sideways
// Screenshots of the picker and every layout land in qa-artifacts/layouts/.
//
//   node scripts/qa-layouts.mjs [--base URL]
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const OUT = "qa-artifacts/layouts";
mkdirSync(OUT, { recursive: true });
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const LAYOUTS = [
  "Editorial",
  "Magazine",
  "Journal",
  "Portfolio",
  "Gallery",
  "Split",
  "Technical",
  "Archive",
  "Linear",
  "Statement",
  "Collage",
  "Open canvas",
];
const id = Date.now().toString(36);
const HANDLE = `lyqa${id}`;
const EMAIL = `lyqa+${id}@tethyr.dev`;
const PASSWORD = "password123!A";

async function signUp(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/signup`, { waitUntil: "load" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(3000);
    if (await page.locator("#name").count()) await page.fill("#name", "Lee Layout");
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
async function login(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    const ok = await page
      .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
  }
  throw new Error("login failed");
}
async function openStudio(page) {
  await page.goto(`${BASE}/studio`, { waitUntil: "load" });
  await page.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await page.waitForTimeout(2500);
}
async function openLayouts(page) {
  await page
    .locator("[data-studio-builder] header")
    .getByRole("button", { name: /^layouts$/i })
    .first()
    .click();
  await page.getByRole("dialog", { name: "Choose a layout" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
}
const canvasState = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector(".studio-canvas[data-vl-border]");
    const look = {};
    for (const a of canvas.getAttributeNames())
      if (a.startsWith("data-vl-")) look[a] = canvas.getAttribute(a);
    const name = canvas.querySelector(".studio-name");
    look.nameFont = name ? getComputedStyle(name).fontFamily.split(",")[0] : null;
    const frames = [...document.querySelectorAll("[data-block-id]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.blockId, x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const overlaps = [];
    for (const a of frames)
      for (const b of frames)
        if (
          a.id < b.id &&
          a.x < b.x + b.w - 2 &&
          b.x < a.x + a.w - 2 &&
          a.y < b.y + b.h - 2 &&
          b.y < a.y + a.h - 2
        )
          overlaps.push(`${a.id}×${b.id}`);
    const placement = Object.fromEntries(
      frames.map((f) => [f.id, `${Math.round(f.x)},${Math.round(f.w)}`]),
    );
    const counts = {};
    for (const f of frames) counts[f.id] = (counts[f.id] ?? 0) + 1;
    const twice = Object.keys(counts).filter((k) => counts[k] > 1);
    return { look, blocks: frames.map((f) => f.id).sort(), overlaps, placement, twice };
  });

const browser = await chromium.launch();
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signUp(page);
  await openStudio(page);
  // A look first, so we can prove layouts leave it alone.
  await page.getByRole("tab", { name: "Style", exact: true }).first().click();
  await page
    .locator("#studio-rail-panel")
    .locator('section[aria-labelledby="vl-heading"]')
    .getByRole("button", { name: /^Technical/ })
    .click();
  await page.waitForTimeout(800);
  const start = await canvasState(page);

  await openLayouts(page);
  await page.screenshot({ path: `${OUT}/picker.png` });
  await page.keyboard.press("Escape");

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  await login(mobile);

  for (const name of LAYOUTS) {
    await openLayouts(page);
    await page
      .getByRole("dialog", { name: "Choose a layout" })
      .getByRole("button", { name: new RegExp(`^${name}\\b`) })
      .first()
      .click();
    await page.waitForTimeout(1500);
    const state = await canvasState(page);
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await page.locator("#studio-canvas").screenshot({ path: `${OUT}/editor-${slug}.png` });
    const kept = state.blocks.join() === start.blocks.join();
    const lookKept = JSON.stringify(state.look) === JSON.stringify(start.look);
    log(
      `${name}: keeps every block, nothing overlaps, look unchanged`,
      kept && state.overlaps.length === 0 && lookKept,
      [
        !kept &&
          `blocks ${start.blocks.length}→${state.blocks.length} (twice: ${state.twice.join(" ")})`,
        state.overlaps.length && `overlaps ${state.overlaps.join(" ")}`,
        !lookKept && `look ${JSON.stringify(state.look)}`,
      ]
        .filter(Boolean)
        .join("; "),
    );
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(2500);
    await openStudio(page);
    const reloaded = await canvasState(page);
    const same = JSON.stringify(reloaded.placement) === JSON.stringify(state.placement);
    log(`${name}: composition survives save and reload`, same);

    // Publish and check the phone.
    await page
      .locator("[data-studio-builder] header")
      .getByRole("button", { name: /^publish/i })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^publish/i })
      .last()
      .click();
    await page.waitForTimeout(2500);
    await mobile.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "load" });
    await mobile.waitForSelector(".studio-canvas", { timeout: 30000 });
    await mobile.waitForTimeout(1200);
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    await mobile.screenshot({ path: `${OUT}/phone-${slug}.png`, fullPage: true });
    log(`${name}: no sideways scroll on a phone`, overflow <= 0, `${overflow}px`);
    await openStudio(page);
  }
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
