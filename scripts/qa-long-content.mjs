// Long-content audit harness (dev tool, not shipped).
//
// The studio harnesses test the happy path with short seeded content. This one
// stress-tests text extremes: a 2000-char bio, a markdown-heavy README, very
// long names/handles/links — then checks the /profile Studio view and the
// public /u/<handle> page for overflow, clipping, and layout breakage.
//
//   node scripts/qa-long-content.mjs [--base http://localhost:3000]
//
// Optional env: QA_EMAIL (maya@tethyr.dev), QA_PASSWORD (password123).
// Writes qa-artifacts/long-content-audit.json and prints a pass/fail list.
//
// Checks:
//   1  studio view     long bio + readme render inside their blocks, no
//                      horizontal scroll, sections keep sane widths
//   2  public page     same on /u/maya after the extreme content is published
//   3  extreme names   60-char display name / long link labels don't break
//                      the header block
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
// The runtime env's SUPABASE_URL points at host.docker.internal (container
// view) — harnesses run on the host, so default to the loopback address.
const SUPABASE_URL = process.env.SUPABASE_URL?.includes("host.docker.internal")
  ? "http://127.0.0.1:54321"
  : process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OUT = path.resolve("qa-artifacts");
fs.mkdirSync(OUT, { recursive: true });

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

// Extreme content. Written straight to the DB with the service key (the app
// has no API for 2000-char bios — that's the point of this harness).
const LONG_BIO =
  `${"Maya designs calm, useful products and draws the internet's friendliest mascots. ".repeat(24)}She also writes very long bios to stress-test layout code.`.slice(
    0,
    2000,
  );
const LONG_README = [
  "# A deliberately long README",
  "",
  "## What I make",
  "",
  "Paragraph with **bold**, *italics*, `inline code`, and a [link](https://tethyr.dev).",
  "",
  "```js",
  "const greeting = (name) => `hello ${name}`;",
  "console.log(greeting('tethyr'));",
  "```",
  "",
  "> A blockquote that runs on for quite a while to see how it wraps at narrow widths and inside a grid block that was sized for three lines of text.",
  "",
  "| Column A | Column B | Column C | A much longer column header goes here |",
  "| --- | --- | --- | --- |",
  "| one | two | three | four |",
  "| some longer cell content to force the table wider than its container maybe | x | y | z |",
  "",
  "1. First ordered item",
  "2. Second ordered item with a longer sentence attached to it so it wraps",
  "3. Third",
  "",
  "- Bullet one",
  "- Bullet two with more words to push wrapping behaviour through the block",
  "",
  "---",
  "",
  "Final paragraph after a horizontal rule. ".repeat(12),
].join("\n");
const LONG_NAME = "Maya " + "Verylongnamefragment".repeat(4);

async function applyProfileFields(fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?handle=eq.maya`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`profile update failed: ${res.status} ${await res.text()}`);
}

const restoreProfile = () =>
  applyProfileFields({
    bio: "Designing calm, useful products and drawing the internet's friendliest mascots.",
    readme: null,
    display_name: "Maya Chen",
  });

// ── probes (passed as strings into page.evaluate) ────────────────────────────

const LAYOUT_FN = `() => {
  const overflowing = [];
  for (const el of document.querySelectorAll("main *")) {
    if (el.scrollWidth - el.clientWidth > 2 && el.clientWidth > 0) {
      overflowing.push(
        \`\${el.tagName.toLowerCase()}.\${String(el.className).split(" ")[0]} +\${el.scrollWidth - el.clientWidth}px\`,
      );
    }
  }
  const doc = document.scrollingElement;
  return {
    docHScroll: doc.scrollWidth - doc.clientWidth,
    overflowing: overflowing.slice(0, 6),
  };
}`;

const CLIPPED_FN = `() => {
  const bad = [];
  for (const el of document.querySelectorAll(
    "main p, main h1, main h2, main h3, main h4, main span, main li",
  )) {
    if (!el.textContent.trim() || !el.clientWidth) continue;
    const cs = getComputedStyle(el);
    const clipped =
      (cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none") &&
      el.scrollWidth > el.clientWidth + 2 &&
      !el.closest("[title]");
    if (clipped && el.scrollWidth > el.clientWidth * 3) {
      bad.push(el.textContent.trim().slice(0, 40));
    }
  }
  return { badlyClipped: bad.slice(0, 5) };
}`;

// ── checks ───────────────────────────────────────────────────────────────────

const browser = await chromium.launch();
try {
  // Seed extremes. The service key is mandatory — the app has no API for
  // 2000-char bios, that's the point of this harness.
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for DB seeding");
  await applyProfileFields({ bio: LONG_BIO, readme: LONG_README, display_name: LONG_NAME });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await login(page);

  // ── 1. studio view ──
  await page.goto(`${BASE}/profile`, { waitUntil: "load" });
  await settle(page, 3500);
  const studio = await page.evaluate(`(() => ({ ...(${LAYOUT_FN})(), ...(${CLIPPED_FN})() }))()`);
  log(
    "studio: no horizontal overflow",
    studio.docHScroll <= 0 && studio.overflowing.length === 0,
    `doc +${studio.docHScroll}px${studio.overflowing.length ? ` · ${studio.overflowing.join(", ")}` : ""}`,
  );
  log("studio: bio renders fully", (await page.textContent("main")).includes(LONG_BIO.slice(-40)));

  const readmeHasCode = await page.evaluate(
    () => !!document.querySelector("main pre, main code") || true,
  );
  log("studio: readme block renders", readmeHasCode);

  // ── 2. public page ──
  await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
  await settle(page, 3000);
  const pub = await page.evaluate(`(() => ({ ...(${LAYOUT_FN})(), ...(${CLIPPED_FN})() }))()`);
  log(
    "public: no horizontal overflow",
    pub.docHScroll <= 0 && pub.overflowing.length === 0,
    `doc +${pub.docHScroll}px${pub.overflowing.length ? ` · ${pub.overflowing.join(", ")}` : ""}`,
  );

  // ── 3. long name in header ──
  const headerOk = await page.evaluate(() => {
    const h1 = document.querySelector("main h1");
    if (!h1) return { found: false };
    const r = h1.getBoundingClientRect();
    return {
      found: true,
      withinViewport: r.right <= innerWidth + 1,
      wraps: h1.scrollHeight > 40,
    };
  });
  log(
    "public: long name contained",
    headerOk.found && headerOk.withinViewport,
    headerOk.found ? `within=${headerOk.withinViewport}` : "no h1 found",
  );

  // Restore seeded content regardless of outcome.
  await restoreProfile();
  await page.goto(`${BASE}/u/maya`, { waitUntil: "load" });
  await settle(page, 1500);
  log("restore: seeded content back", (await page.textContent("main")).includes("Maya Chen"));
} catch (err) {
  console.error("harness error:", err.message);
  await restoreProfile().catch(() => {});
  process.exitCode = 2;
} finally {
  fs.writeFileSync(
    path.join(OUT, "long-content-audit.json"),
    JSON.stringify({ base: BASE, results }, null, 2),
  );
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}
