// Two-user project loop click-through: create project → add open role →
// second user applies → owner accepts. Covers the Stage 0 gap flagged in
// docs/TETHYR_IMPLEMENTATION_STAGES.md. Run against a seeded local stack:
//   node scripts/qa-project-loop.mjs
// Optional env: QA_BASE (default http://localhost:3000), SB_KEY (anon key;
// self-served from the dev server when unset).
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
const PROJECT_TITLE = `QA Loop Project ${stamp}`;

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

// ── Owner session: maya ───────────────────────────────────────────────────────
const owner = await newSession();
const ownerErrorsBefore = 0;
await login(owner, "maya@tethyr.dev");

// 1. Create a project via the sidebar button + ProjectDialog.
await owner.getByRole("button", { name: "New project" }).first().click();
await owner.waitForTimeout(600);
const dialog = owner.getByRole("dialog").first();
log("create: dialog opens", await dialog.isVisible().catch(() => false));
await dialog.locator("input[placeholder*='working name']").fill(PROJECT_TITLE);
await dialog.locator("textarea").first().fill("Automated two-user loop test project.");
// The dialog is a 3-step wizard; Publish only renders on the last step.
for (let step = 0; step < 2; step++) {
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await owner.waitForTimeout(800);
}
await dialog.getByRole("button", { name: /publish project/i }).click();
await owner.waitForTimeout(2500);
log(
  "create: no error toast",
  (await owner
    .locator("[data-sonner-toast][data-type=error]")
    .count()
    .catch(() => 0)) === 0,
);

// Resolve the new project's id for later verification.
let KEY = process.env.SB_KEY;
if (!KEY) {
  KEY = await owner.evaluate(async () => {
    try {
      const src = await fetch("/src/integrations/supabase/client.ts").then((r) => r.text());
      const m = src.match(/VITE_SUPABASE_PUBLISHABLE_KEY"?:\s*"([^"]+)"/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  });
}
let projectId = null;
if (KEY) {
  projectId = await owner.evaluate(
    async ({ KEY, PROJECT_TITLE, SB_REST }) => {
      const tokKey = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.includes("auth-token"),
      );
      const token = tokKey ? JSON.parse(localStorage.getItem(tokKey))?.access_token : null;
      const r = await fetch(
        `${SB_REST}/rest/v1/projects?select=id,title,profile_id&title=eq.${encodeURIComponent(PROJECT_TITLE)}`,
        { headers: { apikey: KEY, Authorization: `Bearer ${token}` } },
      );
      const j = await r.json();
      return j?.[0]?.id ?? null;
    },
    { KEY, PROJECT_TITLE, SB_REST },
  );
}
log("create: project persisted", !!projectId, projectId ?? PROJECT_TITLE);

// 2. Add an open role on the project page's People section.
if (projectId) {
  await owner.goto(`${BASE}/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector("#project-people", { timeout: 20000 });
  await owner.waitForTimeout(1000);
  // Scope to the People section: a page-wide /^add$/i also matches the Needs
  // section's Add button higher up the page.
  const people = owner.locator("#project-people");
  const addRole = people.getByRole("button", { name: /^add$/i }).first();
  if (await addRole.isVisible().catch(() => false)) {
    await addRole.click();
    await owner.getByLabel("Role title").fill("QA Tester");
    await owner.getByLabel("Skills needed").fill("playwright, testing");
    await owner.getByRole("button", { name: /save role/i }).click();
    await owner.waitForTimeout(1500);
    log(
      "role: created",
      (await people
        .getByText("QA Tester", { exact: true })
        .count()
        .catch(() => 0)) > 0,
    );
  } else {
    log("role: created", false, "Add button not visible (not owner?)");
  }

  // Capture a role application state marker for the owner later: count pending.
  // Applications carry role_id (not project_id), so filter through the FK embed.
  const pendingBefore = await owner
    .evaluate(
      async ({ KEY, projectId, SB_REST }) => {
        const tokKey = Object.keys(localStorage).find(
          (k) => k.startsWith("sb-") && k.includes("auth-token"),
        );
        const token = tokKey ? JSON.parse(localStorage.getItem(tokKey))?.access_token : null;
        const r = await fetch(
          `${SB_REST}/rest/v1/project_role_applications?select=id,project_open_roles!inner(project_id)&project_open_roles.project_id=eq.${projectId}&status=eq.pending`,
          { headers: { apikey: KEY, Authorization: `Bearer ${token}` } },
        );
        if (!r.ok) throw new Error(`rest ${r.status}: ${await r.text()}`);
        return (await r.json()).length;
      },
      { KEY, projectId, SB_REST },
    )
    .catch((e) => {
      console.error("pendingBefore probe failed:", String(e).slice(0, 200));
      return 0;
    });

  await owner.close();

  // ── Applicant session: devon ────────────────────────────────────────────────
  const applicant = await newSession();
  await login(applicant, "devon@tethyr.dev");
  await applicant.goto(`${BASE}/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  await applicant.waitForSelector("#project-people", { timeout: 20000 });
  await applicant.waitForTimeout(1000);
  await applicant
    .locator("#project-people")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  const applicantPeople = applicant.locator("#project-people");

  // 3. Apply to the role.
  const applyBtn = applicantPeople.getByRole("button", { name: /^apply$/i }).first();
  if (await applyBtn.isVisible().catch(() => false)) {
    await applyBtn.click();
    await applicant
      .getByLabel("Application message")
      .fill("I run the QA harness that is testing this very flow.");
    await applicant.getByRole("button", { name: /submit application/i }).click();
    await applicant.waitForTimeout(2000);
    log(
      "apply: submitted (pending chip)",
      (await applicantPeople
        .getByText(/application pending/i)
        .count()
        .catch(() => 0)) > 0,
    );
  } else {
    log("apply: submitted (pending chip)", false, "Apply button not visible");
  }
  await applicant.close();

  // ── Owner accepts ───────────────────────────────────────────────────────────
  const owner2 = await newSession();
  await login(owner2, "maya@tethyr.dev");
  await owner2.goto(`${BASE}/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  await owner2.waitForSelector("#project-people", { timeout: 20000 });
  await owner2.waitForTimeout(1000);
  await owner2
    .locator("#project-people")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  const owner2People = owner2.locator("#project-people");
  const acceptBtn = owner2People.getByRole("button", { name: /^accept$/i }).first();
  if (await acceptBtn.isVisible().catch(() => false)) {
    await acceptBtn.click();
    await owner2.waitForTimeout(2000);
    const pendingAfter = await owner2
      .evaluate(
        async ({ KEY, projectId, SB_REST }) => {
          const tokKey = Object.keys(localStorage).find(
            (k) => k.startsWith("sb-") && k.includes("auth-token"),
          );
          const token = tokKey ? JSON.parse(localStorage.getItem(tokKey))?.access_token : null;
          const r = await fetch(
            `${SB_REST}/rest/v1/project_role_applications?select=id,project_open_roles!inner(project_id)&project_open_roles.project_id=eq.${projectId}&status=eq.pending`,
            { headers: { apikey: KEY, Authorization: `Bearer ${token}` } },
          );
          if (!r.ok) throw new Error(`rest ${r.status}: ${await r.text()}`);
          return (await r.json()).length;
        },
        { KEY, projectId, SB_REST },
      )
      .catch((e) => {
        console.error("pendingAfter probe failed:", String(e).slice(0, 200));
        return -1;
      });
    log(
      "accept: application accepted",
      pendingAfter === 0,
      `pending ${pendingBefore}→${pendingAfter}`,
    );
  } else {
    log("accept: application accepted", false, "Accept button not visible (application missing?)");
  }
  await owner2.close();

  // 4. Applicant should now see the accepted state.
  const applicant2 = await newSession();
  await login(applicant2, "devon@tethyr.dev");
  await applicant2.goto(`${BASE}/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  await applicant2.waitForSelector("#project-people", { timeout: 20000 });
  await applicant2.waitForTimeout(1000);
  await applicant2
    .locator("#project-people")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  const applicant2People = applicant2.locator("#project-people");
  // 4. Applicant should now see themselves as a contributor: accepting fills the
  // role (it leaves the unfilled list), so the chip check would never pass.
  log(
    "apply: applicant listed as contributor",
    (await applicant2People
      .getByText("Devon Okafor")
      .count()
      .catch(() => 0)) > 0,
  );
  await applicant2.close();
} else {
  log("role/apply/accept", false, "skipped — project id not resolved");
}

await owner.close();
log("page errors across sessions", errors.length === 0, errors.slice(0, 2).join(" | "));
console.log(
  `\n${results.filter((r) => r.ok).length}/${results.length} project-loop checks passed. ` +
    `${errors.length} page errors.`,
);
await browser.close();
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1);
