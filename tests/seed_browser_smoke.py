#!/usr/bin/env python3
"""Browser smoke test for the seeded demo data.

Verifies that the mock community added by `supabase/seed_demo.sql` actually
renders after login, so seed regressions are caught in a real browser instead
of only in SQL.

Requirements / run order:
  1. A running local Supabase with the demo seed applied:
       npx supabase db reset        # runs seed.sql + seed_demo.sql
  2. A running dev server:
       npm run dev                  # prints the local URL (e.g. :8081)
  3. Python Playwright with Chromium installed:
       pip install playwright && playwright install chromium

Usage:
    python3 tests/seed_browser_smoke.py [BASE_URL]
    # e.g.  python3 tests/seed_browser_smoke.py http://localhost:8081

Credentials default to the canonical test user; override via env:
    SMOKE_EMAIL / SMOKE_PASSWORD

Exits 0 when every check passes, 1 otherwise.
"""

import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TETHYR_BASE_URL", "http://localhost:8081")).rstrip("/")
EMAIL = os.environ.get("SMOKE_EMAIL", "test@tethyr.com")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "password123")

# Each entry is (name, path, [required substrings]). A page passes only if all
# substrings are present in its rendered text.
# Notes on the needles:
#   - Explore renders projects as a one-at-a-time carousel (the "project shelf"),
#     so a specific title isn't guaranteed to be the active card. We assert the
#     stable shelf chrome + that a real project page renders instead.
#   - Sessions are scoped to the signed-in user's own sessions (organizer or
#     participant), so we only assert the two the test user belongs to.
CHECKS = [
    ("dashboard", "/dashboard", ["Explore", "Projects"]),
    ("explore", "/explore", ["Projects", "Create project"]),
    ("community (spaces)", "/community?nav=communities", ["Design Guild", "Studio Core", "Music Makers"]),
    ("studio", "/profile", ["Studio Starter", "Your Studio"]),
    ("challenges", "/challenges", ["Build a portfolio homepage in a weekend", "rate-limited REST API"]),
    ("sessions", "/sessions", ["Atlas weekly sync", "Design critique"]),
    ("project page", "/projects/20000000-0000-0000-0000-000000000001", ["Atlas", "README", "People"]),
]


def main() -> int:
    failures = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        # Log in. The dev server SSR's the form, so give React time to hydrate
        # before interacting, otherwise the submit falls through to a native GET.
        try:
            page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("#email", timeout=30000)
            page.wait_for_timeout(6000)
            page.fill("#email", EMAIL)
            page.fill("#password", PASSWORD)
            page.click("button[type=submit]")
            page.wait_for_timeout(5000)
            if "/dashboard" not in page.url:
                failures.append(("login", f"expected /dashboard, got {page.url}"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("login", str(exc)[:120]))

        for name, path, needles in CHECKS:
            try:
                page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(4000)
                body = page.inner_text("body")
                missing = [n for n in needles if n not in body]
                if missing:
                    failures.append((name, f"missing: {missing}"))
            except Exception as exc:  # noqa: BLE001
                failures.append((name, str(exc)[:120]))

        # Responsive navigation regression: mobile pages must expose their own
        # feature navigation without adding a second fixed global bar.
        mobile = page.context.new_page(viewport={"width": 390, "height": 844})
        try:
            mobile.goto(f"{BASE_URL}/community", wait_until="domcontentloaded", timeout=30000)
            mobile.wait_for_timeout(2500)
            community_nav = mobile.locator('nav[aria-label="Community navigation"]')
            if community_nav.count() != 1 or not community_nav.first.is_visible():
                failures.append(("mobile-community-nav", "expected one visible community-local navigation"))

            mobile.goto(f"{BASE_URL}/sessions", wait_until="domcontentloaded", timeout=30000)
            mobile.wait_for_timeout(2500)
            if not mobile.get_by_role("button", name="Calendar", exact=True).is_visible():
                failures.append(("mobile-sessions-nav", "session tabs are not reachable on mobile"))

            mobile.goto(f"{BASE_URL}/library", wait_until="domcontentloaded", timeout=30000)
            mobile.wait_for_timeout(2500)
            if not mobile.get_by_role("button", name="Browse library", exact=True).is_visible():
                failures.append(("mobile-library-nav", "library browse control is not reachable on mobile"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("mobile-navigation", str(exc)[:120]))
        finally:
            mobile.close()

        # Crew creation (interactive): form a crew on the studio and confirm it
        # lands on the new team page with the creator seated as lead.
        crew_name = f"Crew {int(time.time() * 1000) % 1000000}"
        try:
            page.goto(f"{BASE_URL}/profile", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)
            page.get_by_role("button", name="Form a crew").first.click()
            page.wait_for_timeout(600)
            page.get_by_placeholder("Crew name").fill(crew_name)
            page.get_by_role("button", name="Create", exact=True).click()
            page.wait_for_timeout(4000)
            if "/teams/" not in page.url:
                failures.append(("crew-create", f"expected /teams/..., got {page.url}"))
            else:
                body = page.inner_text("body")
                if crew_name not in body:
                    failures.append(("crew-create", f"missing crew name {crew_name!r}"))
                if "Manage crew" not in body:
                    failures.append(("crew-create", "missing 'Manage crew' (lead-only section)"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("crew-create", str(exc)[:120]))

        browser.close()

    print(f"Seeded content smoke test — {BASE_URL}")
    if failures:
        for name, reason in failures:
            print(f"  FAIL  {name}: {reason}")
        print(f"{len(failures)} check(s) failed")
        return 1

    print(f"  PASS  all {len(CHECKS) + 2} checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
