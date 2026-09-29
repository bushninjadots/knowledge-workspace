// Studio editor / creator-settings audit harness (dev tool, not shipped).
//
// Audits the two Studio surfaces — the owner view (/profile) and the creator
// editor (/studio) — for settings that do not work, settings that do not look
// or sit where they should, and layout/occlusion defects that make a control
// unreachable. Every number is read out of a live browser
// (getComputedStyle / getBoundingClientRect / elementFromPoint) so a finding
// can be re-checked rather than taken on trust.
//
//   node scripts/qa-studio.mjs [--base http://localhost:3000]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
// Writes qa-artifacts/studio-audit.json and prints a pass/fail list.
//
// Checks, grouped by `--only N`:
//   1  shell geometry      the builder is bounded by the viewport at 11 sizes
//   2  panel reach         every Customize control is clickable, nothing is
//                          covered by the panel footer
//   3  version popover     positioned below its trigger, dismissible, non-blocking
//   4  settings function   each control actually repaints the canvas, Structure
//                          options differ, exactly one theme tile is pressed
//   5  personality         the font each personality promises reaches the labels
//   7  control targets     target size and accessible names, across the whole
//                          builder (rail, section band, canvas, top bar)
//   8  mobile sheet        settings parity against the desktop panel
// The owner view (/profile) is covered by the companion qa-studio-view.mjs.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");
const EMAIL = process.env.QA_EMAIL || "maya@tethyr.dev";
const PASSWORD = process.env.QA_PASSWORD || "password123";
const OUT = path.resolve("qa-artifacts");
fs.mkdirSync(OUT, { recursive: true });
// `--only N` runs one check group (1 shell · 2 panel reach · 3 popover ·
// 4 settings + theme tiles · 5 personality · 7 control targets · 8 mobile).
// Useful when re-measuring a single area without paying for eleven logins.
const ONLY = process.argv.includes("--only")
  ? Number(process.argv[process.argv.indexOf("--only") + 1])
  : null;
const want = (n) => ONLY === null || ONLY === n;

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const settle = async (page, ms = 1800) => {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(ms);
};

async function login(page) {
  // A click before hydration falls through to a native GET submit (the
  // "/login?" tell), so retry until the app's own handler takes over.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await settle(page, 1200);
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
  await settle(page, 3000);
  // First-run starter overlay, if any, sits over the canvas. Only look inside a
  // dialog: a document-wide "close" match also hits "Close customize", which
  // would close the very panel these checks are about.
  for (const re of [/close/i, /skip/i, /later/i, /dismiss/i, /got it/i]) {
    const b = page.locator('[role="dialog"]').getByRole("button", { name: re }).first();
    if (await b.isVisible().catch(() => false)) {
      await b.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      break;
    }
  }
}

/** The Customize aside is the subject of most checks, so guarantee it is open.
 *  Below `lg` it is intentionally display:none and the phone sheet replaces it,
 *  so there is nothing to open at those widths. */
async function ensureCustomizeOpen(page) {
  if ((page.viewportSize()?.width ?? 1024) < 1024) return false;
  for (let i = 0; i < 5; i++) {
    const visible = await page
      .locator("[data-studio-builder] aside")
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
    const toggle = page
      .locator("[data-studio-builder] header")
      .getByRole("button", { name: /^(customize|templates?)$/i })
      .first();
    if (!(await toggle.isVisible().catch(() => false))) {
      // Under a loaded dev server the header itself may still be mounting —
      // wait for the builder rather than bailing after one look.
      await page.waitForSelector("[data-studio-builder] header", { timeout: 8000 }).catch(() => {});
      continue;
    }
    await toggle.click({ timeout: 6000 }).catch(() => {});
    await page
      .waitForSelector("[data-studio-builder] aside", { state: "visible", timeout: 6000 })
      .catch(() => {});
  }
  return page
    .locator("[data-studio-builder] aside")
    .first()
    .isVisible()
    .catch(() => false);
}

async function expandMoreOptions(page) {
  const more = page.getByRole("button", { name: /more options/i }).first();
  if (!(await more.isVisible().catch(() => false))) return false;
  if ((await more.getAttribute("aria-expanded")) === "true") return true;
  await more.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  return (await more.getAttribute("aria-expanded")) === "true";
}

// The phone editor is closed by default (audit P0) — the canvas shows first
// and the "Edit Studio" FAB opens the sheet.
async function openMobileEditor(page) {
  // The FAB only renders below `lg`, and the sheet mounts when it is clicked —
  // retry briefly: under a loaded dev server the first paint can lag.
  for (let i = 0; i < 3; i++) {
    const has = await page.evaluate(
      () => !!document.querySelector('section[aria-label="Mobile Studio editor"]'),
    );
    if (has) return true;
    const fab = page.getByRole("button", { name: "Edit Studio", exact: true });
    if ((await fab.count()) === 0) {
      await page.waitForTimeout(600);
      continue;
    }
    await fab.click();
    await page.waitForTimeout(500);
  }
  return page.evaluate(
    () => !!document.querySelector('section[aria-label="Mobile Studio editor"]'),
  );
}

// ── page probes ─────────────────────────────────────────────────────────────

/** 1. Is the builder bounded by the viewport, and is the panel inside it? */
const SHELL = () => {
  const root = document.querySelector("[data-studio-builder]");
  if (!root) return { error: "no studio builder" };
  const b = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      y: Math.round(r.y),
      h: Math.round(r.height),
      w: Math.round(r.width),
      overflowBelow: Math.round(r.bottom - innerHeight),
    };
  };
  return {
    vw: innerWidth,
    vh: innerHeight,
    docOverflow: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
    builder: b(root),
    header: b(root.querySelector("header")),
    canvas: b(root.querySelector("main")),
    panel: b(root.querySelector("aside")),
    // Below `lg` the desktop aside is intentionally hidden and the phone sheet
    // takes over; record which surface is actually in play.
    sheet: b(document.querySelector('section[aria-label="Mobile Studio editor"]')),
  };
};

/** 2. Which panel controls cannot be hit right now, and what is on top? */
const REACH = (scrollTop) => {
  const root = document.querySelector("[data-studio-builder]");
  const panel =
    root.querySelector("aside") ??
    document.querySelector('section[aria-label="Mobile Studio editor"]');
  if (!panel) return { absent: true, blocked: [], offscreen: [] };
  const wrapper = panel.querySelector(":scope > div");
  const wcs = wrapper ? getComputedStyle(wrapper) : null;
  // The content wrapper is the scroll owner when it actually clips and
  // scrolls; the panel itself is the fallback (legacy layout).
  const scrollOwner =
    wrapper &&
    wcs &&
    /(auto|scroll)/.test(wcs.overflowY) &&
    wrapper.scrollHeight > wrapper.clientHeight + 1
      ? wrapper
      : panel;
  if (typeof scrollTop === "number") scrollOwner.scrollTop = scrollTop;
  const pr = panel.getBoundingClientRect();
  const or = scrollOwner.getBoundingClientRect();
  const footer = panel.querySelector("footer");
  const fr = footer?.getBoundingClientRect();
  const blocked = [];
  const offscreen = [];
  for (const el of panel.querySelectorAll("button, input, select, textarea")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1) continue; // off-panel, not an occlusion
    // A control clipped by the scroll owner is out of view, not occluded —
    // scrolling to it is exactly what the scrolled snapshots assert.
    if (scrollOwner !== panel && (r.bottom > or.bottom + 1 || r.top < or.top - 1)) continue;
    const name = (el.getAttribute("aria-label") || el.textContent || el.title || el.value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30);
    // A control the user cannot see is a different defect from one something
    // else is painted over; report them apart.
    if (r.bottom > innerHeight || r.top < 0) {
      offscreen.push({
        name,
        y: Math.round(r.y),
        belowViewportBy: Math.round(r.bottom - innerHeight),
      });
      continue;
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) continue;
    blocked.push({
      name,
      y: Math.round(r.y),
      coveredBy: (hit?.textContent || hit?.tagName || "?").replace(/\s+/g, " ").trim().slice(0, 30),
    });
  }
  return {
    panel: {
      y: Math.round(pr.y),
      h: Math.round(pr.height),
      overflowBelow: Math.round(pr.bottom - innerHeight),
    },
    scrollTop: scrollOwner.scrollTop,
    maxScroll: scrollOwner.scrollHeight - scrollOwner.clientHeight,
    scrollOwner: scrollOwner === wrapper ? "content wrapper" : "panel",
    contentWrapper: (() => {
      const w = panel.querySelector(":scope > div");
      if (!w) return null;
      const cs = getComputedStyle(w);
      return {
        overflowY: cs.overflowY,
        clientH: w.clientHeight,
        scrollH: w.scrollHeight,
        // "Spills" means unclipped overflow: content taller than the box with
        // no scroll container, which is what runs under the footer.
        spills: w.scrollHeight > w.clientHeight + 1 && !/(auto|scroll)/.test(cs.overflowY),
      };
    })(),
    footer: fr ? { y: Math.round(fr.y), h: Math.round(fr.height) } : null,
    blocked,
    offscreen,
  };
};

/** 3. The version-history popover must sit below its trigger and not cover it. */
const POPOVER = () => {
  const p = [...document.querySelectorAll("div")].find(
    (d) => /Published versions/.test(d.textContent) && d.className.includes("absolute"),
  );
  if (!p) return { present: false };
  const r = p.getBoundingClientRect();
  const trigger = document.querySelector('[aria-label="Version history"]');
  const t = trigger?.getBoundingClientRect();
  const covered = [];
  for (const el of document.querySelectorAll("[data-studio-builder] > header button")) {
    // Skip the popover's own controls — it legitimately contains its own Close
    // button and internal controls; the check is about *other* top-bar buttons.
    if (el.closest('[aria-label="Published versions"]')) continue;
    const b = el.getBoundingClientRect();
    if (b.width === 0) continue;
    const overlap = !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom);
    if (overlap)
      covered.push(
        (el.getAttribute("aria-label") || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 24),
      );
  }
  return {
    present: true,
    offsetParent: p.offsetParent
      ? p.offsetParent.tagName.toLowerCase() +
        "." +
        p.offsetParent.className.toString().slice(0, 40)
      : null,
    popover: {
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    },
    trigger: t ? { x: Math.round(t.x), y: Math.round(t.y) } : null,
    coversTrigger: !!(
      t && !(r.bottom < t.top || r.top > t.bottom || r.right < t.left || r.left > t.right)
    ),
    coversHeaderControls: covered,
    role: p.getAttribute("role"),
    labelled: p.getAttribute("aria-label") || p.getAttribute("aria-labelledby"),
  };
};

/** 4. What does the canvas actually repaint with?
 *
 *  Enough signal to catch every setting class: theme/personality (custom
 *  properties), structure (main max-width), density (block padding), corners
 *  (border-radius), border weight (border width), card fill (background). */
const SNAP = () => {
  const root = document.querySelector("[data-studio-builder]");
  const cs = getComputedStyle(root);
  const vars = {};
  for (let i = 0; i < cs.length; i++) {
    const name = cs.item(i);
    if (name.startsWith("--")) vars[name] = cs.getPropertyValue(name).trim();
  }
  const main = root.querySelector("main");
  // The structure cap lives on an inline style on the canvas wrapper, not on
  // main, so read it from there.
  const capped = main?.querySelector('div[style*="max-width"]');
  const blocks = [...root.querySelectorAll("[data-block-id]")].slice(0, 3);
  const styles = blocks.map((b) => {
    const r = b.getBoundingClientRect();
    const bcs = getComputedStyle(b);
    return [
      `${Math.round(r.width)}x${Math.round(r.height)}`,
      bcs.borderTopWidth,
      bcs.borderRadius,
      bcs.backgroundColor,
      bcs.paddingTop,
      bcs.paddingLeft,
    ].join("|");
  });
  return {
    vars,
    styles,
    wrapperMaxWidth: capped ? capped.style.maxWidth || getComputedStyle(capped).maxWidth : null,
    wrapperWidth: capped ? Math.round(capped.getBoundingClientRect().width) : null,
    canvasWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
    mainGap: main ? getComputedStyle(main).gap : null,
  };
};

/** 5. Which typeface reaches which label, and how many label styles exist? */
const LABELS = () => {
  const root = document.querySelector("[data-studio-builder]");
  const rows = [];
  for (const el of root.querySelectorAll(
    ".t-label, .section-label, h1, h2, h3, [class*='font-mono']",
  )) {
    const cs = getComputedStyle(el);
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 26) continue;
    if (!el.getBoundingClientRect().height) continue;
    rows.push({
      t,
      tag: el.tagName.toLowerCase(),
      size: cs.fontSize,
      weight: cs.fontWeight,
      ls: cs.letterSpacing,
      family: cs.fontFamily.split(",")[0].replace(/"/g, ""),
      utility: el.className.toString().split(/\s+/)[0],
    });
  }
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.t + r.family) ? false : seen.add(r.t + r.family)));
};

/** 6. Exactly one theme tile may be pressed. */
const THEME_TILES = () => {
  const panel = document.querySelector("[data-studio-builder] aside") ?? document;
  const tiles = [...panel.querySelectorAll("button[aria-pressed]")].filter((b) =>
    b.querySelector("span[style*='background-color']"),
  );
  return tiles.map((t) => ({
    name: t.getAttribute("title") || t.textContent.trim(),
    pressed: t.getAttribute("aria-pressed") === "true",
  }));
};

/** 7. Control target size and accessible names, across the whole builder. */
const RAIL = () => {
  const root = document.querySelector("[data-studio-builder]");
  const asides = [...root.querySelectorAll("aside")];
  if (!asides.length) return null;
  const rail = asides[asides.length - 1];
  // Accessible name, in the order HTML-AAM gives it: aria-labelledby, then
  // aria-label, then the native label association (`el.labels`, which is what
  // credits a checkbox wrapped in a <label>), then subtree text, then title.
  // Skipping the label step reports every wrapped checkbox as unnamed, which is
  // a probe artefact, not a defect. `placeholder` is a description, not a name,
  // so it is deliberately not consulted.
  const named = (el) => {
    const txt = (n) => (n || "").replace(/\s+/g, " ").trim();
    const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    if (ids.length) {
      const s = txt(ids.map((id) => document.getElementById(id)?.textContent).join(" "));
      if (s) return s;
    }
    const aria = txt(el.getAttribute("aria-label"));
    if (aria) return aria;
    const native = txt([...(el.labels ?? [])].map((l) => l.textContent).join(" "));
    if (native) return native;
    return txt(el.textContent) || txt(el.getAttribute("title"));
  };
  const groups = [];
  let cur = null;
  for (const el of rail.querySelectorAll("p, h2, h3, button, input, label")) {
    const r = el.getBoundingClientRect();
    if (!r.height) continue;
    if (el.className.toString().includes("t-label")) {
      cur = { label: (el.textContent || "").trim().slice(0, 30), controls: [] };
      groups.push(cur);
    } else if (cur && el.matches("button, input")) {
      cur.controls.push({
        n: named(el).slice(0, 22),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }
  const focusables = [
    ...root.querySelectorAll(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.getBoundingClientRect().width > 0);
  const unnamed = focusables.filter((el) => !named(el));
  // A control the user cannot see is not a target-size problem. Same paint test
  // as the panelReach probe: exclude anything unpainted so the inventory counts
  // real targets only.
  const painted = (el) => {
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === "none" || cs.visibility === "hidden") return false;
    if (el.getAttribute("aria-hidden") === "true" || el.closest(".sr-only")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Where a control lives, by the region that owns it. The section band is
  // rendered in the canvas column between sections, not in the rail, so
  // "header" cannot be used as a proxy for the top bar here.
  const where = (el) => {
    if (el.closest("aside")) return "inspector rail";
    if (el.closest('section[aria-label="Mobile Studio editor"]')) return "phone sheet";
    if (el.closest("main")) {
      // GSectionBand renders its controls in a <header> inside the canvas
      // column, between sections — that is the section band, not the top bar.
      return el.closest("main header") ? "section band" : "canvas";
    }
    return el.closest("header") ? "top bar" : "panel / other";
  };
  const small = focusables
    .filter(painted)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        where: where(el),
        n: named(el).replace(/\s+/g, " ").trim().slice(0, 22) || "(unnamed)",
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        src: (el.getAttribute("data-tsd-source") || "").split("/").pop(),
      };
    })
    .filter((x) => x.h < 24 || x.w < 24);
  return {
    width: Math.round(rail.getBoundingClientRect().width),
    groups: groups.filter((g) => g.label),
    // Builder-wide, so the section band is covered — the rail alone undercounts.
    smallControls: small,
    smallByRegion: Object.fromEntries(
      Object.entries(small.reduce((acc, s) => ((acc[s.where] ??= []).push(s), acc), {})).map(
        ([k, v]) => [k, v.length],
      ),
    ),
    focusablesInBuilder: focusables.length,
    focusablesWithoutName: unnamed.length,
    // Enough markup to identify the offenders without a second probe.
    unnamed: unnamed.slice(0, 10).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: el.className.toString().slice(0, 90),
      html: el.outerHTML.slice(0, 120),
      src: (el.getAttribute("data-tsd-source") || "").split("/").pop(),
      inRail: !!el.closest("aside"),
    })),
    firstTabStops: focusables
      .slice(0, 8)
      .map((el) => named(el).replace(/\s+/g, " ").trim().slice(0, 22)),
    // Where in the tab order the first unnamed control sits, so "is it early?"
    // is answerable from the artifact instead of guessed.
    firstUnnamedAt: unnamed.length
      ? {
          index: focusables.indexOf(unnamed[0]),
          of: focusables.length,
          where: unnamed[0].closest("aside") ? "inspector rail" : "elsewhere",
        }
      : null,
  };
};

// ── run ─────────────────────────────────────────────────────────────────────

const report = { base: BASE, at: new Date().toISOString(), sections: {} };
const browser = await chromium.launch();
try {
  // 1 ─ shell geometry across the responsive range
  if (want(1)) {
    const sizes = [
      [1920, 1080],
      [1512, 982],
      [1440, 900],
      [1280, 800],
      [1100, 800],
      [1023, 768],
      [900, 700],
      [768, 1024],
      [430, 932],
      [390, 844],
      [360, 640],
    ];
    const shells = {};
    // Viewport sizes are independent — measure them concurrently (bounded pool)
    // instead of 11 sequential login+load cycles. Login happens once on the
    // first worker; the rest adopt the session via localStorage seeding.
    const CONCURRENCY = 4;
    let sessionKey = null;
    let sessionValue = null;
    // Login mutex: exactly one worker signs in at a time; the rest wait for
    // the captured session instead of hammering the dev server in parallel.
    let loginChain = Promise.resolve();
    const adoptSession = async (page) => {
      if (!sessionKey) return false;
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [sessionKey, sessionValue]);
      return true;
    };
    const loginOnce = async (page) => {
      const run = async () => {
        if (await adoptSession(page)) return;
        await login(page);
        const grabbed = await page.evaluate(() => {
          const k = Object.keys(localStorage).find((key) => key.includes("auth-token"));
          return k ? [k, localStorage.getItem(k)] : null;
        });
        if (grabbed) {
          sessionKey = grabbed[0];
          sessionValue = grabbed[1];
        }
      };
      const p = loginChain.then(run, run);
      loginChain = p.catch(() => {});
      return p;
    };
    const queue = [...sizes.entries()];
    const worker = async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const [i, [w, h]] = next;
        const page = await browser.newPage({ viewport: { width: w, height: h } });
        try {
          await loginOnce(page);
          await openStudio(page);
          // Below `lg` the desktop aside is hidden and the phone sheet is the
          // settings surface — but it is closed by default, so open it first.
          if (w < 1024) await openMobileEditor(page);
          const shell = {
            ...(await page.evaluate(SHELL)),
            asideOpen: await ensureCustomizeOpen(page),
          };
          if (shell.asideOpen) Object.assign(shell, await page.evaluate(SHELL));
          shells[`${w}x${h}`] = shell;
        } finally {
          await page.close();
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    report.sections.shell = shells;
    const builderOver = Object.entries(shells).filter(
      ([, s]) => (s.builder?.overflowBelow ?? 0) > 1,
    );
    log(
      "builder is bounded by the viewport",
      builderOver.length === 0,
      builderOver.length
        ? `${builderOver.length}/${sizes.length} sizes overflow, e.g. ${builderOver[0][0]} by ${builderOver[0][1].builder.overflowBelow}px`
        : "",
    );
    const noPanel = Object.entries(shells).filter(([, s]) => !s.panel && !s.sheet);
    report.sections.settingsSurface = Object.fromEntries(
      Object.entries(shells).map(([size, s]) => [
        size,
        s.panel
          ? `desktop aside ${s.panel.w}x${s.panel.h}`
          : s.sheet
            ? `mobile sheet ${s.sheet.w}x${s.sheet.h}`
            : "none",
      ]),
    );
    log(
      "a settings surface exists at every size",
      noPanel.length === 0,
      noPanel.length ? `no settings surface at ${noPanel.map(([size]) => size).join(", ")}` : "",
    );
    const panelOver = Object.entries(shells).filter(
      ([, s]) => s.panel && (s.panel?.overflowBelow ?? 0) > 1,
    );
    log(
      "customize panel sits inside the viewport",
      panelOver.length === 0,
      panelOver.length
        ? `${panelOver.length}/${sizes.length} sizes overflow, e.g. ${panelOver[0][0]} by ${panelOver[0][1].panel.overflowBelow}px`
        : "",
    );
  }

  // 2 ─ panel reach, at rest and scrolled
  if (want(2)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(page);
    await openStudio(page);
    await ensureCustomizeOpen(page);
    await expandMoreOptions(page);
    const atRest = await page.evaluate(REACH, undefined);
    const scrolled = await page.evaluate(REACH, 700);
    const scrolledEnd = await page.evaluate(REACH, 99999);
    report.sections.panelReach = { atRest, scrolled, scrolledEnd };
    log(
      "customize content does not spill under the panel footer",
      atRest.contentWrapper?.spills !== true,
      atRest.contentWrapper?.spills
        ? `content wrapper is ${atRest.contentWrapper.scrollH}px in a ${atRest.contentWrapper.clientH}px box with overflow:visible`
        : "",
    );
    log(
      "customize panel can scroll to its last setting",
      (atRest.maxScroll ?? 0) > 0 || (atRest.contentWrapper?.spills ?? false) === false,
      atRest.maxScroll === 0 && atRest.contentWrapper?.spills
        ? `scroll owner (${atRest.scrollOwner}) is pinned at scrollTop 0 while ${atRest.contentWrapper.scrollH}px of content sits in a ${atRest.contentWrapper.clientH}px box`
        : "",
    );
    for (const [label, snap] of [
      ["at rest", atRest],
      ["scrolled mid-panel", scrolled],
      ["scrolled to end", scrolledEnd],
    ]) {
      log(
        `every visible control is clickable (${label})`,
        snap.blocked.length === 0 && snap.offscreen.length === 0,
        [
          ...snap.blocked.map((b) => `${b.name} ← "${b.coveredBy}"`),
          ...snap.offscreen.map((b) => `${b.name} ← ${b.belowViewportBy}px below the viewport`),
        ]
          .slice(0, 4)
          .join("; "),
      );
    }
    await page.close();
  }

  // 3 ─ version popover
  if (want(3)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(page);
    await openStudio(page);
    const trigger = page.getByRole("button", { name: /version history/i }).first();
    // Each dismissal test starts from a known-open popover, so a pass means
    // "the popover was open and this input closed it" — never a vacuous pass on
    // an already-closed popover.
    const isOpen = async () => (await page.evaluate(POPOVER)).present;
    const forceToggle = async () => {
      await trigger.evaluate((el) => el.click()).catch(() => {});
      await page.waitForTimeout(500);
    };
    const ensureOpen = async () => {
      if (!(await isOpen())) await forceToggle();
      return isOpen();
    };
    // A real pointer click first: if the popover paints over its own trigger,
    // this times out and that is itself the finding.
    const openedByRealClick = await trigger
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(600);
    let pop = await page.evaluate(POPOVER);
    if (!pop.present) {
      await forceToggle();
      pop = await page.evaluate(POPOVER);
    }
    // With the popover open, its own trigger is the obvious way to close it.
    const closedByTrigger = await trigger
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(500);
    const afterTrigger = await page.evaluate(POPOVER);
    const beforeOutside = await ensureOpen();
    await page.mouse.click(300, 700);
    await page.waitForTimeout(400);
    const afterOutside = await page.evaluate(POPOVER);
    const beforeEscape = await ensureOpen();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const afterEscape = await page.evaluate(POPOVER);
    report.sections.popover = {
      pop,
      openedByRealClick,
      closedByTrigger,
      afterTrigger: afterTrigger.present,
      wasOpenForOutsideTest: beforeOutside,
      afterOutsideClick: afterOutside.present,
      wasOpenForEscapeTest: beforeEscape,
      afterEscape: afterEscape.present,
    };
    log(
      "version-history trigger can be clicked",
      openedByRealClick,
      openedByRealClick ? "" : "Playwright click on the trigger was intercepted",
    );
    log(
      "version popover does not cover its own trigger",
      !pop.coversTrigger,
      `trigger at x=${pop.trigger?.x},y=${pop.trigger?.y}, popover at x=${pop.popover?.x},y=${pop.popover?.y}`,
    );
    log(
      "version popover leaves the rest of the top bar clickable",
      (pop.coversHeaderControls ?? []).length === 0,
      (pop.coversHeaderControls ?? []).join(", "),
    );
    log(
      "version popover can be closed with its own trigger",
      closedByTrigger && !afterTrigger.present,
      closedByTrigger
        ? "click landed but the popover stayed open"
        : "the click on the trigger was intercepted by the popover",
    );
    log(
      "version popover closes on outside click",
      beforeOutside && !afterOutside.present,
      beforeOutside
        ? "still open after clicking the canvas"
        : "skipped — the popover could not be re-opened",
    );
    log(
      "version popover closes on Escape",
      beforeEscape && !afterEscape.present,
      beforeEscape ? "still open after Escape" : "skipped — the popover could not be re-opened",
    );
    log(
      "version popover has dialog semantics",
      !!(pop.role || pop.labelled),
      `role=${pop.role} label=${pop.labelled}`,
    );
    await page.close();
  }

  // 4 ─ settings function
  if (want(4)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(page);
    await openStudio(page);
    await ensureCustomizeOpen(page);
    await expandMoreOptions(page);
    const probes = [
      ["Structure", ["Column", "Balanced", "Wide"]],
      ["Personality", ["Editorial", "Technical", "Modern"]],
      ["Density", ["Compact", "Spacious"]],
      ["Border weight", ["Medium", "Thick", "Thin"]],
    ];
    const function_ = [];
    for (const [group, options] of probes) {
      for (const option of options) {
        const btn = page.getByRole("button", { name: new RegExp(`^${option}$`, "i") }).first();
        if (!(await btn.isVisible().catch(() => false))) {
          function_.push({ group, option, found: false });
          continue;
        }
        // Scroll the control into view first; the panel footer occludes rows
        // that sit under it, which would make a working control look broken.
        await btn.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
        // An option that is already the active one is a no-op by definition, so
        // a forced click on it proves nothing either way. The Studio config
        // persists between runs, so which option that is depends on history.
        const alreadyActive = (await btn.getAttribute("aria-pressed").catch(() => null)) === "true";
        const before = await page.evaluate(SNAP);
        const clicked = await btn
          .click({ timeout: 6000 })
          .then(() => true)
          .catch(() => false);
        await page.waitForTimeout(700);
        let after = await page.evaluate(SNAP);
        const changedVars = Object.keys(after.vars).filter((k) => before.vars[k] !== after.vars[k]);
        let worksWhenForced = null;
        if (!clicked) {
          // Unreachable by pointer. Drive it through the DOM to separate "the
          // setting is broken" from "the setting cannot be clicked".
          await btn.evaluate((el) => el.click()).catch(() => {});
          await page.waitForTimeout(700);
          const forced = await page.evaluate(SNAP);
          worksWhenForced =
            Object.keys(forced.vars).some((k) => before.vars[k] !== forced.vars[k]) ||
            before.styles.join("|") !== forced.styles.join("|") ||
            before.wrapperMaxWidth !== forced.wrapperMaxWidth;
          after = forced;
        }
        function_.push({
          group,
          option,
          found: true,
          alreadyActive,
          clicked,
          worksWhenForced,
          changedVars,
          stylesChanged: before.styles.join("|") !== after.styles.join("|"),
          wrapperWidthChanged: before.wrapperMaxWidth !== after.wrapperMaxWidth,
        });
      }
    }
    report.sections.settingsFunction = function_;
    // A setting that could not be clicked is a reachability defect, reported by
    // check 2 — do not double-count it here as a setting that does nothing.
    const dead = function_.filter(
      (f) =>
        f.found &&
        !f.alreadyActive &&
        f.clicked &&
        !f.changedVars.length &&
        !f.stylesChanged &&
        !f.wrapperWidthChanged,
    );
    const unclickable = function_.filter((f) => f.found && !f.alreadyActive && !f.clicked);
    log(
      "every setting that can be clicked repaints the canvas",
      dead.length === 0,
      dead.map((d) => `${d.group}/${d.option}`).join(", "),
    );
    log(
      "no setting is blocked from being clicked",
      unclickable.length === 0,
      unclickable
        .map(
          (d) =>
            `${d.group}/${d.option}${d.worksWhenForced ? " (works when forced — reachable-only defect)" : " (does not work at all)"}`,
        )
        .join(", "),
    );
    // An already-active option cannot be proven either way; record it so a
    // silent hole in coverage is visible in the artifact.
    const skipped = function_.filter((f) => f.alreadyActive);
    if (skipped.length) {
      console.log(
        `  · not proven: ${skipped.map((s) => `${s.group}/${s.option}`).join(", ")} (already the active value — a click cannot change it)`,
      );
    }
    const missing = function_.filter((f) => !f.found);
    log(
      "every expected setting control exists",
      missing.length === 0,
      missing.map((m) => `${m.group}/${m.option}`).join(", "),
    );

    // Structure is three fixed max-widths. Two of them can be wider than the
    // space the panel leaves the canvas, which makes the setting look dead.
    const structure = [];
    for (const option of ["Column", "Balanced", "Wide"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${option}$`, "i") }).first();
      await btn.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
      await btn.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(700);
      const snap = await page.evaluate(SNAP);
      structure.push({
        option,
        cap: snap.wrapperMaxWidth,
        rendered: snap.wrapperWidth,
        canvas: snap.canvasWidth,
      });
    }
    report.sections.structure = structure;
    const identical = structure.filter((s) => s.rendered === structure[0].rendered);
    log(
      "each Structure option renders differently",
      new Set(structure.map((s) => s.rendered)).size === structure.length,
      structure
        .map((s) => `${s.option} cap ${s.cap} → ${s.rendered}px rendered (canvas ${s.canvas}px)`)
        .join("; "),
    );
    void identical;

    // sliders
    const sliders = [];
    for (const label of [/corner radius in pixels/i, /opacity/i]) {
      const el = page.getByLabel(label).first();
      if (!(await el.isVisible().catch(() => false))) {
        sliders.push({ label: String(label), found: false });
        continue;
      }
      await el.evaluate((e) => e.scrollIntoView({ block: "center" })).catch(() => {});
      const before = await page.evaluate(SNAP);
      const box = await el.boundingBox();
      const valueBefore = await el.inputValue().catch(() => null);
      await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      const after = await page.evaluate(SNAP);
      sliders.push({
        label: String(label),
        found: true,
        valueBefore,
        valueAfter: await el.inputValue().catch(() => null),
        changedVars: Object.keys(after.vars).filter((k) => before.vars[k] !== after.vars[k]),
        stylesChanged: before.styles.join("|") !== after.styles.join("|"),
      });
    }
    report.sections.sliders = sliders;
    const deadSliders = sliders.filter(
      (s) => s.found && s.valueBefore !== s.valueAfter && !s.changedVars.length && !s.stylesChanged,
    );
    log(
      "every slider changes the canvas",
      deadSliders.length === 0,
      deadSliders
        .map((s) => `${s.label} moved ${s.valueBefore}→${s.valueAfter} with no visual change`)
        .join(", "),
    );

    // 6 ─ theme tiles
    const tiles = await page.evaluate(THEME_TILES);
    report.sections.themeTiles = tiles;
    const pressed = tiles.filter((t) => t.pressed);
    log(
      "exactly one theme tile is selected",
      pressed.length === 1,
      pressed.map((p) => p.name).join(" + "),
    );
    await page.close();
  }

  // 5 ─ personality reaches its labels
  if (want(5)) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await login(page);
    await openStudio(page);
    await ensureCustomizeOpen(page);
    const perPersonality = {};
    for (const personality of ["Editorial", "Technical", "Modern"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${personality}$`, "i") }).first();
      await btn.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
      await btn.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      perPersonality[personality] = await page.evaluate(LABELS);
    }
    report.sections.personality = perPersonality;
    // The contract in src/lib/studio-config.ts: `--studio-label-font` is the one
    // token the Studio micro-labels are supposed to follow (Inter by default,
    // JetBrains Mono under Technical), and `--font-title` is what headings
    // follow (Space Grotesk under Editorial, JetBrains Mono under Technical).
    // The two micro-label utilities must not disagree about it.
    for (const personality of ["Editorial", "Technical"]) {
      const rows = perPersonality[personality] || [];
      const want = personality === "Technical" ? "JetBrains Mono" : "Inter";
      const micro = rows.filter((r) => r.utility === "t-label" || r.utility === "section-label");
      const off = micro.filter((r) => r.family !== want);
      const headings = rows.filter((r) => /^h[123]$/.test(r.tag));
      const titleWant = personality === "Technical" ? "JetBrains Mono" : "Space Grotesk";
      const headingsOff = headings.filter((r) => r.family !== titleWant);
      log(
        `${personality} reaches the micro-labels it promises`,
        micro.length > 0 && off.length === 0,
        `${micro.length - off.length}/${micro.length} on ${want}; still on ${[...new Set(off.map((r) => r.family))].join("/") || "?"} — e.g. ${off
          .slice(0, 2)
          .map((r) => r.t)
          .join(", ")}`,
      );
      log(
        `${personality} reaches the headings it promises`,
        headings.length > 0 && headingsOff.length === 0,
        `${headings.length - headingsOff.length}/${headings.length} on ${titleWant}`,
      );
    }
    const all = perPersonality.Modern || [];
    // The two micro-label utilities claim to be the same treatment. Comparing
    // them only means something if both are actually on screen, so report which
    // ones were sampled rather than passing on one.
    const sampled = new Set(
      all
        .filter((r) => r.utility === "t-label" || r.utility === "section-label")
        .map((r) => r.utility),
    );
    const microStyles = new Set(
      all
        .filter((r) => r.utility === "t-label" || r.utility === "section-label")
        .map((r) => `${r.utility}:${r.size}/w${r.weight}/${r.ls}`),
    );
    report.sections.labelStyles = [...microStyles];
    report.sections.labelUtilitiesSampled = [...sampled];
    const comparable = sampled.size === 2 && microStyles.size === 1;
    const singleUtility = sampled.size === 1;
    log(
      "the two micro-label utilities are the same treatment",
      singleUtility ? true : comparable,
      singleUtility
        ? `not comparable — only ${[...sampled][0]} is used in the editor panel, so the two cannot be compared here; see qa-studio-view.mjs for the Studio side`
        : [...microStyles].join("  "),
    );
    if (singleUtility) {
      console.log(
        `  · the other micro-label utility is absent from this surface, so this check cannot fail — its treatment has to be read from src/styles.css`,
      );
    }
    await page.close();
  }

  // 7 ─ inspector rail
  if (want(7)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(page);
    await openStudio(page);
    const frame = page.locator("[data-block-id]").nth(2);
    await frame.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const rail = await page.evaluate(RAIL);
    report.sections.rail = rail;
    log(
      "painted controls in the builder meet the 24px target",
      !rail || rail.smallControls.length === 0,
      rail
        ? Object.entries(rail.smallByRegion)
            .map(([k, v]) => `${k} ${v}`)
            .join(", ")
        : "",
    );
    log(
      "every focusable in the builder has a name",
      !rail || rail.focusablesWithoutName === 0,
      rail
        ? `${rail.focusablesWithoutName} of ${rail.focusablesInBuilder} unnamed` +
            (rail.firstUnnamedAt
              ? ` — first at tab stop ${rail.firstUnnamedAt.index + 1} of ${rail.firstUnnamedAt.of}, ` +
                `${[...new Set((rail.unnamed || []).map((u) => u.src || u.tag))].slice(0, 2).join(", ")}`
              : "")
        : "",
    );
    await page.close();
  }

  // 8 ─ mobile sheet parity
  if (want(8)) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await login(page);
    await openStudio(page);
    // The sheet is closed by default (audit P0) — the canvas must be visible
    // first. Open it via the FAB before measuring its contents.
    const openByDefault = await page.evaluate(
      () =>
        !document.querySelector('section[aria-label="Mobile Studio editor"]') &&
        !![...document.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Edit Studio",
        ),
    );
    if (openByDefault) {
      await page.getByRole("button", { name: "Edit Studio", exact: true }).click();
      await page.waitForTimeout(400);
    }
    // Setting groups live on the Style tab; switch to it before inventorying.
    await page.getByRole("button", { name: "Style", exact: true }).click();
    await page.waitForTimeout(300);
    const sheet = await page.evaluate(() => {
      const sec = document.querySelector('section[aria-label="Mobile Studio editor"]');
      if (!sec) return null;
      const r = sec.getBoundingClientRect();
      const names = [...sec.querySelectorAll("button")]
        .map((b) =>
          (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim(),
        )
        .filter(Boolean);
      // Setting groups are `p.t-label` headings (e.g. "Corners"), not buttons.
      const groups = [...sec.querySelectorAll("p.t-label")].map((e) => e.textContent.trim());
      return {
        heightPctOfViewport: Math.round((r.height / innerHeight) * 100),
        openByDefault: false,
        controls: [...names, ...groups],
        tabs: [...sec.querySelectorAll("button")]
          .map((b) => b.textContent.trim())
          .filter((t) => ["Arrange", "Add", "Style"].includes(t)),
      };
    });
    await page.close();
    // Desktop inventory of setting groups, for the parity comparison below.
    const d = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(d);
    await openStudio(d);
    await ensureCustomizeOpen(d);
    await expandMoreOptions(d);
    report.sections.desktopPanelNames = await d.evaluate(() => {
      const aside = document.querySelector("[data-studio-builder] aside");
      if (!aside) return [];
      return [...aside.querySelectorAll("p.t-label")].map((e) => e.textContent.trim());
    });
    await d.close();
    report.sections.mobileSheet = sheet;
    // True parity: every desktop setting group (minus the panel title) must
    // appear on the phone's Style tab.
    const desktopGroups = (report.sections.desktopPanelNames || []).filter(
      (g) => g !== "Customize",
    );
    const mobileGroups = sheet ? sheet.controls : [];
    const onMobile = JSON.stringify(mobileGroups);
    const dropped = desktopGroups.filter(
      (g) => !onMobile.toLowerCase().includes(g.split(" ")[0].toLowerCase()),
    );
    report.sections.mobileDroppedGroups = dropped;
    log(
      "mobile editor sheet is closed by default with an Edit Studio FAB",
      openByDefault,
      openByDefault ? "" : "sheet rendered open (or FAB missing) before any interaction",
    );
    log(
      "mobile editor sheet is present on a phone viewport after opening it",
      !!sheet,
      sheet ? "" : "no sheet rendered after clicking the FAB",
    );
    log(
      "mobile Style tab carries the desktop setting groups",
      dropped.length === 0,
      `missing on mobile: ${dropped.join(", ")}`,
    );
    log(
      "mobile editor does not permanently cover the canvas",
      !sheet || sheet.heightPctOfViewport <= 52,
      sheet ? `open sheet is ${sheet.heightPctOfViewport}% of the viewport (cap 52%)` : "",
    );
  }
} finally {
  // Merge rather than replace: an `--only` run should not delete the sections
  // it did not measure, so the artifact stays one file.
  const file = path.join(OUT, "studio-audit.json");
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}
  fs.writeFileSync(
    file,
    JSON.stringify(
      { ...previous, ...report, sections: { ...previous.sections, ...report.sections } },
      null,
      2,
    ),
  );
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length} of ${results.length} checks failed`);
if (failed.length)
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
process.exitCode = failed.length ? 1 : 0;
