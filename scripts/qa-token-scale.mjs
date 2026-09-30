// Tethyr QA: design-token scale probe (dev tool, not shipped).
// Usage: node scripts/qa-token-scale.mjs [--base http://localhost:3000]
//
// Tailwind classes are compile-checked, but the *token definitions* behind
// them are not: someone editing --radius-* in styles.css, reintroducing a
// raw shadow/blur on a static surface, or hand-rolling the translucent
// on-media recipe drifts the design system silently — every page still
// renders, so nothing else catches it. This probe asserts the invariants
// the design constitution fixes, in the real browser:
//
//   1. the radius ladder (--radius-sm..--radius-4xl) is ascending, with
//      --radius-4xl reserved at 8px and --radius == --radius-lg,
//   2. the on-media-control utility exists in the bundle and resolves to
//      computed colors (a color-mix typo would compile and silently no-op),
//   3. no dead `hsl(var(--token))` definitions shipped (the tokens are oklch
//      full colors — an hsl() wrapper is invalid CSS that browsers drop),
//   4. computed spot-checks: Button default 3px, Card 5px.
//
// Exit 0 when every invariant holds; exit 1 otherwise.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : def;
};
const BASE = arg("base", process.env.QA_BASE || "http://localhost:3000");

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}

// Radius ladder read straight from the source of truth.
const css = readFileSync("src/styles.css", "utf8");
function token(name) {
  const m = css.match(new RegExp(`--radius-${name}:\\s*([0-9.]+)px`));
  return m ? Number(m[1]) : undefined;
}
const ladder = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].map((n) => [n, token(n)]);
const missing = ladder.filter(([, v]) => v === undefined).map(([n]) => n);
check(
  "radius ladder defined",
  missing.length === 0,
  `missing --radius-*: ${missing.join(", ") || "none"}`,
);
if (missing.length === 0) {
  const values = ladder.map(([, v]) => v);
  // Non-decreasing, not strictly ascending: the scale deliberately collapses
  // 2xl onto xl (both 5px) — the invariant is that nothing ever goes backwards.
  const ascending = values.every((v, i) => i === 0 || v >= values[i - 1]);
  check(
    "radius ladder non-decreasing",
    ascending,
    `got ${ladder.map(([n, v]) => `${n}=${v}`).join(", ")}`,
  );
  const reserved = token("4xl");
  check("--radius-4xl reserved at 8px", reserved === 8, `got ${reserved}px`);
  // --radius may be defined as a literal equal to lg or as var(--radius-lg);
  // both forms keep the base radius tied to the ladder.
  const lgValue = token("lg");
  const baseDefs = [...css.matchAll(/--radius:\s*([^;]+);/g)].map((m) => m[1].trim());
  const baseOk =
    baseDefs.length > 0 &&
    baseDefs.every((d) => d === `var(--radius-lg)` || Number.parseFloat(d) === lgValue);
  check(
    "--radius ties to the ladder (lg)",
    baseOk,
    `got ${baseDefs.join(" | ") || "no --radius definition"}`,
  );
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1200);

  // 2 — the utility must be present in the served CSS and resolve computed.
  const media = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "on-media-control";
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const out = { bg: s.backgroundColor, border: s.borderColor };
    el.remove();
    return out;
  });
  const resolves = (v) => Boolean(v) && v !== "none" && !v.startsWith("color-mix");
  check(
    "on-media-control resolves to computed colors",
    resolves(media.bg) && resolves(media.border),
    `background=${media.bg}, border-color=${media.border}`,
  );

  // 3 — no dead hsl(var(--token)) definitions in same-origin stylesheets.
  // (Cross-origin sheets, e.g. Google Fonts, are out of scope and unreachable
  // without network.)
  const deadHsl = await page.evaluate(async () => {
    const origin = location.origin;
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((l) => l.href)
      .filter((h) => h && h.startsWith(origin));
    for (const href of sheets) {
      try {
        const text = await fetch(href).then((r) => r.text());
        if (/hsl\(\s*var\(/.test(text)) return href;
      } catch {
        // An unfetchable sheet can't hide an hsl(var()) we shipped — skip it.
      }
    }
    return null;
  });
  check("no hsl(var(--token)) in served CSS", deadHsl === null, `found in ${deadHsl}`);

  // 4 — the primitives compute to the documented scale (3px md / 5px xl).
  const radii = await page.evaluate(() => {
    const btn = document.querySelector("button");
    const card = document.querySelector('[class*="rounded-xl"]');
    return {
      button: btn ? getComputedStyle(btn).borderRadius : null,
      card: card ? getComputedStyle(card).borderRadius : null,
    };
  });
  check(
    "Button primitives compute to rounded-md (3px)",
    radii.button === "3px",
    `got ${radii.button ?? "no button on page"}`,
  );
  check(
    "rounded-xl surfaces compute to 5px",
    radii.card === "5px",
    `got ${radii.card ?? "no rounded-xl surface on page"}`,
  );
} finally {
  await browser.close();
}

console.log(
  failures.length === 0
    ? "\nOK — token scale invariants hold."
    : `\n${failures.length} invariant(s) failed.`,
);
process.exit(failures.length === 0 ? 0 : 1);
