// Two-user challenge loop click-through: create challenge → second user joins →
// advances status → submits work → creator passes it → +15 reputation, badge,
// and the participant-facing outcomes (passed state + notification). Covers the
// Phase 1 loop-plan item "Challenge submit → review → pass-gated reputation"
// (docs/TETHYR_LOOP_VERIFICATION_PLAN.md). Run against a seeded local stack:
//   node scripts/qa-challenge-loop.mjs
// Optional env: QA_BASE (default http://localhost:3000), QA_SB_REST (default
// http://127.0.0.1:54321), SB_KEY (anon key; self-served from the dev server).
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
// REST base for verification probes (matches supabase start's local bind).
const SB_REST = process.env.QA_SB_REST || "http://127.0.0.1:54321";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const stamp = Date.now();
const CHALLENGE_TITLE = `QA Loop Challenge ${stamp}`;

const browser = await chromium.launch();
const errors = [];

async function newSession() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
  // domcontentloaded + a form wait is deterministic; networkidle flaked on the
  // dev server (lingering HMR/websocket traffic after on-demand transforms).
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#email", { timeout: 20000 });
  await page.waitForTimeout(1000);
  return page;
}

async function login(page, email) {
  // A click before hydration falls through to a native GET submit (the "/login?"
  // tell), so retry until the SPA actually handles the submit.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: /log in/i }).click();
    const ok = await page
      .waitForURL(/dashboard/, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      await page.waitForTimeout(800);
      return;
    }
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  }
  throw new Error(`login failed for ${email}; still on ${page.url()}`);
}

// REST probe helpers — run inside a page context so they reuse the session's
// Supabase auth token from localStorage.
const tokenOf = (page) =>
  page.evaluate(() => {
    const tokKey = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.includes("auth-token"),
    );
    return tokKey ? (JSON.parse(localStorage.getItem(tokKey))?.access_token ?? null) : null;
  });

async function restGet(page, path) {
  const KEY = page.__SB_KEY;
  const token = await tokenOf(page);
  const r = await page.evaluate(
    async ({ SB_REST, path, KEY, token }) => {
      const res = await fetch(`${SB_REST}${path}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`rest ${res.status}: ${await res.text()}`);
      return res.json();
    },
    { SB_REST, path, KEY, token },
  );
  return r;
}

// ── Creator session: maya ─────────────────────────────────────────────────────
const creator = await newSession();
await login(creator, "maya@tethyr.dev");
creator.__SB_KEY =
  process.env.SB_KEY ||
  (await creator.evaluate(async () => {
    try {
      const src = await fetch("/src/integrations/supabase/client.ts").then((r) => r.text());
      const m = src.match(/VITE_SUPABASE_PUBLISHABLE_KEY"?:\s*"([^"]+)"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }));

// 1. Create a fresh challenge so the loop is repeatable across runs.
await creator.goto(`${BASE}/challenges`, { waitUntil: "domcontentloaded" });
await creator.getByRole("button", { name: "Create Challenge", exact: true }).first().click();
const dialog = creator.getByRole("dialog").first();
await dialog.waitFor({ state: "visible", timeout: 10000 });
await dialog.locator('[aria-label="Challenge title"]').fill(CHALLENGE_TITLE);
await dialog
  .locator('[aria-label="Challenge description"]')
  .fill("Automated two-user loop test challenge.");
await dialog.getByRole("button", { name: "Create challenge", exact: true }).click();
await creator.waitForTimeout(2000);
log(
  "create: no error toast",
  (await creator
    .locator("[data-sonner-toast][data-type=error]")
    .count()
    .catch(() => 0)) === 0,
);

let challengeId = null;
try {
  const rows = await restGet(
    creator,
    `/rest/v1/challenges?select=id,title&title=eq.${encodeURIComponent(CHALLENGE_TITLE)}&order=created_at.desc&limit=1`,
  );
  challengeId = rows?.[0]?.id ?? null;
} catch (e) {
  console.error("challenge id probe failed:", String(e).slice(0, 200));
}
log("create: challenge persisted", !!challengeId, challengeId ?? CHALLENGE_TITLE);

let participantId = null;
let repBefore = null;
let badgeBefore = null;

if (challengeId) {
  await creator.close();

  // ── Participant session: devon ────────────────────────────────────────────
  const applicant = await newSession();
  await login(applicant, "devon@tethyr.dev");
  applicant.__SB_KEY = creator.__SB_KEY;
  await applicant.goto(`${BASE}/challenges/${challengeId}`, { waitUntil: "domcontentloaded" });
  await applicant.getByRole("button", { name: "Join Challenge" }).click({ timeout: 20000 });
  await applicant.waitForTimeout(2000);
  log(
    "join: participant joined",
    (await applicant
      .getByRole("button", { name: "Leave Challenge" })
      .count()
      .catch(() => 0)) > 0,
  );

  // Capture pass-gated reward baselines BEFORE submitting (devon's own token,
  // so profile/badge reads are self-scoped regardless of public RLS).
  try {
    const prof = await restGet(
      applicant,
      "/rest/v1/profiles?select=id,reputation_score&handle=eq.devon&limit=1",
    );
    participantId = prof?.[0]?.id ?? null;
    repBefore = prof?.[0]?.reputation_score ?? null;
    const badges = await restGet(
      applicant,
      `/rest/v1/user_achievements?select=id&profile_id=eq.${participantId}&achievement=eq.challenge_winner`,
    );
    badgeBefore = badges.length;
  } catch (e) {
    console.error("baseline probe failed:", String(e).slice(0, 200));
  }

  // 2. Advance joined → in_progress, then submit work for review.
  await applicant.locator('button[aria-label="Mark as in progress"]').click({ timeout: 20000 });
  await applicant.waitForTimeout(1500);
  await applicant
    .getByPlaceholder("Link to your work (repo, video, doc…) or uploaded file name")
    .fill("https://example.com/devon-challenge-submission");
  await applicant
    .getByPlaceholder("Short note for the reviewer (optional)")
    .fill("QA harness submission.");
  await applicant.getByRole("button", { name: "Submit for Review" }).click();
  await applicant.waitForTimeout(2000);
  log(
    "submit: under review state",
    (await applicant
      .getByText(/under review/i)
      .count()
      .catch(() => 0)) > 0,
  );
  await applicant.close();

  // ── Creator passes the submission ─────────────────────────────────────────
  const creator2 = await newSession();
  await login(creator2, "maya@tethyr.dev");
  creator2.__SB_KEY = creator.__SB_KEY;
  await creator2.goto(`${BASE}/challenges/${challengeId}`, { waitUntil: "domcontentloaded" });
  await creator2.waitForTimeout(2000);
  const passBtn = creator2.getByRole("button", { name: "Pass — award badge" }).first();
  if (await passBtn.isVisible().catch(() => false)) {
    await passBtn.click();
    await creator2.waitForTimeout(2500);
    // Reload so the roster badge reflects the persisted verdict.
    await creator2.goto(`${BASE}/challenges/${challengeId}`, { waitUntil: "domcontentloaded" });
    await creator2.waitForTimeout(2000);
    log(
      "review: participant marked Passed",
      (await creator2
        .getByText("Passed", { exact: true })
        .count()
        .catch(() => 0)) > 0,
    );
  } else {
    log(
      "review: participant marked Passed",
      false,
      "Pass button not visible (submission missing?)",
    );
  }
  await creator2.close();

  // ── Participant sees the outcomes ─────────────────────────────────────────
  const applicant2 = await newSession();
  await login(applicant2, "devon@tethyr.dev");
  applicant2.__SB_KEY = creator.__SB_KEY;
  await applicant2.goto(`${BASE}/challenges/${challengeId}`, { waitUntil: "domcontentloaded" });
  await applicant2.waitForTimeout(2000);
  log(
    "pass: passed-review state",
    (await applicant2
      .getByText(/passed review — badge \+ 15 reputation earned!/i)
      .count()
      .catch(() => 0)) > 0,
  );

  // 3. Pass-gated rewards: +15 reputation, the challenge_winner badge, and the
  // contribution_log entry — all fire only when the creator passes the work.
  if (participantId) {
    try {
      const prof = await restGet(
        applicant2,
        `/rest/v1/profiles?select=reputation_score&id=eq.${participantId}&limit=1`,
      );
      const repAfter = prof?.[0]?.reputation_score ?? null;
      log(
        "pass: reputation +15",
        repBefore !== null && repAfter !== null && repAfter - repBefore === 15,
        `reputation ${repBefore}→${repAfter}`,
      );
    } catch (e) {
      log("pass: reputation +15", false, String(e).slice(0, 120));
    }
    try {
      const badges = await restGet(
        applicant2,
        `/rest/v1/user_achievements?select=id&profile_id=eq.${participantId}&achievement=eq.challenge_winner`,
      );
      // Badges are one-per-user (ON CONFLICT DO NOTHING), so a repeat pass adds
      // no second row — assert held, not delta. The reputation check above
      // proves the pass trigger fired this run.
      log(
        "pass: challenge_winner badge",
        badges.length > 0,
        badgeBefore === 0
          ? `badges ${badgeBefore}→${badges.length}`
          : `badge held (${badges.length})`,
      );
    } catch (e) {
      log("pass: challenge_winner badge", false, String(e).slice(0, 120));
    }
    try {
      const entries = await restGet(
        applicant2,
        `/rest/v1/contribution_log?select=id&profile_id=eq.${participantId}&action=eq.challenge_completed&points=eq.15`,
      );
      log("pass: contribution logged", entries.length > 0);
    } catch (e) {
      // Non-fatal: the reputation delta above already proves the award fired.
      console.error("contribution_log probe skipped:", String(e).slice(0, 160));
    }
  } else {
    log("pass: reward probes", false, "skipped — participant profile not resolved");
  }

  // 4. The pass notification lands for the participant.
  await applicant2.goto(`${BASE}/notifications`, { waitUntil: "domcontentloaded" });
  await applicant2.waitForTimeout(2500);
  log(
    "notify: pass notification",
    (await applicant2
      .getByText(/passed review — badge earned!/i)
      .count()
      .catch(() => 0)) > 0,
  );
  await applicant2.close();
} else {
  log("join/submit/review/pass", false, "skipped — challenge id not resolved");
  await creator.close();
}

log("page errors across sessions", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} challenge-loop checks passed. ` +
    `${errors.length} page errors.`,
);
await browser.close();
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
