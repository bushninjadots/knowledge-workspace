// Visual language click-through (dev tool, not shipped).
//
// Signs up a throwaway account on the local stack and walks the flows from
// the visual-language brief, in a real browser:
//   1  choose a direction → change type, borders, colour → publish → the
//      public page renders the same look as the editor
//   2  an existing Studio (Maya, read only) still renders as Original
//   3  override a setting → "Modified" → Reset brings the direction back
//   4  one block opts out of the page's borders, and keeps that after reload
//   5  every direction on a phone: no sideways scroll on the public page
// plus a screenshot of every direction in the editor and on the public page.
//
//   node scripts/qa-visual-language.mjs [--base URL]
//
// Screenshots land in qa-artifacts/visual-language/. Only the new account is
// changed; Maya's Studio is opened, never edited.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const OUT = "qa-artifacts/visual-language";
mkdirSync(OUT, { recursive: true });

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A colourful gradient PNG, so image treatments have something to work on. */
function gradientPng(path, w = 1200, h = 400) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = 200 - Math.round((x / w) * 120);
      raw[i + 1] = 120 + Math.round((y / h) * 80);
      raw[i + 2] = 90 + Math.round((x / w) * 140);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 2;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const LANGUAGES = ["Minimal", "Editorial", "Portfolio", "Technical", "Experimental", "Personal"];
const id = Date.now().toString(36);
const HANDLE = `vlqa${id}`;

async function signUp(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/signup`, { waitUntil: "load" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(3000);
    if (await page.locator("#name").count()) await page.fill("#name", "Vee Language");
    if (await page.locator("#handle").count()) await page.fill("#handle", HANDLE);
    await page.fill("#email", `vlqa+${id}@tethyr.dev`);
    await page.fill("#password", "password123!A");
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

async function login(page, email, password) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.fill("#email", email);
    await page.fill("#password", password);
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
  // First-run starter strip: not needed here.
  const dismiss = page.getByRole("button", { name: /not now|dismiss|skip/i }).first();
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click().catch(() => {});
}

const rail = (page) => page.locator("#studio-rail-panel");
async function openStyle(page, tab) {
  const style = page.getByRole("tab", { name: "Style", exact: true }).first();
  if ((await style.getAttribute("aria-selected")) !== "true") await style.click();
  await page.waitForTimeout(200);
  await rail(page).getByRole("tab", { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
}
async function chooseLanguage(page, name) {
  await openStyle(page, "Identity");
  await rail(page)
    .locator('section[aria-labelledby="vl-heading"]')
    // Accessible names skip the aria-hidden preview drawn inside each tile.
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .first()
    .click();
  await page.waitForTimeout(700);
}
async function pick(page, tab, group, option) {
  await openStyle(page, tab);
  await rail(page)
    .getByRole("radiogroup", { name: group, exact: true })
    .getByRole("radio", { name: option, exact: true })
    .click();
  await page.waitForTimeout(500);
}
const canvasLook = (page) =>
  page
    .locator(".studio-canvas[data-vl-border]")
    .first()
    .evaluate((el) => {
      const out = {};
      for (const a of el.getAttributeNames())
        if (a.startsWith("data-vl-")) out[a] = el.getAttribute(a);
      const name = el.querySelector(".studio-name");
      const block = el.querySelector(".studio-block");
      out.nameFont = name ? getComputedStyle(name).fontFamily.split(",")[0] : null;
      out.nameSize = name ? getComputedStyle(name).fontSize : null;
      out.blockBorder = block ? getComputedStyle(block).borderBottomStyle : null;
      // The canvas palette (atmosphere) as resolved at the canvas; its own
      // background differs by design (the editor paints it on a parent).
      out.ink = getComputedStyle(el).getPropertyValue("--foreground").trim();
      out.paper = getComputedStyle(el).getPropertyValue("--background").trim();
      return out;
    });
const directionLabel = async (page) => {
  await openStyle(page, "Identity");
  return rail(page)
    .locator('section[aria-labelledby="vl-heading"] p:not(#vl-heading)')
    .first()
    .innerText();
};
async function save(page) {
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(2500);
}
async function publish(page) {
  await save(page);
  await page
    .locator("[data-studio-builder] header")
    .getByRole("button", { name: /^publish/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: /^publish/i })
    .last()
    .click();
  await page.waitForTimeout(3000);
}
async function publicPage(page, path) {
  await page.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "load" });
  await page.waitForSelector(".studio-canvas", { timeout: 30000 });
  await page.waitForTimeout(1500);
  if (path) await page.screenshot({ path, fullPage: true });
}

const browser = await chromium.launch();
let page;
try {
  // bypassCSP only so the axe check can load its script from cdnjs.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    bypassCSP: true,
  });
  page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await signUp(page);
  await openStudio(page);
  // A banner, so header and image treatments have a real image to style.
  const banner = `${OUT}/banner.png`;
  gradientPng(banner);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null),
    page
      .getByRole("button", { name: /add banner/i })
      .first()
      .click(),
  ]);
  if (chooser) {
    await chooser.setFiles(banner);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^upload$/i })
      .click({ timeout: 10000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(4000);
  }
  log(
    "the page has a banner image to style",
    !!chooser && (await page.locator("[data-banner] img").count()) > 0,
  );

  const original = await canvasLook(page);
  log(
    "a new Studio starts on Original",
    original["data-vl-border"] === "solid" &&
      original["data-vl-surface"] === "flat" &&
      /^Original/.test(await directionLabel(page)),
    JSON.stringify(original),
  );
  await rail(page).screenshot({ path: `${OUT}/panel-identity.png` });

  // Every direction in the editor.
  for (const name of LANGUAGES) {
    await chooseLanguage(page, name);
    await page
      .locator("#studio-canvas")
      .screenshot({ path: `${OUT}/editor-${name.toLowerCase()}.png` })
      .catch(async () => {
        await page.screenshot({ path: `${OUT}/editor-${name.toLowerCase()}.png` });
      });
  }

  // ── Flow 1 ────────────────────────────────────────────────────────────────
  await chooseLanguage(page, "Editorial");
  const editorial = await canvasLook(page);
  log(
    "Editorial changes several systems together",
    editorial["data-vl-border"] === "underline" &&
      editorial["data-vl-details"] === "editorial" &&
      /Fraunces/.test(editorial.nameFont ?? ""),
    JSON.stringify(editorial),
  );
  await pick(page, "Identity", "Type pairing", "Art");
  await pick(page, "Look", "Borders", "Dashed");
  await pick(page, "Identity", "Atmosphere", "Cool");
  const label = await directionLabel(page);
  log("changing settings marks the direction Modified", /Editorial · Modified/.test(label), label);
  await openStyle(page, "Look");
  await rail(page).screenshot({ path: `${OUT}/panel-style.png` });
  const editorLook = await canvasLook(page);
  await publish(page);
  await publicPage(page, `${OUT}/public-flow1.png`);
  const publicLook = await canvasLook(page);
  const keys = [
    "data-vl-border",
    "data-vl-divider",
    "data-vl-surface",
    "data-vl-grid",
    "nameFont",
    "blockBorder",
    "ink",
    "paper",
  ];
  const diff = keys.filter((k) => editorLook[k] !== publicLook[k]);
  log(
    "the public page renders the editor's look",
    diff.length === 0,
    diff.length ? diff.map((k) => `${k}: ${editorLook[k]} ≠ ${publicLook[k]}`).join("; ") : "",
  );

  // ── Flow 3 ────────────────────────────────────────────────────────────────
  await openStudio(page);
  await chooseLanguage(page, "Editorial");
  await pick(page, "Look", "Borders", "None");
  const modified = await directionLabel(page);
  await openStyle(page, "Look");
  await rail(page)
    .locator("div", { has: page.locator("p.t-label", { hasText: /^Borders$/ }) })
    .getByRole("button", { name: "Reset" })
    .first()
    .click();
  await page.waitForTimeout(500);
  const afterReset = await canvasLook(page);
  log(
    "Reset borders brings Editorial's borders back",
    /Modified/.test(modified) &&
      afterReset["data-vl-border"] === "underline" &&
      /^Editorial —/.test(await directionLabel(page)),
    `${modified.split("—")[0].trim()} → ${afterReset["data-vl-border"]}`,
  );

  // ── Flow 4 ────────────────────────────────────────────────────────────────
  await chooseLanguage(page, "Technical");
  const blocks = page.locator(".react-grid-item");
  await blocks.nth(1).click({ position: { x: 4, y: 30 } });
  await page.waitForTimeout(400);
  await rail(page)
    .getByRole("radiogroup", { name: "Card border for this block" })
    .getByRole("radio", { name: "None" })
    .click();
  await page.waitForTimeout(400);
  const borders = () =>
    page
      .locator(".react-grid-item .studio-block")
      .evaluateAll((els) => els.slice(0, 3).map((el) => getComputedStyle(el).borderTopStyle));
  const before = await borders();
  await page.keyboard.press("Escape");
  await save(page);
  await openStudio(page);
  const after = await borders();
  log(
    "one block opts out of the page's border and keeps it after reload",
    before[1] === "none" && before[0] !== "none" && after[1] === "none" && after[0] !== "none",
    `${before.join(",")} → ${after.join(",")}`,
  );

  // ── Block surface roles: one choice, and back to the profile style ───────
  await page
    .locator(".react-grid-item")
    .nth(1)
    .click({ position: { x: 4, y: 30 } });
  await page.waitForTimeout(400);
  const surfaces = rail(page).getByRole("radiogroup", { name: "Block surface" });
  const shadowOf = () =>
    page
      .locator(".react-grid-item .studio-block")
      .nth(1)
      .evaluate((el) => getComputedStyle(el).boxShadow);
  await surfaces.getByRole("radio", { name: "Raised" }).click();
  await page.waitForTimeout(400);
  const raised = await shadowOf();
  const scoped = await rail(page).getByText("This block only", { exact: true }).first().isVisible();
  await surfaces.getByRole("radio", { name: "Profile style" }).click();
  await page.waitForTimeout(400);
  const following = await rail(page)
    .getByText("Using profile style", { exact: true })
    .first()
    .isVisible();
  log(
    "a block surface role applies, and Profile style hands it back",
    raised !== "none" && scoped && following,
    `raised shadow: ${raised.slice(0, 40)}`,
  );
  await page.keyboard.press("Escape");

  // ── Flow 5 ────────────────────────────────────────────────────────────────
  // As the owner: some of a new account's areas are private to visitors.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  await login(mobile, `vlqa+${id}@tethyr.dev`, "password123!A");
  for (const name of LANGUAGES) {
    await chooseLanguage(page, name);
    await publish(page);
    await publicPage(page, `${OUT}/public-${name.toLowerCase()}.png`);
    // Accessibility of the published look (contrast above all).
    const axe = await page
      .addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" })
      .then(() =>
        page.evaluate(async () => {
          const result = await window.axe.run(".studio-canvas", {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
          });
          return result.violations.map(
            (v) => `${v.id}×${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
          );
        }),
      )
      .catch((error) => [`axe unavailable: ${String(error).slice(0, 80)}`]);
    log(`${name} passes axe (WCAG A/AA)`, axe.length === 0, axe.join(" | "));
    await mobile.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "load" });
    await mobile.waitForSelector(".studio-canvas", { timeout: 30000 });
    await mobile.waitForTimeout(1200);
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    await mobile.screenshot({ path: `${OUT}/phone-${name.toLowerCase()}.png`, fullPage: true });
    log(`${name} on a phone has no sideways scroll`, overflow <= 0, `overflow ${overflow}px`);
    await openStudio(page);
  }

  // ── Flow 2: an existing Studio, read only ─────────────────────────────────
  const maya = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const m = await maya.newPage();
  await login(m, "maya@tethyr.dev", "password123");
  await openStudio(m);
  const mayaLook = await canvasLook(m);
  log(
    "an existing Studio still renders as Original",
    mayaLook["data-vl-border"] === "solid" &&
      mayaLook["data-vl-surface"] === "flat" &&
      mayaLook["data-vl-divider"] === "none" &&
      /^Original —/.test(await directionLabel(m)),
    JSON.stringify(mayaLook),
  );
  log("no page errors", errors.length === 0, errors.join(" | "));
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
