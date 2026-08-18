#!/usr/bin/env python3
"""Two-user browser test for the Tethyr core collaboration loop.

Proves the primary loop transitions actually work end-to-end in a browser,
not just in SQL or unit tests:

    Find people -> Collaborate (apply -> accept -> become a contributor)
    Become known (challenge submit -> review -> pass-gated reputation)
    Notifications land for the applicant
    Private projects stay private

Users (seeded by `supabase/seed.sql` + `supabase/seed_demo.sql`):
    owner     = test@tethyr.com   (owns "Studio Starter", created the challenge)
    applicant = maya@tethyr.dev   (Design craft, applies + joins + submits)

Requirements / run order:
  1. Local Supabase with the demo seed applied:
       npx supabase db reset        # runs seed.sql + seed_demo.sql
  2. A running dev server:
       npm run dev                  # prints the local URL (default :8081)
  3. Python Playwright with Chromium:
       pip install playwright && playwright install chromium

Usage:
    python3 tests/core_loop_browser.py [BASE_URL]
    # e.g.  python3 tests/core_loop_browser.py http://localhost:8081

Credentials override via env:
    OWNER_EMAIL / APPLICANT_EMAIL / PASSWORD
    TETHYR_BASE_URL

Exits 0 when every check passes, 1 otherwise.
"""

import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE_URL = (
    sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TETHYR_BASE_URL", "http://localhost:8081")
).rstrip("/")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "test@tethyr.com")
APPLICANT_EMAIL = os.environ.get("APPLICANT_EMAIL", "maya@tethyr.dev")
PASSWORD = os.environ.get("SMOKE_PASSWORD", "password123")

# Seeded ids from seed_demo.sql — see the "Projects", "Open roles", and
# "Challenges" sections there.
STUDIO_STARTER = "20000000-0000-0000-0000-000000000008"
PORTFOLIO_CHALLENGE = "40000000-0000-0000-0000-000000000004"
PRIVATE_PROJECT = "20000000-0000-0000-0000-000000000009"

APPLICANT_NAME = "Maya Chen"


def login(page, email: str, label: str) -> None:
    """Sign in. The dev server SSR's the form, so let React hydrate first."""
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("#email", timeout=30000)
    page.wait_for_timeout(6000)
    page.fill("#email", email)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_timeout(5000)
    if "/dashboard" not in page.url:
        raise AssertionError(f"{label}: expected /dashboard after login, got {page.url}")


def main() -> int:
    failures = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Two isolated contexts so the owner and applicant are separate users.
        owner_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        applicant_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        owner = owner_ctx.new_page()
        applicant = applicant_ctx.new_page()

        try:
            login(owner, OWNER_EMAIL, "owner")
            login(applicant, APPLICANT_EMAIL, "applicant")
        except Exception as exc:  # noqa: BLE001
            failures.append(("login", str(exc)[:160]))
            browser.close()
            return _report(failures)

        # ---------------------------------------------------------------
        # Loop 1 — apply to an open role, then the owner accepts.
        # ---------------------------------------------------------------
        try:
            applicant.goto(
                f"{BASE_URL}/projects/{STUDIO_STARTER}?tab=people",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            applicant.get_by_role("button", name="Apply").first.click(timeout=30000)
            applicant.get_by_placeholder("Why'd you like to join? (optional)").fill(
                "I'd love to help with the design work."
            )
            applicant.get_by_role("button", name="Submit", exact=True).click()
            applicant.wait_for_timeout(3000)
            body = applicant.inner_text("body")
            if "Application pending" not in body and "Application submitted" not in body:
                failures.append(("apply", "no pending/submitted state after applying"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("apply", str(exc)[:160]))

        try:
            owner.goto(
                f"{BASE_URL}/projects/{STUDIO_STARTER}?tab=people",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            owner.get_by_role("button", name="Accept", exact=True).first.click(timeout=30000)
            owner.wait_for_timeout(3000)
            # Reload to make sure the contributor landed in the People list, not
            # just an optimistic UI flash.
            owner.goto(
                f"{BASE_URL}/projects/{STUDIO_STARTER}?tab=people",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            owner.wait_for_timeout(4000)
            body = owner.inner_text("body")
            if APPLICANT_NAME not in body:
                failures.append(("accept", f"accepted applicant {APPLICANT_NAME!r} not in People"))
            if "Contributor" not in body:
                failures.append(("accept", "accepted applicant missing Contributor role label"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("accept", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Loop 1b — the applicant gets a notification for the acceptance.
        # ---------------------------------------------------------------
        try:
            applicant.goto(f"{BASE_URL}/notifications", wait_until="domcontentloaded", timeout=30000)
            applicant.wait_for_timeout(4000)
            body = applicant.inner_text("body")
            if "Your application was accepted" not in body:
                failures.append(("notify", "missing 'Your application was accepted' notification"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("notify", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Loop 2 — challenge: join, submit, owner passes, reputation earned.
        # ---------------------------------------------------------------
        try:
            applicant.goto(
                f"{BASE_URL}/challenges/{PORTFOLIO_CHALLENGE}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            applicant.get_by_role("button", name="Join Challenge").click(timeout=30000)
            applicant.wait_for_timeout(3000)

            # Joining lands the participant at "joined"; advance to "in_progress"
            # by clicking the next step's circle in the status tracker.
            step_row = applicant.get_by_text("in progress", exact=True).locator("xpath=..")
            step_row.locator("button").click(timeout=30000)
            applicant.wait_for_timeout(2000)

            applicant.get_by_placeholder(
                "Link to your work (repo, video, doc…) or uploaded file name"
            ).fill("https://example.com/maya-portfolio")
            applicant.get_by_placeholder("Short note for the reviewer (optional)").fill(
                "Weekend portfolio, done."
            )
            applicant.get_by_role("button", name="Submit for Review").click()
            applicant.wait_for_timeout(3000)
            body = applicant.inner_text("body")
            if "Under review" not in body:
                failures.append(("challenge-submit", "no 'Under review' state after submitting"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("challenge-submit", str(exc)[:160]))

        try:
            owner.goto(
                f"{BASE_URL}/challenges/{PORTFOLIO_CHALLENGE}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            owner.wait_for_timeout(4000)
            # Scope to Maya's submission card (the seed leaves Priya's submission
            # pending on this same challenge, so there are two Pass buttons).
            maya_card = owner.locator(
                "div.card-border", has=owner.get_by_text("Weekend portfolio, done.")
            ).first
            maya_card.get_by_role("button", name="Pass — award badge").click(timeout=30000)
            owner.wait_for_timeout(3000)
            # Reload so the roster badge reflects the persisted verdict.
            owner.goto(
                f"{BASE_URL}/challenges/{PORTFOLIO_CHALLENGE}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            owner.wait_for_timeout(4000)
            body = owner.inner_text("body")
            if "Passed" not in body:
                failures.append(("challenge-review", "participant badge did not show 'Passed'"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("challenge-review", str(exc)[:160]))

        try:
            applicant.goto(
                f"{BASE_URL}/challenges/{PORTFOLIO_CHALLENGE}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            applicant.wait_for_timeout(4000)
            body = applicant.inner_text("body")
            if "Passed review" not in body:
                failures.append(("challenge-passed", "applicant did not see 'Passed review'"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("challenge-passed", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Loop 3 — a private project stays hidden from a non-member.
        # ---------------------------------------------------------------
        try:
            owner.goto(
                f"{BASE_URL}/projects/{PRIVATE_PROJECT}",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            owner.wait_for_timeout(4000)
            body = owner.inner_text("body")
            if "Project not found" not in body and "Atlas — Internal" in body:
                failures.append(("private-project", "private project leaked to a non-member"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("private-project", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Loop 4 — cold-start: a new user sees curated, labeled starters.
        # ---------------------------------------------------------------
        try:
            applicant.goto(
                f"{BASE_URL}/challenges",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            applicant.wait_for_timeout(4000)
            body = applicant.inner_text("body")
            if "Start here" not in body:
                failures.append(("cold-start", "no 'Start here' section on the challenges page"))
            elif "Curated by Tethyr" not in body:
                failures.append(("cold-start", "starters are not labeled as curated by Tethyr"))
            else:
                # Join one starter challenge — the curated path must be real.
                starter_card = applicant.get_by_text("Ship a one-page personal site").first
                starter_card.click(timeout=30000)
                applicant.wait_for_timeout(3000)
                applicant.get_by_role("button", name="Join Challenge").click(timeout=30000)
                applicant.wait_for_timeout(3000)
                if "Joined" not in applicant.inner_text("body"):
                    failures.append(("cold-start", "could not join a starter challenge"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("cold-start", str(exc)[:160]))

        browser.close()

    return _report(failures)


def _report(failures) -> int:
    print("Core loop browser test")
    if failures:
        for name, reason in failures:
            print(f"  FAIL  {name}: {reason}")
        print(f"{len(failures)} check(s) failed")
        return 1
    print("  PASS  all core-loop checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
