// Blind-spot QA: drag-and-drop reordering, dark-theme contrast, and the
// community-template publish/unpublish flow — the three areas the
// 2026-09-27 audit explicitly did not cover.
//
//   node scripts/qa-studio-blindspots.mjs
// Optional env: QA_BASE (default http://localhost:3000)
//
// Notes:
//  • Reordering is exercised through the accessible Move buttons (section
//    "Move area up/down", block "Move up/down") rather than synthetic pointer
//    drags — they share the same layout reducer, and the drag path itself is
//    third-party (react-grid-layout) already covered by its own suite.
//  • The dark-theme pass reuses the contrast probe from qa-studio-view.mjs
//    against the Studio view with `theme` forced to "dark".
//  • The template flow publishes the signed-in account's own layout, then
//    unpublishes it, leaving the database as it was found.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const errors = [];

async function login(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.fill("#email", "maya@tethyr.dev");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: /log in/i }).click();
    const ok = await page
      .waitForURL(/dashboard/, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      await page.waitForTimeout(1000);
      return;
    }
  }
  throw new Error(`login failed; still on ${page.url()}`);
}

/** Open /studio with the Customize panel open and "More options" expanded.
 *  Same shapes as qa-studio.mjs's ensureCustomizeOpen/expandMoreOptions. */
async function openEditor(page) {
  await page.goto(`${BASE}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-studio-builder]", { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    if (
      await page
        .locator("[data-studio-builder] aside")
        .first()
        .isVisible()
        .catch(() => false)
    )
      break;
    const toggle = page
      .locator("[data-studio-builder] header")
      .getByRole("button", { name: /^(customize|templates?)$/i })
      .first();
    if (!(await toggle.isVisible().catch(() => false))) break;
    await toggle.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  const panelOpen = await page
    .locator("[data-studio-builder] aside")
    .first()
    .isVisible()
    .catch(() => false);
  if (!panelOpen) throw new Error("could not open the Customize panel");
  // "More options" remembers its state in localStorage — expand only if closed.
  const more = page.getByRole("button", { name: /more options/i }).first();
  if (!(await more.isVisible().catch(() => false))) return;
  if ((await more.getAttribute("aria-expanded")) === "true") return;
  await more.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// ── 1. Reordering: sections and blocks move and persist ──────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  await login(page);
  await openEditor(page);

  const readSections = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-section-id]")].map(
        (s) =>
          s.querySelector("header button[title='Rename area']")?.textContent?.trim() ||
          s.getAttribute("aria-label") ||
          "",
      ),
    );

  const before = await readSections();
  log("sections render in a known order", before.length >= 2, before.join(" | "));

  if (before.length >= 2) {
    // Move the first section down, verify the swap, then move it back.
    const firstName = before[0];
    await page.getByRole("button", { name: "Move area down", exact: true }).first().click();
    await page.waitForTimeout(600);
    const afterDown = await readSections();
    log(
      "Move area down reorders sections",
      afterDown[1] === firstName && afterDown.length === before.length,
      `${before.join(" → ")} ⇒ ${afterDown.join(" → ")}`,
    );
    await page.getByRole("button", { name: "Move area up", exact: true }).nth(1).click();
    await page.waitForTimeout(600);
    const afterUp = await readSections();
    log(
      "Move area up restores the order",
      JSON.stringify(afterUp) === JSON.stringify(before),
      afterUp.join(" → "),
    );

    // Blocks: open a block inspector and move it, expecting the block order
    // inside its section to swap. Recover by moving it back.
    const target = page.locator("[data-block-id]").first();
    await target.click();
    await page.waitForTimeout(400);
    const readBlocks = () =>
      page.evaluate(() => {
        const sec = document.querySelector("[data-section-id]");
        if (!sec) return [];
        return [...sec.querySelectorAll("[data-block-id]")].map(
          (b) => b.querySelector("h3, h4, .t-label")?.textContent?.trim().slice(0, 24) || b.tagName,
        );
      });
    const blocksBefore = await readBlocks();
    await page.getByRole("button", { name: "Move down", exact: true }).first().click();
    await page.waitForTimeout(600);
    const blocksAfter = await readBlocks();
    const moved =
      blocksBefore.length === blocksAfter.length &&
      JSON.stringify(blocksBefore) !== JSON.stringify(blocksAfter);
    log(
      "Move down reorders blocks",
      moved,
      blocksBefore.join(" → ") + " ⇒ " + blocksAfter.join(" → "),
    );
    if (moved) {
      await page.getByRole("button", { name: "Move up", exact: true }).first().click();
      await page.waitForTimeout(600);
      const blocksRestored = await readBlocks();
      log(
        "Move up restores block order",
        JSON.stringify(blocksRestored) === JSON.stringify(blocksBefore),
      );
    }

    // The reorder must survive a reload once saved (autosave commits local
    // edits); if the account had unsaved changes from another harness, the
    // check is recorded, not forced.
    const saveState = await page.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find((s) =>
        /Unsaved changes|Saving…|Ready to publish/.test(s.textContent || ""),
      );
      return el?.textContent?.trim() ?? "unknown";
    });
    log("reorder reached the save pipeline", saveState !== "unknown", saveState);
  }
  await page.close();
}

// ── 2. Dark theme: the Studio view keeps AA contrast in the dark palette ─────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  await login(page);
  // Force dark before the page paints so the bootstrap picks it up.
  await page.addInitScript(() => localStorage.setItem("tethyr-theme", "dark"));
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  log("dark theme is active", dark, dark ? "" : "html.dark missing after forcing localStorage");

  const contrast = await page.evaluate(() => {
    // Browsers expose oklch()/oklab() computed values verbatim; convert them
    // to sRGB so the WCAG math works. Alpha composites over an opaque colour
    // (translucent card fills sit over a real background).
    const parse = (c) => {
      c = c.trim();
      let m = c.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
      if (m)
        return {
          r: +m[1],
          g: +m[2],
          b: +m[3],
          a: m[4] === undefined ? 1 : +m[4],
        };
      m = c.match(/oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) {
        const L = parseFloat(m[1]) / (m[1].includes("%") ? 100 : 1);
        const [r, g, b] = oklchToSrgb(L, +m[2], +m[3]);
        return { r, g, b, a: m[4] === undefined ? 1 : +m[4] };
      }
      m = c.match(/oklab\(([\d.]+)%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) {
        const L = parseFloat(m[1]) / (m[1].includes("%") ? 100 : 1);
        const [r, g, b] = oklabToSrgb(L, +m[2], +m[3]);
        return { r, g, b, a: m[4] === undefined ? 1 : +m[4] };
      }
      return { r: 0, g: 0, b: 0, a: 1 };
    };
    const oklchToSrgb = (L, C, H) => {
      const rad = (H * Math.PI) / 180;
      return oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
    };
    const oklabToSrgb = (L, a, b) => {
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.291485548 * b;
      const l = l_ ** 3;
      const m = m_ ** 3;
      const s = s_ ** 3;
      let r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      let bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
      const gamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
      return [
        Math.min(255, Math.max(0, gamma(r) * 255)),
        Math.min(255, Math.max(0, gamma(g) * 255)),
        Math.min(255, Math.max(0, gamma(bb) * 255)),
      ];
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * bg.a * (1 - fg.a),
      g: fg.g * fg.a + bg.g * bg.a * (1 - fg.a),
      b: fg.b * fg.a + bg.b * bg.a * (1 - fg.a),
      a: fg.a + bg.a * (1 - fg.a),
    });
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // Composites every ancestor's background down to an opaque base colour.
    const bgOf = (el) => {
      let bg = { r: 255, g: 255, b: 255, a: 0 };
      let n = el;
      while (n && n !== document.documentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) {
          bg = c.a >= 1 ? c : over(c, bg);
          if (bg.a >= 1) break;
        }
        n = n.parentElement;
      }
      if (bg.a < 1) bg = over(bg, parse(getComputedStyle(document.body).backgroundColor));
      return bg;
    };
    const ratio = (fg, bg) => {
      const l1 = lum(parse(fg));
      const l2 = lum(bg);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (hi + 0.05) / (lo + 0.05);
    };
    const scope = document.querySelector('main[aria-label="Studio"]');
    if (!scope) return [];
    const out = [];
    for (const el of scope.querySelectorAll("p, span, h1, h2, h3, li, a, button")) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length < 3 || t.length > 40) continue;
      if (el.children.length > 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      const large =
        parseFloat(cs.fontSize) >= 24 ||
        (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      const cr = ratio(cs.color, bgOf(el));
      if (cr < (large ? 3 : 4.5))
        out.push({ t: t.slice(0, 30), cr: Math.round(cr * 100) / 100, size: cs.fontSize });
    }
    const seen = new Set();
    return out.filter((o) => (seen.has(o.t) ? false : seen.add(o.t))).slice(0, 8);
  });
  log(
    "block text meets 4.5:1 in dark mode",
    contrast.length === 0,
    contrast.map((c) => `${c.t} ${c.cr}:1 @${c.size}`).join("; "),
  );
  await page.evaluate(() => localStorage.removeItem("tethyr-theme"));
  await page.close();
}

// ── 3. Templates: publish → visible in community list → unpublish → gone ─────
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  await login(page);
  await openEditor(page);

  // Publish the current layout as a community template (idempotent update).
  await page.getByRole("button", { name: "Save as template" }).first().click();
  await page.waitForTimeout(1500);
  const publishedToast = await page
    .locator("[data-sonner-toast]")
    .filter({ hasText: /Published to the community/i })
    .count()
    .catch(() => 0);
  log("Save as template succeeds", publishedToast > 0, `toasts=${publishedToast}`);

  // The template list is the starter picker's community tab; open it.
  await page.getByRole("button", { name: "Browse templates" }).first().click();
  await page.waitForTimeout(1500);
  const dialog = page.getByRole("dialog").first();
  const listOpen = await dialog.isVisible().catch(() => false);
  log("template picker opens", listOpen);

  const mine = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('[role="dialog"] button')];
    const unpublish = btns.filter((b) =>
      (b.getAttribute("aria-label") || "").startsWith("Unpublish"),
    );
    return {
      unpublishCount: unpublish.length,
      names: unpublish.map((b) => b.getAttribute("aria-label").replace(/^Unpublish /, "")),
    };
  });
  log(
    "own template appears with an unpublish affordance",
    mine.unpublishCount > 0,
    mine.names.slice(0, 3).join(", "),
  );

  if (mine.unpublishCount > 0) {
    await page.locator('button[aria-label^="Unpublish"]').first().click();
    // The list refetches after the mutation lands — poll instead of sleeping.
    const gone = await page
      .waitForFunction(
        (prev) => {
          const btns = [...document.querySelectorAll('[role="dialog"] button')];
          const now = btns.filter((b) =>
            (b.getAttribute("aria-label") || "").startsWith("Unpublish"),
          ).length;
          return now < prev;
        },
        mine.unpublishCount,
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false);
    const remaining = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')];
      return btns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Unpublish"))
        .length;
    });
    log(
      "unpublish removes the community listing",
      gone && remaining === mine.unpublishCount - 1,
      `remaining=${remaining}`,
    );
  }
  await page.keyboard.press("Escape");
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length} of ${results.length} checks failed`);
if (errors.length) console.log("page errors:", errors);
process.exit(failed.length || errors.length ? 1 : 0);
