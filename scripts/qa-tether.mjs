// The Tether: animation, hover/click details, legend filter, list view,
// "Watch it grow", names, reduced motion, project page section → full view,
// Studio block in the palette, phone layout, dark mode.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = "qa-artifacts/tether";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
const errors = [];
async function session(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  for (let i = 0; i < 3; i++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1500);
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
  await page.waitForTimeout(1000);
  return page;
}
const transformOf = (page) =>
  page.evaluate(
    () => document.querySelector("svg[role=img] g[role=button]")?.getAttribute("transform") ?? "",
  );
const countOf = async (page) =>
  Number(
    ((await page.locator("svg[role=img]").getAttribute("aria-label")) ?? "").match(
      /(\d+) connections/,
    )?.[1] ?? -1,
  );

const page = await session();
await page.goto(`${BASE}/tether`, { waitUntil: "load" });
await page.waitForTimeout(3000);
const total = await countOf(page);
log("tether: renders your connections", total > 0, `${total} connections`);
const a = await transformOf(page);
await page.waitForTimeout(1200);
const b = await transformOf(page);
log("tether: balls orbit (animated)", a && b && a !== b);

const firstBall = page.locator("svg[role=img] g[role=button]").first();
const ballName = await firstBall.getAttribute("aria-label");
await firstBall.hover({ force: true });
await page.waitForTimeout(300);
log(
  "tether: hover shows the name",
  (await page
    .locator("svg[role=img] text")
    .filter({ hasText: (ballName ?? "").split(": ")[1]?.slice(0, 20) ?? "" })
    .count()) > 0,
  ballName,
);
await firstBall.click({ force: true });
await page.waitForTimeout(300);
log(
  "tether: click opens details",
  (await page.getByRole("button", { name: "Close" }).count()) === 1,
);
await page.screenshot({ path: `${OUT}/details.png` });
await page.getByRole("button", { name: "Close" }).click();

// Legend filter
const chip = page.getByRole("group", { name: "Rings" }).getByRole("button").first();
await chip.click();
await page.waitForTimeout(300);
log(
  "legend: filters a kind out",
  (await countOf(page)) < total,
  `${await countOf(page)} of ${total}`,
);
await chip.click();

// Names + list view
await page.getByRole("button", { name: "Show names" }).click();
await page.waitForTimeout(400);
log("names: balls labelled", (await page.locator("svg[role=img] text").count()) >= total);
await page.screenshot({ path: `${OUT}/names.png` });
await page.getByRole("button", { name: "Hide names" }).click();
await page.getByRole("button", { name: "List view" }).click();
log(
  "list view: grouped by kind",
  (await page.getByRole("region", { name: "Projects" }).count()) === 1,
);
await page.getByRole("button", { name: "Tether view" }).click();

// Watch it grow
await page.getByRole("button", { name: "Watch it grow" }).click();
await page.waitForTimeout(1500);
const early = await countOf(page);
log("grow: replay starts small", early < total, `${early} of ${total}`);
await page.screenshot({ path: `${OUT}/growing.png` });
await page.getByRole("button", { name: "Pause" }).click();
await page.getByLabel("Point in time").fill("1000");
await page.waitForTimeout(800);
log("grow: scrubbing to now shows everything", (await countOf(page)) === total);
log("owner: Sync button", (await page.getByRole("button", { name: "Sync" }).count()) === 1);

// Project page → full view
const projectLink = await page.evaluate(() => {
  const a = [...document.querySelectorAll("a[href^='/projects/']")][0];
  return a?.getAttribute("href") ?? null;
});
await page.getByRole("button", { name: "List view" }).click();
const href = await page.locator("a[href^='/projects/']").first().getAttribute("href");
await page.goto(`${BASE}${href ?? projectLink}`, { waitUntil: "load" });
await page.waitForTimeout(3000);
const section = page.getByRole("region", { name: "How it connects" });
if (await section.count()) {
  log(
    "project: How it connects is the Tether",
    (await section.locator("svg[role=img]").count()) === 1,
  );
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/project.png` });
  await section.getByRole("link", { name: "Open the full Tether" }).click();
  await page.waitForURL(/\/tether\?project=/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  log(
    "project: opens the full Tether for the project",
    /\/tether\?project=/.test(page.url()) && (await countOf(page)) > 0,
  );
} else {
  log("project: How it connects is the Tether", false, `no section on ${href}`);
}

// Studio palette has the block
await page.goto(`${BASE}/studio`, { waitUntil: "load" });
await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Add block" }).first().click();
await page.waitForTimeout(600);
await page
  .getByPlaceholder(/search/i)
  .last()
  .fill("tether");
await page.waitForTimeout(500);
log("studio: The Tether block is in the palette", (await page.getByText("The Tether").count()) > 0);

// Phone
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/tether`, { waitUntil: "load" });
await page.waitForTimeout(2500);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
log("phone: no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
await page.screenshot({ path: `${OUT}/phone.png`, fullPage: true });

// Reduced motion + dark mode
const calm = await session({ reducedMotion: "reduce", colorScheme: "dark" });
await calm.goto(`${BASE}/tether`, { waitUntil: "load" });
await calm.evaluate(() => document.documentElement.classList.add("dark"));
await calm.waitForTimeout(2500);
const c1 = await transformOf(calm);
await calm.waitForTimeout(1200);
const c2 = await transformOf(calm);
log("reduced motion: holds still", c1 === c2 && !!c1);
await calm.screenshot({ path: `${OUT}/dark.png` });

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
