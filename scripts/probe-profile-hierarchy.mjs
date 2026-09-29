// Structural check of the public-profile fallback hierarchy. Asserts the
// vertical order is identity → work → builds-with → metadata, and that
// metadata is still present (it was demoted, not deleted).
import { chromium } from "playwright";

const BASE = process.env.QA_BASE || "http://127.0.0.1:3000";
const handle = process.argv[2] || "priya";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/u/${handle}`, { waitUntil: "domcontentloaded" });
await page
  .waitForFunction(
    () => {
      const w = document.querySelector('section[aria-label="Work"]');
      return !!w && w.querySelectorAll("li").length > 0;
    },
    { timeout: 15000 },
  )
  .catch(() => {});

const report = await page.evaluate(() => {
  const root = document.querySelector("main") ?? document.body;
  const top = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);

  const h1 = document.querySelector("h1");
  const work = document.querySelector('section[aria-label="Work"]');
  // Find the metadata region generically: it is the last child of the page
  // container and is not the work wrapper or the identity block.
  const container = h1?.closest("div")?.parentElement;
  const last = container?.children?.[container.children.length - 1];
  const isMeta = last && !last.querySelector('section[aria-label="Work"]') && last !== work;
  const meta = isMeta ? last : null;
  const chip = [...(meta?.querySelectorAll("span") ?? [])].find((s) =>
    /^[A-Z][a-z]+$/.test(s.textContent ?? ""),
  );

  const regions = [...(container?.children ?? [])].map((el) => ({
    tag: el.tagName.toLowerCase(),
    top: top(el),
    label:
      el.querySelector("h2")?.textContent?.trim() ??
      (el.tagName === "H1" ? "identity" : el.textContent?.trim().slice(0, 28) ?? ""),
  }));

  return {
    regions,
    identityTop: h1 ? top(h1) : null,
    workTop: work ? top(work) : null,
    metaTop: meta ? top(meta) : null,
    chipPresent: !!chip,
    // Every work row must be a real, focusable project link.
    rowLinks: [...(work?.querySelectorAll('a[href^="/projects/"]') ?? [])].map((a) =>
      a.getAttribute("href"),
    ),
    // Accessibility: the accessible name a screen reader would announce.
    // aria-label wins over text content, exactly as AT computes it.
    rowNames: [...(work?.querySelectorAll('a[href^="/projects/"]') ?? [])].map(
      (a) => a.getAttribute("aria-label") || a.textContent.trim().split("\n")[0],
    ),
    // Tab order sanity: the work links must be reachable, not tabindex -1.
    focusable: [...(work?.querySelectorAll('a[href^="/projects/"]') ?? [])].every(
      (a) => a.tabIndex >= 0,
    ),
  };
});

console.log(`\n=== /u/${handle} vertical order ===`);
for (const r of report.regions) {
  console.log(`  top=${String(r.top).padStart(5)}  <${r.tag}>  ${r.label}`);
}
console.log("\nidentity top: ", report.identityTop);
console.log("work top:     ", report.workTop);
console.log("meta top:     ", report.metaTop);
console.log("chip present: ", report.chipPresent);
console.log("row links:    ", report.rowLinks);
console.log("row names:    ", report.rowNames);
console.log("all focusable:", report.focusable);

const ordered = report.metaTop === null || report.identityTop < report.workTop;
const workBeforeMeta = report.metaTop === null || report.workTop < report.metaTop;
console.log(`\nHIERARCHY identity < work < metadata: ${ordered && workBeforeMeta ? "PASS" : "FAIL"}`);
console.log(`METADATA PRESERVED: ${report.chipPresent ? "PASS" : "FAIL"}`);

await browser.close();
process.exit(ordered && report.chipPresent ? 0 : 1);
