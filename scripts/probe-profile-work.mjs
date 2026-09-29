// Ad-hoc visual probe for the public-profile work evidence (not a shipped
// harness). Renders /u/<handle> in a real browser and reports whether the
// derived work section actually appears, plus its shape at desktop + mobile.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const handle = process.argv[2] || "priya";

const browser = await chromium.launch();

async function inspect(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  await page.goto(`${BASE}/u/${handle}`, { waitUntil: "domcontentloaded" });
  // The work section is a client query, so wait for the rows rather than a
  // fixed delay — otherwise the first (cold) load is caught mid-skeleton and
  // the probe reports a false negative.
  await page
    .waitForFunction(
      () => {
        const w = document.querySelector('section[aria-label="Work"]');
        return !!w && w.querySelectorAll("li").length > 0;
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(500);

  const out = await page.evaluate(() => {
    const work = document.querySelector('section[aria-label="Work"]');
    const rows = work
      ? [...work.querySelectorAll("li a")].map((a) => a.textContent.replace(/\s+/g, " ").trim())
      : null;
    const heads = [...(work?.querySelectorAll("h2") ?? [])].map((h) => h.textContent.trim());
    const arrange = work
      ? [...work.querySelectorAll("a")].some((a) =>
          /Arrange this in your Studio/.test(a.textContent),
        )
      : false;
    return {
      workSection: !!work,
      headings: heads,
      rows,
      arrangeVisible: arrange,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      docHeight: document.documentElement.scrollHeight,
      bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 220),
    };
  });
  await page.screenshot({ path: `qa-artifacts/probe-${handle}-${label}.png`, fullPage: true });
  await page.close();
  return { ...out, errs };
}

const desktop = await inspect(1440, 900, "desktop");
const mobile = await inspect(390, 844, "mobile");

console.log(`\n=== /u/${handle} ===`);
for (const [label, r] of [
  ["desktop 1440", desktop],
  ["mobile 390", mobile],
]) {
  console.log(`\n-- ${label} --`);
  console.log("  work section:   ", r.workSection);
  console.log("  headings:       ", r.headings);
  console.log("  rows:           ", JSON.stringify(r.rows, null, 2));
  console.log("  owner hint:     ", r.arrangeVisible, "(expected false when signed out)");
  console.log("  h-overflow:     ", r.hScroll);
  console.log("  page height:    ", r.docHeight);
  console.log("  errors:         ", r.errs.length ? r.errs : "none");
  console.log("  text:           ", r.bodyText);
}
await browser.close();
