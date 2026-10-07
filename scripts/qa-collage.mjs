// Collage overlap check (dev tool, not shipped), on a real content-rich page
// without saving anything.
//
// Applies Collage in the QA account's Studio with every write blocked, keeps
// the sections the editor tried to save, then shows them to a signed-out
// visitor in place of the published layout (intercepted at the network) and
// measures the result:
//   • overlapping pieces reach over the edge of the piece above
//   • they never cover its content
//   • the page passes axe, and phones stack without overlap
// Screenshots land in qa-artifacts/collage/.
//
//   node scripts/qa-collage.mjs [--base URL]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123),
// QA_HANDLE (maya).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const HANDLE = process.env.QA_HANDLE || "maya";
const OUT = "qa-artifacts/collage";
mkdirSync(OUT, { recursive: true });
const WRITES =
  /\/rest\/v1\/(pages|layouts|profiles|page_versions)|\/rest\/v1\/rpc\/(apply|publish|save|update)|\/storage\/v1\//;

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Every visible [data-overlap] cell: its top margin, how many frames it
 *  layers over, and how many of those it covers content of. */
const measure = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-overlap]")]
      .filter((cell) => !cell.hidden && cell.getBoundingClientRect().height > 0)
      .map((cell) => {
        const me = cell.getBoundingClientRect();
        const under = [...document.querySelectorAll(".studio-block")]
          .filter((frame) => !cell.contains(frame))
          .map((frame) => {
            const r = frame.getBoundingClientRect();
            const content = [...frame.querySelectorAll("*")]
              .filter((el) => el.children.length === 0 && el.getBoundingClientRect().height > 0)
              .reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), r.top);
            return { r, content };
          })
          .filter(
            ({ r }) =>
              r.left < me.right && me.left < r.right && r.top < me.top && r.bottom > me.top,
          );
        return {
          kind: cell.getAttribute("data-overlap"),
          margin: Math.round(parseFloat(getComputedStyle(cell).marginTop)),
          layeredBy: Math.round(Math.max(0, ...under.map(({ r }) => r.bottom - me.top))),
          layered: under.length,
          covered: under.filter(({ content }) => content > me.top + 1).length,
        };
      }),
  );

async function axe(page) {
  try {
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
    });
    return await page.evaluate(async () => {
      const result = await window.axe.run(".studio-canvas", {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });
      return result.violations.map((v) => `${v.id}×${v.nodes.length}`);
    });
  } catch (error) {
    return [`axe unavailable: ${String(error).slice(0, 60)}`];
  }
}

const browser = await chromium.launch();
const leaked = [];
try {
  // 1. The sections Collage composes for this account, captured, not saved.
  const editor = await (
    await browser.newContext({ viewport: { width: 1440, height: 1200 } })
  ).newPage();
  let sections = null;
  await editor.route("**/*", (route) => {
    const request = route.request();
    if (request.method() !== "GET" && WRITES.test(request.url())) {
      if (request.url().includes("apply_studio_composition")) {
        sections = JSON.parse(request.postData() ?? "{}").p_sections ?? sections;
      }
      return route.abort();
    }
    return route.continue();
  });
  editor.on("requestfinished", (request) => {
    if (request.method() !== "GET" && WRITES.test(request.url())) leaked.push(request.url());
  });
  await editor.goto(`${BASE}/login`, { waitUntil: "load" });
  await editor.waitForSelector("#email", { timeout: 20000 });
  await editor.waitForTimeout(2000);
  await editor.fill("#email", EMAIL);
  await editor.fill("#password", PASSWORD);
  await editor.getByRole("button", { name: /log in/i }).click();
  await editor.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  await editor.goto(`${BASE}/studio`, { waitUntil: "load" });
  await editor.waitForSelector("[data-studio-builder] header", { timeout: 60000 });
  await editor.waitForTimeout(3000);
  await editor
    .locator("[data-studio-builder] header")
    .getByRole("button", { name: /^layouts$/i })
    .first()
    .click();
  await editor
    .getByRole("dialog", { name: "Choose a layout" })
    .getByRole("button", { name: /^Collage\b/ })
    .first()
    .click();
  await editor.waitForTimeout(1500);
  const badges = await editor.getByText("Overlaps above", { exact: true }).count();
  log("the editor marks layered blocks instead of drawing them", badges > 0, `${badges} marked`);
  await editor.keyboard.press("Control+s");
  await editor.waitForTimeout(3000);
  if (!sections) throw new Error("the editor never tried to save the composition");

  // 2. A signed-out visitor sees those sections as the published page.
  const serve = async (context) => {
    await context.route(/\/rest\/v1\/(page_versions|layouts)\?/, async (route) => {
      const response = await route.fetch();
      const rows = await response.json();
      // Every version, whichever one the page treats as live.
      for (const row of Array.isArray(rows) ? rows : []) {
        if ("layout" in row) row.layout = sections;
        if ("sections" in row) row.sections = sections;
      }
      await route.fulfill({ response, json: rows });
    });
  };
  const visit = async (options) => {
    const context = await browser.newContext({ bypassCSP: true, ...options });
    await serve(context);
    const page = await context.newPage();
    await page.goto(`${BASE}/u/${HANDLE}`, { waitUntil: "load" });
    await page.waitForSelector(".studio-canvas", { timeout: 30000 });
    await page.waitForTimeout(2500);
    return page;
  };

  for (const scheme of ["light", "dark"]) {
    const desk = await visit({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const cells = await measure(desk);
    await desk.screenshot({ path: `${OUT}/desktop-${scheme}.png`, fullPage: true });
    if (scheme === "light") {
      log(
        "pieces layer over the edge of the piece above",
        cells.length > 0 && cells.every((c) => c.layered > 0 && c.layeredBy >= 24),
        JSON.stringify(cells),
      );
      log(
        "…without covering any of its content",
        cells.every((c) => c.covered === 0),
      );
    }
    const violations = await axe(desk);
    log(`the layered page passes axe (${scheme})`, violations.length === 0, violations.join(" "));
    await desk.context().close();
  }

  const phone = await visit({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const stacked = await measure(phone);
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  await phone.screenshot({ path: `${OUT}/phone.png`, fullPage: true });
  log(
    "phones stack without overlap or sideways scroll",
    stacked.every((c) => c.margin >= 0 && c.layered === 0) && overflow <= 0,
    JSON.stringify({ margins: stacked.map((c) => c.margin), overflow }),
  );
  log("nothing was saved", leaked.length === 0, leaked.join(" "));
} catch (error) {
  console.log(`✗ stopped: ${String(error).split("\n")[0]}`);
  results.push({ name: "run", ok: false });
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
