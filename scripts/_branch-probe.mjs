// Which branch of the public profile route actually rendered: the published
// Studio (PageShell + blocks) or the BasicProfile fallback? The two must never
// both be on the page, and the fallback must not appear for a Studio that has
// real sections.
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const handles = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const handle of handles) {
  await page.goto(`${BASE}/u/${handle}`, { waitUntil: "domcontentloaded" });
  // Wait for BOTH loading phases to clear: the profile row, then the page
  // query that decides published-Studio vs fallback. Sampling during the
  // skeleton reports a false "fallback" for every profile.
  await page
    .waitForFunction(() => !document.querySelector('div[aria-hidden="true"]'), { timeout: 15000 })
    .catch(() => {});
  await page
    .waitForFunction(
      () => {
        const w = document.querySelector('section[aria-label="Work"]');
        return !w || w.querySelectorAll("li").length > 0;
      },
      { timeout: 15000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const studioBlocks = document.querySelectorAll(".studio-block").length;
    const work = document.querySelector('section[aria-label="Work"]');
    return {
      studioBlocks,
      fallbackWork: !!work,
      // The fallback's identity block is centred; the Studio's is not. A cheap
      // but reliable discriminator when block counts are 0.
      centredIdentity: !!document.querySelector("h1")?.closest(".text-center"),
      h1: document.querySelector("h1")?.textContent,
    };
  });
  const branch = r.studioBlocks > 0 ? "PUBLISHED STUDIO" : r.fallbackWork ? "fallback" : "fallback (no work)";
  console.log(
    `  ${handle.padEnd(10)} blocks=${String(r.studioBlocks).padStart(2)}  work=${String(r.fallbackWork).padEnd(5)}  → ${branch}`,
  );
}
await browser.close();
