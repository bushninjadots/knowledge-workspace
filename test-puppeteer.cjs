const puppeteer = require("puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/home/bender/.local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    console.log("Navigating to login...");
    await page.goto("http://localhost:8081/login", { waitUntil: "networkidle" });

    console.log("Filling login form...");
    await page.type("#email", "test@tethyr.com");
    await page.type("#password", "password123");

    console.log("Clicking submit...");
    await page.click('button[type="submit"]');

    console.log("Waiting 5 seconds...");
    await new Promise((r) => setTimeout(r, 5000));

    const urlAfterLogin = page.url();
    console.log("URL after login:", urlAfterLogin);

    const errorToast = await page.evaluate(() => {
      const el = document.querySelector(
        '[role="status"], [role="alert"], .toast, [data-sonner-toaster] *, .text-red-500, .bg-red-500',
      );
      return el ? el.innerText : null;
    });
    console.log("Error toast / message:", errorToast);

    console.log("Navigating to /community...");
    await page.goto("http://localhost:8081/community", { waitUntil: "networkidle" });

    console.log("Waiting 8 seconds...");
    await new Promise((r) => setTimeout(r, 8000));

    const data = await page.evaluate(() => {
      const sidebar =
        document.querySelector("aside") || document.querySelector("nav") || document.body;
      const sidebarText = sidebar ? sidebar.innerText : "";

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

      const rightRail =
        document.querySelector('div[class*="right"], aside:last-of-type, .space-y-6') ||
        document.body;
      const rightRailText = rightRail ? rightRail.innerText : "";

      const heading = document.querySelector("h1");
      const headingText = heading ? heading.innerText : null;

      return {
        sidebarText,
        accentBars,
        rightRailText,
        headingText,
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
