// Site appearance click-through (dev tool, not shipped).
//
// Settings → Site appearance changes how Tethyr itself looks, and follows the
// member to every device (saved on their profile, and reset at the end):
//   • every theme applies, and the Settings page passes axe in each
//   • density, shape and accent reach real app controls
//   • choices survive a reload (painted before hydration)
//   • a profile looks the same whatever the visitor chose for Tethyr
//   • it follows the member to a fresh browser
//   • Reset leaves nothing behind
//   • the browser toolbar (theme-color) matches the painted background
// Screenshots land in qa-artifacts/site-appearance/.
//
//   node scripts/qa-site-appearance.mjs [--base URL]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const OUT = "qa-artifacts/site-appearance";
mkdirSync(OUT, { recursive: true });
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const THEMES = [
  "Mono",
  "Obsidian",
  "Terminal",
  "Midnight",
  "Signal",
  "Studio",
  "Paper",
  "Graphite",
  "Forest",
  "Archive",
  "Gallery",
];

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
const section = (page) => page.locator("#site-appearance");
async function openSettings(page) {
  await page.goto(`${BASE}/settings`, { waitUntil: "load" });
  await section(page).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
const htmlVar = (page, name) =>
  page.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), name);
const profileTokens = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector(".studio-canvas");
    const cs = canvas ? getComputedStyle(canvas) : null;
    return cs
      ? {
          background: cs.getPropertyValue("--background").trim(),
          primary: cs.getPropertyValue("--primary").trim(),
          spacing: cs.getPropertyValue("--spacing").trim(),
          radius: cs.getPropertyValue("--radius-md").trim(),
          font: cs.fontFamily.split(",")[0],
        }
      : null;
  });
async function axe(page) {
  try {
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
    });
    return await page.evaluate(async () => {
      const result = await window.axe.run("#site-appearance", {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
      return result.violations.map((v) => `${v.id}×${v.nodes.length}`);
    });
  } catch (error) {
    return [`axe unavailable: ${String(error).slice(0, 60)}`];
  }
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
  await login(page);

  // Baseline: a profile as it renders with Tethyr's defaults.
  await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
  await page.waitForSelector(".studio-canvas", { timeout: 30000 });
  await page.waitForTimeout(1500);
  const baseline = await profileTokens(page);

  await openSettings(page);
  await section(page).screenshot({ path: `${OUT}/settings-default.png` });

  for (const name of THEMES) {
    await section(page)
      .getByRole("button", { name: new RegExp(`^${name}\\b`) })
      .first()
      .click();
    await page.waitForTimeout(900);
    const applied = await htmlVar(page, "--background");
    const violations = await axe(page);
    await section(page).screenshot({ path: `${OUT}/settings-${name.toLowerCase()}.png` });
    log(
      `${name} applies to Tethyr and Settings passes axe`,
      !!applied && violations.length === 0,
      violations.join(" "),
    );
  }

  // Obsidian, compact, rounded, violet — then measure real controls.
  await section(page)
    .getByRole("button", { name: /^Obsidian\b/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  log(
    "a dark theme brings dark mode with it",
    await page.evaluate(() => document.documentElement.classList.contains("dark")),
  );
  // The browser toolbar takes the painted background, not a fixed colour.
  const toolbar = await page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--background");
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const painted = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content);
    return { painted, metas };
  });
  log(
    "the browser toolbar matches the theme",
    toolbar.metas.length > 0 && toolbar.metas.every((c) => c === toolbar.painted),
    JSON.stringify(toolbar),
  );
  const measure = () =>
    page.evaluate(() => {
      const button =
        [...document.querySelectorAll("#site-appearance button")].find((b) =>
          /reset site appearance/i.test(b.textContent ?? ""),
        ) ?? document.querySelector("#site-appearance [role=radio]");
      const field = document.querySelector("input");
      return {
        radioHeight: Math.round(
          document.querySelector("#site-appearance [role=radio]").getBoundingClientRect().height,
        ),
        fieldRadius: field ? getComputedStyle(field).borderRadius : null,
        sectionPad: getComputedStyle(document.querySelector("#site-appearance")).paddingTop,
        button: !!button,
      };
    });
  const before = await measure();
  await section(page)
    .getByRole("radiogroup", { name: "Density" })
    .getByRole("radio", { name: "Compact" })
    .click();
  await section(page)
    .getByRole("radiogroup", { name: "Shape" })
    .getByRole("radio", { name: "Rounded" })
    .click();
  await section(page)
    .getByRole("radiogroup", { name: "Accent" })
    .getByRole("radio", { name: "Violet" })
    .click();
  await page.waitForTimeout(800);
  const after = await measure();
  log(
    "density, shape and accent reach real controls",
    after.radioHeight < before.radioHeight &&
      after.fieldRadius !== before.fieldRadius &&
      (await htmlVar(page, "--primary")) === "#7a4ecf",
    `radio ${before.radioHeight}→${after.radioHeight}px, field radius ${before.fieldRadius}→${after.fieldRadius}`,
  );
  await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/dashboard-obsidian-compact-rounded-violet.png` });

  await page.reload({ waitUntil: "domcontentloaded" });
  const painted = await htmlVar(page, "--spacing");
  log("choices survive a reload, painted before hydration", painted === "0.225rem", painted);

  // It follows the member: a fresh browser (no local copy) gets it from the account.
  await page.waitForTimeout(1500); // the account write is debounced
  const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const second = await other.newPage();
  {
    const keep = page;
    page = second;
    await login(page);
    page = keep;
  }
  await second.goto(`${BASE}/dashboard`, { waitUntil: "load" });
  await second.waitForTimeout(4000);
  const synced = await second.evaluate(() => ({
    spacing: document.documentElement.style.getPropertyValue("--spacing").trim(),
    primary: document.documentElement.style.getPropertyValue("--primary").trim(),
  }));
  log(
    "it follows the member to another browser",
    synced.spacing === "0.225rem" && synced.primary === "#7a4ecf",
    JSON.stringify(synced),
  );
  await other.close();

  // Light/dark is the visitor's to choose and profiles follow it; hold it at
  // light so only the theme, density, shape and accent are under test.
  await page.evaluate(() => localStorage.setItem("tethyr-theme", "light"));
  await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
  await page.waitForSelector(".studio-canvas", { timeout: 30000 });
  await page.waitForTimeout(1500);
  const visited = await profileTokens(page);
  await page.screenshot({ path: `${OUT}/profile-under-obsidian.png` });
  const diff = Object.keys(baseline ?? {}).filter((k) => baseline[k] !== visited?.[k]);
  log(
    "a profile looks the same whatever the visitor chose for Tethyr",
    !!baseline && diff.length === 0,
    diff.map((k) => `${k}: ${baseline[k]} → ${visited[k]}`).join("; "),
  );

  await openSettings(page);
  await section(page)
    .getByRole("button", { name: /reset site appearance/i })
    .click();
  await page.waitForTimeout(800);
  const left = await page.evaluate(() => document.documentElement.getAttribute("style") ?? "");
  log(
    "Reset leaves nothing behind",
    !/--spacing|--radius|--primary:|--background/.test(left),
    left.slice(0, 120),
  );
} catch (error) {
  await page?.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  console.log(`✗ stopped: ${String(error).split("\n")[0]} (see ${OUT}/failure.png)`);
  results.push({ name: "run", ok: false });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
