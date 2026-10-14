// Ship log click-through: post this week's ship, see it, edit it, the feed,
// the dashboard prompt, phone layout, then clean up.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = "qa-artifacts/ship-log";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

async function login(email) {
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
    ) {
      await page.waitForTimeout(1000);
      return;
    }
  }
  throw new Error(`login failed; still on ${page.url()}`);
}

await login("maya@tethyr.dev");

// Dashboard prompt
await page.waitForTimeout(1500);
const prompt = page.getByRole("link", { name: /post your ship|see this week's ships/i });
log("dashboard: ship prompt shows", (await prompt.count()) > 0);
await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: false });

// Nav
log("sidebar: Ship log link", (await page.getByRole("link", { name: "Ship log" }).count()) > 0);
log(
  "sidebar: no Library link",
  (await page.getByRole("link", { name: "Library", exact: true }).count()) === 0,
);

await page.goto(`${BASE}/ships`, { waitUntil: "load" });
await page.waitForTimeout(2000);
log("ships: heading", (await page.getByRole("heading", { name: "Ship log" }).count()) === 1);
await page.screenshot({ path: `${OUT}/ships-empty.png`, fullPage: true });

// If an earlier run left a ship, delete it first.
page.on("dialog", (d) => d.accept());
const del = page.getByRole("button", { name: "Delete this week's ship" });
if (await del.count()) {
  await del.click();
  await page.waitForTimeout(1500);
}

const body = page.getByLabel("What you shipped");
await body.fill("This week I:\n- shipped the Ship log\n- fixed card borders across every theme");
await page.getByLabel("Next up").fill("Weekly reminder emails");
await page.getByRole("button", { name: "Post ship" }).click();
await page.waitForTimeout(2000);
const posted = await page.getByText("shipped the Ship log").count();
log("ships: posted ship shows in Your week", posted > 0);
log("ships: next up shows", (await page.getByText("Weekly reminder emails").count()) > 0);
await page.screenshot({ path: `${OUT}/ships-posted.png`, fullPage: true });

// Edit
await page.getByRole("button", { name: "Edit this week's ship" }).click();
await page.getByLabel("What you shipped").fill("This week I shipped the Ship log (edited).");
await page.getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(1500);
log("ships: edit saves", (await page.getByText("(edited)").count()) > 0);

// Previous week
await page.getByRole("button", { name: "Previous week" }).click();
await page.waitForTimeout(1200);
log(
  "ships: previous week has no composer",
  (await page.getByLabel("What you shipped").count()) === 0,
);
await page.getByRole("button", { name: "Next week" }).click();
await page.waitForTimeout(800);

// Phone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
log("phone: no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
log(
  "phone: Ship log in tab bar",
  (await page.locator("nav").getByRole("link", { name: "Ship log" }).count()) > 0,
);
await page.screenshot({ path: `${OUT}/ships-phone.png`, fullPage: true });

// Clean up
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByRole("button", { name: "Delete this week's ship" }).click();
await page.waitForTimeout(1500);
log("ships: delete removes it", (await page.getByText("(edited)").count()) === 0);

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
