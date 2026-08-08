const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/home/bender/.local/bin/google-chrome",
    headless: true,
  });
  const page = await browser.newPage();

  try {
    console.log("Navigating to login...");
    await page.goto("http://localhost:8081/login", { waitUntil: "networkidle" });

    console.log("Filling login form...");
    await page.fill("#email", "test@tethyr.com");
    await page.fill("#password", "password123");

    console.log("Clicking submit...");
    await page.click('button[type="submit"]');

    console.log("Waiting 5 seconds...");
    await page.waitForTimeout(5000);

    const urlAfterLogin = page.url();
    console.log("URL after login:", urlAfterLogin);

    // Check for error toast
    const errorToast = await page.evaluate(() => {
      const el = document.querySelector(
        '[role="status"], [role="alert"], .toast, [data-sonarticker], [data-radix-toast-viewport] *, .text-red-500, .bg-red-500',
      );
      return el ? el.innerText : null;
    });
    console.log("Error toast / message:", errorToast);

    console.log("Navigating to /community...");
    await page.goto("http://localhost:8081/community", { waitUntil: "networkidle" });

    console.log("Waiting 8 seconds...");
    await page.waitForTimeout(8000);

    // Evaluate community page requirements
    const data = await page.evaluate(() => {
      // (a) left sidebar group headers and items under 'Post types'
      // Let's inspect sidebar elements
      const navElements = Array.from(
        querySelectorAll_safe(
          'nav a, nav button, nav span, aside a, aside button, aside span, div[class*="sidebar"] *',
        ),
      );

      function querySelectorAll_safe(sel) {
        try {
          return document.querySelectorAll(sel);
        } catch (e) {
          return [];
        }
      }

      // Let's get text content of sidebar or nav
      const sidebar =
        document.querySelector("aside") || document.querySelector("nav") || document.body;
      const allText = sidebar.innerText;

      // Group headers: 'Feed', 'Post types', 'Discover', 'You'
      // Items under 'Post types': Showcases, Questions, Tips, Discussions

      // (b) post cards show a colored accent bar on the left edge
      // Check post cards or article elements or cards with left border / accent bar
      const postCards = document.querySelectorAll(
        'article, [class*="card"], [class*="Post"], div[class*="border-l"]',
      );
      const accentBars = Array.from(postCards).map((card) => {
        const style = window.getComputedStyle(card);
        const beforeStyle = window.getComputedStyle(card, "::before");
        return {
          borderLeftWidth: style.borderLeftWidth,
          borderLeftColor: style.borderLeftColor,
          className: card.className,
          hasBefore: beforeStyle.content !== "none",
        };
      });

      // (c) right rail card titles: Today, Trending skills, Your Tethyr
      const rightRail =
        document.querySelector('div[class*="right"], aside:last-of-type, .space-y-6') ||
        document.body;
      const rightRailText = rightRail.innerText;

      // (d) main page heading text
      const heading = document.querySelector("h1");
      const headingText = heading ? heading.innerText : null;

      return {
        sidebarText: allText,
        accentBars,
        rightRailText,
        headingText,
        htmlSnippet: document.body.innerHTML.substring(0, 2000),
      };
    });

    console.log("Community Data:", JSON.stringify(data, null, 2));

    await page.screenshot({ path: "community-screenshot.png", fullPage: true });
    console.log("Screenshot taken successfully.");
  } catch (err) {
    console.error("Error during automation:", err);
  } finally {
    await browser.close();
  }
})();
