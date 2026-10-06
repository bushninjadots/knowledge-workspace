// Look gallery (dev tool, not shipped): every visual language, every layout
// and the brief's look × layout × theme combinations, rendered on a real,
// content-rich Studio — without saving anything.
//
// Opens the QA account's Studio with every write to the page, layout,
// profile and storage blocked at the network, applies each option in the
// editor, and screenshots the canvas. Reports any write that got through.
// Afterwards the page is reloaded from the server, unchanged.
//
//   node scripts/qa-look-gallery.mjs [--base URL]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
// Screenshots land in qa-artifacts/look-gallery/.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const OUT = "qa-artifacts/look-gallery";
mkdirSync(OUT, { recursive: true });

const LANGUAGES = [
  "Original",
  "Minimal",
  "Editorial",
  "Portfolio",
  "Technical",
  "Experimental",
  "Personal",
];
const LAYOUTS = [
  "Editorial",
  "Magazine",
  "Journal",
  "Portfolio",
  "Gallery",
  "Split",
  "For hire",
  "Technical",
  "Archive",
  "Linear",
  "Statement",
  "Collage",
  "Open canvas",
];
const COMBOS = [
  ["Editorial", "Editorial", "Paper"],
  ["Technical", "Technical", "Graphite"],
  ["Gallery", "Minimal", "Mono"],
  ["Portfolio", "Personal", "Default"],
  ["Archive", "Technical", "Obsidian"],
];
const WRITES =
  /\/rest\/v1\/(pages|layouts|profiles|page_versions)|\/rest\/v1\/rpc\/(apply|publish|save|update)|\/storage\/v1\//;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
const page = await context.newPage();
const leaked = [];
await page.route("**/*", (route) => {
  const request = route.request();
  if (request.method() !== "GET" && WRITES.test(request.url())) return route.abort();
  return route.continue();
});
page.on("requestfinished", (request) => {
  if (request.method() !== "GET" && WRITES.test(request.url())) leaked.push(request.url());
});

async function login() {
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
async function openStudio() {
  await page.goto(`${BASE}/studio`, { waitUntil: "load" });
  await page.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await page.waitForTimeout(3000);
}
const rail = () => page.locator("#studio-rail-panel");
async function identity() {
  const style = page.getByRole("tab", { name: "Style", exact: true }).first();
  if ((await style.getAttribute("aria-selected")) !== "true") await style.click();
  await rail().getByRole("tab", { name: "Identity", exact: true }).click();
}
async function language(name) {
  await identity();
  const section = rail().locator('section[aria-labelledby="vl-heading"]');
  await (
    name === "Original"
      ? section.getByRole("button", { name: /^Original/ })
      : section.getByRole("button", { name: new RegExp(`^${name}`) })
  ).click();
  await page.waitForTimeout(900);
}
async function layout(name) {
  await page
    .locator("[data-studio-builder] header")
    .getByRole("button", { name: /^layouts$/i })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: "Choose a layout" })
    .getByRole("button", { name: new RegExp(`^${name}\\b`) })
    .first()
    .click();
  await page.waitForTimeout(1500);
}
async function theme(name) {
  await identity();
  const tile = rail()
    .locator(`button[title="${name === "Default" ? "Default" : name}"]`)
    .first();
  await tile.click();
  await page.waitForTimeout(1500);
}
const shot = (file) => page.locator("#studio-canvas").screenshot({ path: `${OUT}/${file}.png` });
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, "-");

try {
  await login();
  await openStudio();
  for (const name of LANGUAGES) {
    await language(name);
    await shot(`language-${slug(name)}`);
    console.log("language", name);
  }
  await language("Original");
  for (const name of LAYOUTS) {
    await openStudio(); // a fresh, unsaved copy of the real page each time
    await layout(name);
    await shot(`layout-${slug(name)}`);
    console.log("layout", name);
  }
  for (const [layoutName, languageName, themeName] of COMBOS) {
    await openStudio();
    await layout(layoutName);
    await language(languageName);
    await theme(themeName);
    await shot(`combo-${slug(layoutName)}-${slug(languageName)}-${slug(themeName)}`);
    console.log("combo", layoutName, languageName, themeName);
  }
} catch (error) {
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  console.log(`✗ stopped: ${String(error).split("\n")[0]}`);
} finally {
  console.log(
    leaked.length
      ? `✗ ${leaked.length} writes got through: ${leaked.join(", ")}`
      : "✓ nothing was saved",
  );
  await browser.close();
}
