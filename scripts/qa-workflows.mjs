// Workflow click-through: edit details save, customize panel, site-wide theme, snapping.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.fill("#email", "maya@tethyr.dev");
  await page.fill("#password", "password123");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(1000);
}

// ── 1. Edit details: open, edit, save, verify persistence ────────────────────
await login();
await page.goto(`${BASE}/profile`, { waitUntil: "load" });
await page.waitForTimeout(2000);
const btnCount = await page.getByRole("button", { name: /edit details/i }).count();
log("edit details: exactly one button", btnCount === 1, `count=${btnCount}`);
await page
  .getByRole("button", { name: /edit details/i })
  .first()
  .click();
await page.waitForTimeout(800);
const dialogVisible = await page
  .getByRole("dialog")
  .first()
  .isVisible()
  .catch(() => false);
log("edit details: dialog opens", dialogVisible);

const bioBox = page.locator("textarea").first();
if (await bioBox.isVisible().catch(() => false)) {
  await bioBox.fill(`QA bio edit ${Date.now()}`);
}
const saveBtn = page.getByRole("button", { name: /^save/i }).first();
const saveVisible = await saveBtn.isVisible().catch(() => false);
log("edit details: save button visible", saveVisible);
if (saveVisible) {
  await saveBtn.click();
  await page.waitForTimeout(2500);
  const toastErr = await page
    .locator("[data-sonner-toast][data-type=error]")
    .count()
    .catch(() => 0);
  log("edit details: no error toast on save", toastErr === 0, `errors=${toastErr}`);
  const dialogGone = !(await page
    .getByRole("dialog")
    .first()
    .isVisible()
    .catch(() => false));
  log("edit details: dialog closes after save", dialogGone);
}
const token = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("sb-") && k.includes("auth-token")) {
      try {
        return JSON.parse(localStorage.getItem(k))?.access_token;
      } catch {}
    }
  }
  return null;
});
const KEY = process.env.SB_KEY;
if (token && KEY) {
  const res = await page.evaluate(
    async ({ token, KEY }) => {
      const r = await fetch("http://127.0.0.1:54321/rest/v1/profiles?select=bio&handle=eq.maya", {
        headers: { apikey: KEY, Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    { token, KEY },
  );
  const bio = res?.[0]?.bio ?? "";
  log("edit details: bio persisted", bio.startsWith("QA bio edit"), bio.slice(0, 40));
}

// ── 2–3. Studio edit mode: customize panel, background entry, site-wide theme ─
await page.goto(`${BASE}/studio`, { waitUntil: "load" });
await page.waitForTimeout(2500);
// enter Editing mode (radiogroup)
const editingRadio = page.getByRole("radio", { name: /editing/i }).first();
if (await editingRadio.isVisible().catch(() => false)) {
  await editingRadio.click();
  await page.waitForTimeout(1000);
}
const panel = page.locator("aside").filter({ hasText: "Customize" }).first();
const panelVisible = await panel.isVisible().catch(() => false);
log("customize: panel opens in edit mode", panelVisible);
if (panelVisible) {
  // expand "More options" so advanced entries (incl. Edit background) render
  const moreBtn = panel.getByRole("button", { name: /more options/i }).first();
  if (await moreBtn.isVisible().catch(() => false)) {
    if ((await moreBtn.getAttribute("aria-expanded")) !== "true") {
      await moreBtn.click();
      await page.waitForTimeout(400);
    }
  }
  const bgEntry = await panel
    .getByRole("button", { name: /edit background/i })
    .first()
    .isVisible()
    .catch(() => false);
  log("customize: background entry present", bgEntry);
  const themeEntry = await panel
    .getByRole("button", { name: /apply site-wide|applied site-wide/i })
    .first()
    .isVisible()
    .catch(() => false);
  log("customize: site-wide theme option present", themeEntry);

  // independent scroll: shrink viewport, then the advanced area scrolls,
  // the page itself never does
  await page.setViewportSize({ width: 1440, height: 620 });
  await page.waitForTimeout(400);
  const scrollState = await page.evaluate(() => {
    const aside = [...document.querySelectorAll("aside")].find((el) =>
      el.textContent.includes("Customize"),
    );
    if (!aside) return null;
    const scroller = aside.querySelector(".overflow-y-auto");
    const el = scroller ?? aside;
    return {
      panelScrollable: el.scrollHeight > el.clientHeight + 10,
      overflowY: getComputedStyle(el).overflowY,
      pageNotScrolled: document.scrollingElement.scrollTop <= 1,
    };
  });
  log(
    "customize: panel scrolls independently",
    !!scrollState &&
      (scrollState.panelScrollable || scrollState.overflowY === "auto") &&
      scrollState.pageNotScrolled,
    JSON.stringify(scrollState),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);

  // site-wide theme flow: pick a non-default preset, apply, verify vars+storage
  const primaryBefore = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
  );
  const presetPicks = panel.locator("button[aria-pressed]");
  const pickCount = await presetPicks.count();
  let picked = false;
  // find a ThemePick whose title isn't Default and click it
  for (let i = 0; i < pickCount; i++) {
    const pick = presetPicks.nth(i);
    const title = (await pick.getAttribute("title")) ?? "";
    if (title && title !== "Default") {
      await pick.click();
      picked = true;
      break;
    }
  }
  if (picked) {
    await page.waitForTimeout(600);
    const applyBtn = panel.getByRole("button", { name: /apply site-wide/i }).first();
    if (await applyBtn.isVisible().catch(() => false)) {
      await applyBtn.click();
      await page.waitForTimeout(1200);
      const primaryAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
      );
      log(
        "site-wide theme: --primary changes on <html>",
        primaryBefore !== primaryAfter,
        `${primaryBefore || "(empty)"} -> ${primaryAfter || "(empty)"}`,
      );
      const stored = await page.evaluate(() => localStorage.getItem("tethyr-theme-preset"));
      log("site-wide theme: persisted in localStorage", !!stored, stored ?? "none");
      // restore: pick Default, then Apply site-wide clears the preset
      const defaultPick = panel.locator('button[title="Default"]');
      if (await defaultPick.isVisible().catch(() => false)) {
        await defaultPick.click();
        await page.waitForTimeout(400);
      }
      const resetBtn = panel
        .getByRole("button", { name: /applied site-wide|apply site-wide/i })
        .first();
      if (await resetBtn.isVisible().catch(() => false)) {
        await resetBtn.click();
        await page.waitForTimeout(600);
      }
    } else {
      log("site-wide theme: apply button visible", false, "not found after picking");
    }
  } else {
    log("site-wide theme: non-default preset available", false, "no ThemePick found");
  }
}

// ── 4. Snapping: settle logic reachable + grid mounted in edit mode ──────────
const snapState = await page.evaluate(() => {
  const grid = document.querySelector("[data-studio-grid]");
  return { gridPresent: !!grid };
});
log("snapping: editor grid mounted", snapState.gridPresent);
const snapUnit = await page.evaluate(async () => {
  try {
    const mod = await import("/src/components/tethyr/studio/g-studio-surface.tsx");
    return {
      hasFn: typeof mod.snapGridPlacement === "function",
      kind: typeof mod.snapGridPlacement,
    };
  } catch (e) {
    return { hasFn: false, err: String(e).slice(0, 80) };
  }
});
log(
  "snapping: settle logic reachable in running app",
  snapUnit.hasFn,
  snapUnit.err ?? snapUnit.kind,
);

console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} workflow checks passed. ` +
    `${errors.length} page errors.`,
);
await browser.close();
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
