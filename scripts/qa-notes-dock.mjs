// Notes dock click-through: jot a note, edit it, upload a picture, preview,
// delete, Messages/Notes take turns, phone sheet, hidden on /library.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = "qa-artifacts/notes-dock";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
};
// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
const dock = page.getByRole("region", { name: "Notes" });
const stamp = `QA note ${Date.now()}`;

await page.getByRole("button", { name: "Notes", exact: true }).click();
log("dock opens", await dock.isVisible());

// Jot
await dock.getByLabel("New note").fill(`${stamp}\nFirst idea\nSecond line`);
await dock.getByRole("button", { name: "Save note" }).click();
await page.waitForTimeout(1500);
const row = dock.getByRole("button", { name: new RegExp(stamp) });
log("note appears in the list", (await row.count()) === 1);
await page.screenshot({ path: `${OUT}/list.png` });

// Edit
await row.click();
await page.waitForTimeout(2500);
const editor = dock.locator(".ProseMirror");
log("note opens in the editor", (await editor.count()) === 1);
await editor.click();
await page.keyboard.press("End");
await page.keyboard.type(" — edited in the dock");
await page.waitForTimeout(2000);
log("autosaves", (await dock.getByText("Saved").count()) === 1);
await page.screenshot({ path: `${OUT}/note.png` });
await dock.getByRole("button", { name: "Back to notes" }).click();
await page.waitForTimeout(1200);
log("edit shows in the list", (await dock.getByText(/edited in the dock/).count()) > 0);

// Upload
await dock.locator('input[type="file"]').setInputFiles({
  name: "qa-dock-pixel.png",
  mimeType: "image/png",
  buffer: PNG,
});
await page.waitForTimeout(3000);
const fileRow = dock.getByRole("button", { name: /qa-dock-pixel\.png/ });
log("uploaded picture appears", (await fileRow.count()) >= 1);
await fileRow.first().click();
await page.waitForTimeout(2000);
log("picture previews", (await dock.locator("img[alt='qa-dock-pixel.png']").count()) === 1);
log("download offered", (await dock.getByRole("button", { name: "Download" }).count()) === 1);
await page.screenshot({ path: `${OUT}/file.png` });
await dock.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(1500);

// Delete the note
await dock.getByRole("button", { name: new RegExp(stamp) }).click();
await page.waitForTimeout(1500);
await dock.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(1500);
log("note deleted", (await dock.getByRole("button", { name: new RegExp(stamp) }).count()) === 0);

// Save a link (paste → "Save link"), with a note under it
await dock
  .getByLabel("New note")
  .fill("https://example.com/qa-docs\nread this before the refactor");
log(
  "pasting a link offers Save link",
  (await dock.getByRole("button", { name: "Save link" }).count()) === 1,
);
await dock.getByRole("button", { name: "Save link" }).click();
await page.waitForTimeout(9000);
await dock.getByRole("button", { name: "links" }).click();
await page.waitForTimeout(600);
const linkRow = dock.getByRole("button", { name: /example\.com/ }).first();
log("link appears under Links", (await linkRow.count()) === 1);
await linkRow.click();
await page.waitForTimeout(1500);
log(
  "link opens with its note",
  (await dock.getByText("read this before the refactor").count()) > 0,
);
log("open link offered", (await dock.getByRole("link", { name: /open link/i }).count()) === 1);
await page.screenshot({ path: `${OUT}/link.png` });
await dock.getByRole("button", { name: "Delete" }).click();
await page.waitForTimeout(1500);
await dock.getByRole("button", { name: "all" }).click();

// Messages and Notes take turns
await page.getByRole("button", { name: /^Messages/ }).click();
await page.waitForTimeout(600);
log("opening Messages closes Notes", !(await dock.isVisible()));
await page.getByRole("button", { name: "Notes", exact: true }).click();
await page.waitForTimeout(600);
log(
  "opening Notes closes Messages",
  !(await page
    .getByRole("region", { name: "Messages" })
    .isVisible()
    .catch(() => false)),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
log("Escape closes", !(await dock.isVisible()));

// Hidden on the Library itself
await page.goto(`${BASE}/library`, { waitUntil: "load" });
await page.waitForTimeout(1500);
log(
  "no dock launcher on /library",
  (await page.getByRole("button", { name: "Notes", exact: true }).count()) === 0,
);

// Phone
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Open more navigation" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Notes", exact: true }).click();
await page.waitForTimeout(1000);
log("phone: Notes opens from More", await dock.isVisible());
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
log("phone: no sideways scroll", overflow <= 0, `overflow=${overflow}px`);
await page.screenshot({ path: `${OUT}/phone.png` });

log("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
