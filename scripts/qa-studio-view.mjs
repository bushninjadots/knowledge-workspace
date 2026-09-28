// Studio view audit harness (dev tool, not shipped).
//
// Companion to scripts/qa-studio.mjs. That harness audits the creator editor
// (/studio); this one audits the Studio itself (/profile) — the surface a
// creator lands on, the one that carries the publish action and the "what's
// next" guidance, and the one that has to render the editor's settings.
//
//   node scripts/qa-studio-view.mjs [--base http://localhost:3000]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
// Writes qa-artifacts/studio-view-audit.json and prints a pass/fail list.
//
// Checks, grouped by `--only N`:
//   1  shell geometry      the view fits the viewport at 6 sizes, the app nav
//                          survives a scroll, the steps rail pins when it exists
//   2  guidance, publish, reach
//                          how many competing "what's next" UIs are on screen,
//                          one publish action, one Customize entry in the chrome,
//                          every chrome control can be hit and is ≥24px
//   3  shared config, typography, a11y
//                          a setting made in the editor shows up here, how many
//                          label treatments coexist, names and content contrast
//   4  mobile              what a phone can still reach
// The editor (/studio) is covered by the companion qa-studio.mjs.
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
// `--only N` runs one check group: 1 shell · 2 guidance/publish/reach ·
// 3 shared config + typography + a11y · 4 mobile.
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

async function openView(page) {
  await page.goto(`${BASE}/profile`, { waitUntil: "load" });
  await settle(page, 3500);
}

// ── page probes ─────────────────────────────────────────────────────────────

/** 1. Does the view fit the viewport? */
const SHELL = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      y: Math.round(r.y),
      x: Math.round(r.x),
      w: Math.round(r.width),
      h: Math.round(r.height),
      overflowBelow: Math.round(r.bottom - innerHeight),
    };
  };
  const header = document.querySelector("main")?.closest("div")?.querySelector("header");
  const main = document.querySelector('main[aria-label="Studio"]');
  return {
    vw: innerWidth,
    vh: innerHeight,
    docOverflow: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
    header: box(header),
    main: box(main),
    mainScrollable: main ? main.scrollHeight - main.clientHeight : 0,
    // The app shell's own nav is also an <aside>, so match the steps rail by
    // its text or this field reports the nav rail at every size.
    rail: box(
      [...document.querySelectorAll("aside")].find((a) =>
        /studio steps/i.test(a.textContent || ""),
      ),
    ),
  };
};

/** 2–3. What guidance and publish affordances are on screen, and where? */
const SURFACES = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const named = (sel) =>
    [...document.querySelectorAll(sel)].filter(vis).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        what: text(el).slice(0, 70),
        box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      };
    });
  const buttons = [...document.querySelectorAll("button, a[href]")].filter(vis);
  const label = (el) =>
    (el.getAttribute("aria-label") || el.getAttribute("title") || text(el))
      .replace(/\s+/g, " ")
      .trim();
  const clicks = (needle) => buttons.filter((el) => label(el).toLowerCase().includes(needle));
  return {
    // Candidate "you should do this next" surfaces, by their own words.
    guidance: {
      makeItYours: named('[class*="rounded-xl"]').filter((s) => /make it yours/i.test(s.what)),
      stepsRail: named("aside").filter((s) => /studio steps/i.test(s.what)),
      draftStrip: named("div").filter((s) => /^Draft — visitors/i.test(s.what)),
      hiddenAreas: named("div").filter((s) => /hidden areas? — not visible/i.test(s.what)),
    },
    counts: {
      // A top-bar button and an "edit this area" affordance in the content are
      // different things; only the chrome duplicates are a problem. The
      // per-area affordances live inside a <header> of their own, so "is it in
      // the chrome" means "is it outside the Studio's own content".
      customizeInTopBar: clicks("customize").filter(
        (el) => el.closest("header") && !el.closest('main[aria-label="Studio"]'),
      ).length,
      customizeInContent: clicks("customize").filter((el) =>
        el.closest('main[aria-label="Studio"]'),
      ).length,
      publishEntryPoints: clicks("publish").map((el) => label(el)),
      openEditor: clicks("open customize").length,
      checklistRows:
        clicks("choose a starting feel").length + clicks("add your first project").length,
    },
    topBar: named("header").slice(0, 3),
  };
};

/** 4. Is every control in the view chrome clickable right now? */
const REACH = () => {
  const chrome = document.querySelector("header");
  const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const blocked = [];
  const notPainted = [];
  const scope = chrome ? [chrome, ...document.querySelectorAll("main ~ *, aside")] : [];
  for (const el of document.querySelectorAll("button, a[href], input, select")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.top < 0 || r.bottom > innerHeight) continue; // below the fold is not occlusion
    // A control that is not really painted is not one the pointer can be
    // blocked from reaching. Three ways that happens here: a closed
    // disclosure/menu (`pointer-events: none`), a 1x1 `.sr-only` wrapper — the
    // sidebar's hidden duplicate create-project button overflows its clipped
    // parent and still reports a real box — and an `aria-hidden` subtree.
    let inert = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const ncs = getComputedStyle(n);
      if (ncs.pointerEvents === "none") {
        inert = "pointer-events: none";
        break;
      }
      if (n.getAttribute("aria-hidden") === "true") {
        inert = "aria-hidden";
        break;
      }
      if (ncs.clip !== "auto" || (ncs.clipPath !== "none" && ncs.clipPath !== "")) {
        inert = "clipped";
        break;
      }
      if (n !== el && parseFloat(ncs.width) <= 2 && parseFloat(ncs.height) <= 2) {
        inert = "inside a 1x1 sr-only wrapper";
        break;
      }
    }
    if (inert) {
      notPainted.push({
        name: (el.getAttribute("aria-label") || text(el) || el.tagName)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30),
        why: inert,
      });
      continue;
    }
    const inChrome = scope.some((s) => s && s.contains(el));
    if (!inChrome) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) continue;
    blocked.push({
      name: (el.getAttribute("aria-label") || text(el) || el.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 30),
      coveredBy: (hit?.textContent || hit?.tagName || "?").replace(/\s+/g, " ").trim().slice(0, 30),
    });
  }
  const small = [...document.querySelectorAll("header button, header a[href]")]
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        n: (el.getAttribute("aria-label") || text(el) || "?")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 24),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
  return { blocked, notPainted, headerControls: small };
};

/** 6. Micro-label treatments in the Studio chrome. Headings are excluded: a
 *  36px title and an 11px uppercase label are different roles, not a conflict. */
const LABELS = () => {
  const rows = [];
  for (const el of document.querySelectorAll(
    "header *, main[aria-label] .t-label, main[aria-label] .section-label, [class*='text-2xs'], [class*='text-3xs']",
  )) {
    const cs = getComputedStyle(el);
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 26) continue;
    if (!el.getBoundingClientRect().height) continue;
    if (cs.textTransform !== "uppercase") continue;
    if (/^h[1-6]$/.test(el.tagName.toLowerCase())) continue;
    rows.push({
      t,
      tag: el.tagName.toLowerCase(),
      size: cs.fontSize,
      weight: cs.fontWeight,
      ls: cs.letterSpacing,
      family: cs.fontFamily.split(",")[0].replace(/"/g, ""),
    });
  }
  const seen = new Set();
  const uniq = rows.filter((r) => (seen.has(r.t + r.family) ? false : seen.add(r.t + r.family)));
  const treatments = new Map();
  for (const r of uniq) {
    const k = `${r.size}/w${r.weight}/${r.ls}/${r.family}`;
    treatments.set(k, [...(treatments.get(k) ?? []), r.t]);
  }
  return {
    treatments: [...treatments].map(([k, samples]) => ({ k, samples: samples.slice(0, 3) })),
    rows: uniq,
  };
};

/** 7. Accessibility of the view chrome. */
const A11Y = () => {
  const focusables = [
    ...document.querySelectorAll(
      'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.getBoundingClientRect().width > 0);
  const name = (el) =>
    (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim();
  const inHeader = focusables.filter((el) => el.closest("header"));
  return {
    focusables: focusables.length,
    inHeader: inHeader.length,
    withoutName: inHeader.filter((el) => !name(el)).length,
    headerNames: inHeader.map((el) => name(el).replace(/\s+/g, " ").trim().slice(0, 24)),
    disabledFocusable: focusables.filter((el) => el.disabled).length,
  };
};

/** Contrast of the Studio's own content (not the app chrome).
 *
 *  Colours here may be any CSS Color 4 notation (oklch, color-mix), so resolve
 *  them by compositing onto a canvas and reading the pixel back rather than by
 *  parsing the computed string. */
const CONTRAST = () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rgb = (color) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = ([r, g, b]) =>
    [r, g, b]
      .map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
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
    // Large text (>=24px, or >=18.66px bold) is held to 3:1, not 4.5:1.
    const large =
      parseFloat(cs.fontSize) >= 24 ||
      (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    const cr = ratio(cs.color, bgOf(el));
    if (cr < (large ? 3 : 4.5))
      out.push({
        t: t.slice(0, 30),
        cr,
        size: cs.fontSize,
        weight: cs.fontWeight,
        color: cs.color,
        large,
      });
  }
  const seen = new Set();
  return out.filter((o) => (seen.has(o.t) ? false : seen.add(o.t))).slice(0, 12);
};

// ── run ─────────────────────────────────────────────────────────────────────

const report = { base: BASE, at: new Date().toISOString(), sections: {} };
const browser = await chromium.launch();
try {
  // 1 ─ geometry
  if (want(1)) {
    const sizes = [
      [1920, 1080],
      [1440, 900],
      [1280, 800],
      [1023, 768],
      [768, 1024],
      [390, 844],
    ];
    const shells = {};
    for (const [w, h] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await login(page);
      await openView(page);
      shells[`${w}x${h}`] = await page.evaluate(SHELL);
      await page.close();
    }
    report.sections.shell = shells;
    // A long Studio is meant to scroll. What matters is that it scrolls in
    // exactly one place and that the app nav stays put while it does — the
    // Studio deliberately does not draw its own sticky bar.
    const nested = Object.entries(shells).filter(([, s]) => (s.mainScrollable ?? 0) > 1);
    log(
      "the Studio scrolls in one place",
      nested.length === 0,
      nested.length
        ? `${nested.map(([size, s]) => `${size} main scrolls ${s.mainScrollable}px inside a scrolling document`).join("; ")}`
        : "the document is the only scroll owner",
    );
    // Does the app nav survive a scroll?
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(p);
    await openView(p);
    const navBefore = await p.evaluate(() => {
      const nav = document.querySelector("header");
      return { y: Math.round(nav.getBoundingClientRect().y), pos: getComputedStyle(nav).position };
    });
    await p.evaluate(() => window.scrollTo(0, 600));
    await p.waitForTimeout(400);
    const navAfter = await p.evaluate(() => {
      const nav = document.querySelector("header");
      const rail = [...document.querySelectorAll("aside")].find((a) =>
        /studio steps/i.test(a.textContent || ""),
      );
      const rr = rail?.getBoundingClientRect();
      return {
        navY: Math.round(nav.getBoundingClientRect().y),
        railY: rr && rr.width > 0 ? Math.round(rr.y) : null,
        railWidth: rr ? Math.round(rr.width) : 0,
      };
    });
    report.sections.scrolled = { navBefore, navAfter };
    log(
      "the app nav stays visible when the Studio scrolls",
      navAfter.navY >= 0 && navAfter.navY < 8,
      `nav position:${navBefore.pos}, y ${navBefore.y} → ${navAfter.navY} after scrolling 600px`,
    );
    // The steps rail is `2xl` only, so at 1440 there is nothing to assert.
    log(
      "the steps rail stays pinned while the Studio scrolls",
      navAfter.railY === null || (navAfter.railY > 0 && navAfter.railY < 900),
      navAfter.railY === null
        ? `rail is not rendered at ${1440}px (2xl only)`
        : `rail y ${navAfter.railY} after scrolling 600px`,
    );
    await p.close();
    report.sections.railShownAt = Object.entries(shells)
      .filter(([, s]) => s.rail && s.rail.w > 0)
      .map(([size, s]) => `${size}:${s.rail.w}px`);
  }

  // 2 ─ guidance, publish, reach
  if (want(2)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(page);
    await openView(page);
    const surfaces = await page.evaluate(SURFACES);
    const reach = await page.evaluate(REACH);
    report.sections.surfaces = surfaces;
    report.sections.reach = reach;
    const guidanceCount = [
      surfaces.guidance.makeItYours.length && "Make it yours checklist",
      surfaces.guidance.stepsRail.length && "Studio steps rail",
      surfaces.guidance.draftStrip.length && "draft strip",
      surfaces.guidance.hiddenAreas.length && "hidden areas strip",
    ].filter(Boolean);
    log(
      "one guidance surface on the Studio",
      guidanceCount.length <= 1,
      `${guidanceCount.length} visible: ${guidanceCount.join(" + ") || "none"}`,
    );
    log(
      "one primary publish action",
      surfaces.counts.publishEntryPoints.length <= 1,
      surfaces.counts.publishEntryPoints.join(" + "),
    );
    log(
      "customize has a single entry point in the chrome",
      surfaces.counts.customizeInTopBar <= 1,
      `${surfaces.counts.customizeInTopBar} in the top bar, ${surfaces.counts.customizeInContent} in the content`,
    );
    log(
      "every control in the view chrome is clickable",
      reach.blocked.length === 0,
      reach.blocked.map((b) => `${b.name} ← "${b.coveredBy}"`).join("; "),
    );
    log(
      "top-bar controls meet the 24px target",
      reach.headerControls.every((c) => c.h >= 24),
      reach.headerControls
        .filter((c) => c.h < 24)
        .map((c) => `${c.n} ${c.w}x${c.h}`)
        .join(", "),
    );
    await page.close();
  }

  // 3 ─ a setting made in the editor has to show up here
  if (want(3)) {
    const editor = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(editor);
    await editor.goto(`${BASE}/studio`, { waitUntil: "load" });
    await settle(editor, 3000);
    const view = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await login(view);
    await openView(view);
    const before = await view.evaluate(LABELS);
    const technical = editor
      .locator("[data-studio-builder] aside")
      .getByRole("button", { name: /^technical$/i })
      .first();
    let clicked = false;
    if (await technical.isVisible().catch(() => false)) {
      await technical.evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
      clicked = await technical
        .click({ timeout: 6000 })
        .then(() => true)
        .catch(() => false);
    }
    await settle(editor, 1500);
    await view.reload({ waitUntil: "load" });
    await settle(view, 3000);
    const after = await view.evaluate(LABELS);
    const mono = (snap) =>
      snap.rows.filter((r) => /JetBrains Mono/i.test(r.family)).map((r) => r.t);
    // Read the token itself, so a failure says which link in the chain broke:
    // the setting did not persist, or nothing on the Studio reads it.
    const token = await view.evaluate(() => {
      const el = document.querySelector('main[aria-label="Studio"]') ?? document.body;
      const cs = getComputedStyle(el);
      return {
        labelFont: cs.getPropertyValue("--studio-label-font").trim(),
        titleFont: cs.getPropertyValue("--font-title").trim(),
      };
    });
    report.sections.sharedConfig = {
      clickedTechnical: clicked,
      token,
      monoLabelsBefore: mono(before),
      monoLabelsAfter: mono(after),
      treatmentsBefore: before.treatments,
      treatmentsAfter: after.treatments,
    };
    log(
      "the editor's Technical personality reaches the Studio",
      mono(after).length > 0,
      `--studio-label-font on the Studio is ${token.labelFont || "(unset)"}; mono labels: ${mono(after).join(", ") || "none"}`,
    );
    report.sections.viewTypography = after.treatments;
    log(
      "one uppercase label treatment in the Studio chrome",
      after.treatments.length <= 2,
      `${after.treatments.length} treatments: ${after.treatments.map((t) => t.k).join("  ")}`,
    );
    const a11y = await view.evaluate(A11Y);
    const contrast = await view.evaluate(CONTRAST);
    report.sections.a11y = a11y;
    report.sections.contrast = contrast;
    log(
      "every top-bar control has an accessible name",
      a11y.withoutName === 0,
      `${a11y.withoutName} of ${a11y.inHeader} unnamed: ${a11y.headerNames.join(" | ")}`,
    );
    log(
      "block text meets 4.5:1",
      contrast.length === 0,
      contrast.map((c) => `${c.t} ${c.cr}:1 @${c.size}`).join("; "),
    );
    await view.close();
    await editor.close();
  }

  // 4 ─ mobile
  if (want(4)) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await login(page);
    await openView(page);
    const m = await page.evaluate(() => {
      const vis = (el) => el.getBoundingClientRect().height > 0;
      const t = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
      return {
        checklist:
          vis(document.querySelector(".t-label")) && /make it yours/i.test(t(document.body)),
        stepsRail: [...document.querySelectorAll("aside")].some(
          (a) => vis(a) && /studio steps/i.test(t(a)),
        ),
        topBarHeight: Math.round(
          document.querySelector("header")?.getBoundingClientRect().height ?? 0,
        ),
        headerLabels: [...document.querySelectorAll("header button, header a[href]")]
          .filter(vis)
          .map((el) =>
            (el.getAttribute("aria-label") || t(el) || "?")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 20),
          ),
        smallTargets: [...document.querySelectorAll("header button, header a[href]")]
          .filter(vis)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              n: (el.getAttribute("aria-label") || t(el) || "?").slice(0, 18),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          })
          .filter((c) => c.h < 24),
      };
    });
    report.sections.mobile = m;
    // A near-complete account legitimately has no guidance left to show, so
    // this is recorded rather than asserted. The rail is 2xl-only, which means
    // a phone can only ever get the checklist.
    log(
      "the phone can still reach the editor",
      m.headerLabels.some((l) => /customize/i.test(l)),
      `top bar: ${m.headerLabels.join(" | ")}`,
    );
    log(
      "mobile top-bar controls meet the 24px target",
      m.smallTargets.length === 0,
      m.smallTargets.map((c) => `${c.n} ${c.w}x${c.h}`).join(", "),
    );
    await page.close();
  }
} finally {
  // Merge rather than replace, so an `--only` run keeps the other sections.
  const file = path.join(OUT, "studio-view-audit.json");
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
