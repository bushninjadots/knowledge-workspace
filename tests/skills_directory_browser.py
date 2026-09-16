#!/usr/bin/env python3
"""Browser verification for the /skills directory route.

Checks (public unless noted):
  1. Directory hydrates with real catalog data (categories + skill links)
  2. Profile-count pills render next to skills
  3. Search filter narrows the list and clears back to full results
  4. A skill link navigates to its /skills/:slug hub
  5. Signed in: the sidebar "Skills" nav link lands on the directory

Usage:
    python3 tests/skills_directory_browser.py [BASE_URL]
Exits 0 when every check passes, 1 otherwise.
"""

import os
import re
import sys

from playwright.sync_api import sync_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TETHYR_BASE_URL", "http://localhost:3000")).rstrip("/")
EMAIL = os.environ.get("SMOKE_EMAIL", "test@tethyr.com")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "password123")


def fail(msg):
    print(f"  FAIL: {msg}")
    return False


def ok(msg):
    print(f"  ok: {msg}")
    return True


def main() -> int:
    all_ok = True

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # ── 1. Directory hydrates with real catalog data ───────────────
        print("[1] directory hydration")
        try:
            page.goto(f"{BASE_URL}/skills", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("h1:has-text('Skills directory')", timeout=15000)
            # SSR paints a skeleton; the client fills in sections after hydration.
            page.wait_for_selector("section h2", timeout=20000)
            categories = page.locator("section h2").all_inner_texts()
            if not categories:
                all_ok = fail("no category sections rendered")
            else:
                all_ok = ok(f"categories: {', '.join(categories[:4])}…") and all_ok
            link_count = page.locator('a[href^="/skills/"]').count()
            if link_count == 0:
                all_ok = fail("no skill links rendered")
            else:
                all_ok = ok(f"{link_count} skill links") and all_ok
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL: hydration: {exc}")
            return 1

        # ── 2. Profile-count pills ─────────────────────────────────────
        print("[2] profile-count pills")
        try:
            pills = page.locator("section li span.rounded-full").all_inner_texts()
            meaningful = [t for t in pills if re.search(r"\d", t)]
            if not meaningful:
                all_ok = fail("no numeric profile counts rendered")
            else:
                all_ok = ok(f"counts render, e.g. {meaningful[0]!r}") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"count pills: {exc}") and all_ok

        # ── 3. Search narrows and clears ───────────────────────────────
        print("[3] search filter")
        try:
            before = page.locator('a[href^="/skills/"]').count()
            page.fill("input[type=search]", "zzzznomatch")
            page.wait_for_timeout(400)
            narrowed = page.locator('a[href^="/skills/"]').count()
            if narrowed != 0:
                all_ok = fail(f"expected 0 links for a nonsense query, got {narrowed}")
            elif not page.get_by_text("No skills match that search").is_visible():
                all_ok = fail("empty-state message not shown for nonsense query")
            else:
                all_ok = ok("nonsense query shows empty state") and all_ok
            page.fill("input[type=search]", "")
            page.wait_for_timeout(400)
            after = page.locator('a[href^="/skills/"]').count()
            if after != before:
                all_ok = fail(f"clearing search restored {after} links, expected {before}")
            else:
                all_ok = ok("clearing search restores the full list") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"search: {exc}") and all_ok

        # ── 4. Skill link navigates to the hub page ────────────────────
        print("[4] skill link → hub page")
        try:
            first = page.locator('a[href^="/skills/"]').first
            href = first.get_attribute("href") or ""
            first.click()
            page.wait_for_url(f"**{href}*", timeout=15000)
            page.wait_for_timeout(3000)  # hydration of the hub page
            main_visible = page.locator("main").count() > 0
            if not main_visible:
                all_ok = fail(f"{href} did not render a page")
            else:
                all_ok = ok(f"navigated to {href}") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"hub navigation: {exc}") and all_ok

        # ── 5. Sidebar link (authenticated shell) ──────────────────────
        print("[5] sidebar Skills link")
        try:
            page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("#email", timeout=30000)
            page.wait_for_timeout(6000)  # hydration
            page.fill("#email", EMAIL)
            page.fill("#password", PASSWORD)
            page.click("button[type=submit]")
            page.wait_for_timeout(5000)
            if "/dashboard" not in page.url:
                all_ok = fail(f"login: expected /dashboard, got {page.url}")
            else:
                sidebar_link = page.locator('a[href="/skills"]').first
                if sidebar_link.count() == 0:
                    all_ok = fail("sidebar has no /skills link")
                else:
                    sidebar_link.click()
                    page.wait_for_url("**/skills", timeout=15000)
                    page.wait_for_selector("h1:has-text('Skills directory')", timeout=15000)
                    all_ok = ok("sidebar Skills link lands on the directory") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"sidebar: {exc}") and all_ok

        browser.close()

    print("ALL CHECKS PASSED" if all_ok else "CHECKS FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
