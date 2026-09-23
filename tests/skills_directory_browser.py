#!/usr/bin/env python3
"""Browser verification for the /skills directory route.

Checks (public unless noted):
  1. Directory hydrates with real catalog data (categories + skill links)
  2. Real activity lines render on skill rows (sharing · growing · projects)
  3. Search narrows the list, syncs the ?q= URL, and clears back to full
  4. A skill link navigates to its /skills/:slug hub (h1 = skill name)
  5. Signed in: the sidebar "Skills" nav link lands on the directory and
     the sidebar frame persists on it
  6. Section chrome: no top navigation, standard Back button on directory
     and hub

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
            page.wait_for_selector("h1", timeout=15000)
            h1 = page.locator("h1").first.inner_text().strip()
            if h1 != "Skills":
                all_ok = fail(f"expected h1 'Skills', got {h1!r}")
            else:
                all_ok = ok("h1 'Skills' renders") and all_ok
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
            # Section chrome: sidebar frame + Back, no marketing top nav.
            if page.locator('nav[aria-label="Primary navigation"]').count() != 0:
                all_ok = fail("top navigation still renders on /skills")
            else:
                all_ok = ok("top navigation removed from /skills") and all_ok
            back = page.get_by_role("button", name="Go back")
            if back.count() == 0:
                all_ok = fail("no Back button in the section frame header")
            else:
                all_ok = ok("Back button renders in the frame header") and all_ok
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL: hydration: {exc}")
            return 1

        # ── 2. Real activity lines on skill rows ───────────────────────
        print("[2] activity lines")
        try:
            lines = page.locator('a[href^="/skills/"] p:has-text("sharing")').all_inner_texts()
            meaningful = [t for t in lines if re.search(r"\d", t)]
            if not meaningful:
                all_ok = fail("no real activity rendered (expected 'N sharing · …')")
            else:
                all_ok = ok(f"activity renders, e.g. {meaningful[0]!r}") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"activity lines: {exc}") and all_ok

        # ── 3. Search narrows, syncs the URL, and clears ───────────────
        print("[3] search filter")
        try:
            before = page.locator('a[href^="/skills/"]').count()
            page.fill("input[type=search]", "zzzznomatch")
            page.wait_for_timeout(400)
            # The trending rail stays put (it ranks the full catalog); the
            # directory below must empty out.
            narrowed = page.locator(
                'section[aria-labelledby^="skills-"] a[href^="/skills/"]'
            ).count()
            if narrowed != 0:
                all_ok = fail(f"expected 0 directory links for a nonsense query, got {narrowed}")
            elif not page.get_by_text("No skills match that search").is_visible():
                all_ok = fail("empty-state message not shown for nonsense query")
            else:
                all_ok = ok("nonsense query empties the directory (trending stays)") and all_ok
            if "q=zzzznomatch" not in page.url:
                all_ok = fail(f"search did not sync ?q= into the URL ({page.url})")
            else:
                all_ok = ok("?q= param syncs into the URL") and all_ok
            # Custom clear button restores the full list.
            page.click("button[aria-label='Clear search']")
            page.wait_for_timeout(400)
            after = page.locator('a[href^="/skills/"]').count()
            if after != before:
                all_ok = fail(f"clearing search restored {after} links, expected {before}")
            else:
                all_ok = ok("clear button restores the full list") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"search: {exc}") and all_ok

        # ── 4. Skill link navigates to the hub page ────────────────────
        print("[4] skill link → hub page")
        try:
            first = page.locator('a[href^="/skills/"]').first
            href = first.get_attribute("href") or ""
            first.click()
            page.wait_for_url(f"**{href}*", timeout=15000)
            page.wait_for_timeout(4000)  # hydration of the hub page
            main_visible = page.locator("main").count() > 0
            hub_h1 = page.locator("h1").first.inner_text().strip()
            if not main_visible:
                all_ok = fail(f"{href} did not render a page")
            elif hub_h1 == "Skills":
                all_ok = fail(f"hub h1 is the directory title, expected the skill name")
            else:
                all_ok = ok(f"navigated to {href} (h1: {hub_h1!r})") and all_ok
            tab_text = page.locator("main").inner_text()
            if "Sharing" not in tab_text or "Growing" not in tab_text:
                all_ok = fail("hub has no Sharing/Growing copy (stats summary)")
            else:
                all_ok = ok("hub renders Sharing/Growing stats summary") and all_ok
            if page.get_by_role("button", name="Go back").count() == 0:
                all_ok = fail("hub has no Back button in the section frame header")
            else:
                all_ok = ok("hub renders the standard Back button") and all_ok
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
                    page.wait_for_selector("h1", timeout=15000)
                    h1 = page.locator("h1").first.inner_text().strip()
                    if h1 != "Skills":
                        all_ok = fail(f"sidebar lands on directory, h1 {h1!r}")
                    else:
                        all_ok = ok("sidebar Skills link lands on the directory") and all_ok
                    # The frame keeps the sidebar visible on /skills itself —
                    # the app chrome never changes under the user's hands.
                    # useAuthUser resolves after hydration, so wait for the
                    # authed sidebar to replace the visitor one.
                    page.wait_for_selector('a[href="/dashboard"]', timeout=10000)
                    if page.locator('a[href="/dashboard"]').count() == 0:
                        all_ok = fail("sidebar frame missing after landing on /skills")
                    else:
                        all_ok = ok("sidebar frame persists on /skills (authed)") and all_ok
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"sidebar: {exc}") and all_ok

        browser.close()

    print("ALL CHECKS PASSED" if all_ok else "CHECKS FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())