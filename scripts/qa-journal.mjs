// Dev journal click-through: log from the dock, share/unshare, standup copy,
// /journal page (entries, brag doc, token + setup snippet), the token works
// against the API and MCP, the weekly ship drafts from the journal, phone.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = "qa-artifacts/journal";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
page.on("dialog", (d) => d.accept());

async function login() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForTimeout(1000);
    await page.fill("#email", "maya@tethyr.dev");
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

await login();
const stamp = `QA ${Date.now()}`;

// Dock → Log
const dock = page.getByRole("region", { name: "Notes" });
await page.getByRole("button", { name: "Notes", exact: true }).click();
await dock.getByRole("tab", { name: "Log" }).click();
await page.waitForTimeout(800);
await dock.getByRole("radio", { name: "Fixed" }).click();
await dock.getByLabel(/Fixed — one line/).fill(`the flaky upload test ${stamp}`);
await dock.getByRole("button", { name: "Log", exact: true }).click();
await page.waitForTimeout(1500);
log(
  "dock: logged entry shows",
  (await dock.getByText(`the flaky upload test ${stamp}`).count()) === 1,
);
await page.screenshot({ path: `${OUT}/dock-log.png` });

await dock.getByRole("button", { name: "Copy my standup" }).click();
await page.waitForTimeout(600);
const clip = await page.evaluate(() => navigator.clipboard.readText());
log(
  "dock: standup copied",
  clip.startsWith("Yesterday") && clip.includes(stamp),
  clip.slice(0, 60),
);

// Journal page
await dock.getByRole("link", { name: /Brag doc & connect tools/ }).click();
await page.waitForURL(/journal/);
await page.waitForTimeout(2000);
log(
  "journal: page heading",
  (await page.getByRole("heading", { name: "Dev journal" }).count()) === 1,
);
const row = page.locator("li", { hasText: `the flaky upload test ${stamp}` });
log("journal: entry listed", (await row.count()) === 1);
await row.hover();
await row.getByRole("button", { name: "Show on your profile" }).click();
await page.waitForTimeout(1200);
log(
  "journal: share toggles",
  (await page.locator("li", { hasText: stamp }).getByText("on your profile").count()) === 1,
);
const brag = await page.locator("pre").filter({ hasText: "# Brag doc" }).innerText();
log("journal: brag doc includes it", brag.includes(stamp));
log(
  "journal: shows tool entries (via …)",
  (await page.getByText(/via (Claude Code|git|API)/).count()) > 0,
);

// Token + snippet
await page.getByLabel("Token name").fill(`QA laptop ${stamp}`);
await page.getByRole("button", { name: "Create token" }).click();
await page.waitForTimeout(1500);
const token = (await page.locator("code").filter({ hasText: /^tth_/ }).first().innerText()).trim();
log("token: shown once", /^tth_[A-Za-z0-9_-]{43}$/.test(token));
const snippet = await page.locator("pre").filter({ hasText: "claude mcp add" }).innerText();
log(
  "token: filled into Claude Code setup",
  snippet.includes(token) && snippet.includes("/api/mcp"),
);
await page.getByRole("tab", { name: "Git hook (any host)" }).click();
log(
  "setup: git hook snippet",
  (await page.locator("pre").filter({ hasText: "post-commit" }).count()) +
    (await page.locator("pre").filter({ hasText: "text/plain" }).count()) >
    0,
);
await page.screenshot({ path: `${OUT}/journal.png`, fullPage: true });

// The new token works
const api = await page.evaluate(
  async ({ base, token }) => {
    const r = await fetch(`${base}/api/mcp?client=cursor`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "log_progress",
          arguments: { summary: "Logged from QA via MCP", kind: "learned" },
        },
      }),
    });
    return { status: r.status, body: await r.text() };
  },
  { base: BASE, token },
);
log(
  "token: MCP log_progress works",
  api.status === 200 && api.body.includes("Logged to Tethyr"),
  api.body.slice(0, 80),
);

// Ship draft from the journal
await page.goto(`${BASE}/ships`, { waitUntil: "load" });
await page.waitForTimeout(2000);
const del = page.getByRole("button", { name: "Delete this week's ship" });
if (await del.count()) {
  await del.click();
  await page.waitForTimeout(1500);
}
await page.getByRole("button", { name: "Draft my week" }).click();
await page.waitForTimeout(4000);
const draft = await page.getByLabel("What you shipped").inputValue();
log(
  "ship: drafted from the journal",
  draft.includes(stamp) && draft.startsWith("This week I:"),
  draft.slice(0, 80),
);
await page.screenshot({ path: `${OUT}/ship-draft.png` });

// Revoke the QA token, clean up the entry
await page.goto(`${BASE}/journal`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: `Revoke QA laptop ${stamp}` }).click();
await page.waitForTimeout(1200);
const after = await page.evaluate(
  async ({ base, token }) =>
    (await fetch(`${base}/api/journal`, { headers: { authorization: `Bearer ${token}` } })).status,
  { base: BASE, token },
);
log("token: revoked token is refused", after === 401, `status=${after}`);
for (const text of [stamp, "Logged from QA via MCP"]) {
  const r = page.locator("li", { hasText: text }).first();
  if (await r.count()) {
    await r.hover();
    await r.getByRole("button", { name: "Delete entry" }).click();
    await page.waitForTimeout(1000);
  }
}

// Phone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
log("phone: journal has no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
await page.screenshot({ path: `${OUT}/phone.png`, fullPage: true });

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
