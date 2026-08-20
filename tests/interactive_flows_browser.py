#!/usr/bin/env python3
"""Interactive-flow browser test for Studio customization, project creation, and project People.

Closes the Stage 0 coverage gap: the seeded smoke test walks static pages and
the core-loop test covers apply/accept, but the interactive flows below had no
dedicated browser coverage:

    Studio customization   -> enter customize mode, move a module, exit (Escape)
    Project creation       -> run the full wizard and publish a new project
    Project People         -> owner adds an open role on the created project

Users (seeded by `supabase/seed.sql` + `supabase/seed_demo.sql`):
    owner = test@tethyr.com  (owns "Studio Starter"; creates the new project)

Requirements / run order:
  1. Local Supabase with the demo seed applied:
       npx supabase db reset        # runs seed.sql + seed_demo.sql
  2. A running dev server:
       npm run dev                  # prints the local URL (default :8081)
  3. Python Playwright with Chromium:
       pip install playwright && playwright install chromium

Usage:
    python3 tests/interactive_flows_browser.py [BASE_URL]
    # e.g.  python3 tests/interactive_flows_browser.py http://localhost:8081

Credentials override via env:
    OWNER_EMAIL / PASSWORD / TETHYR_BASE_URL

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
PASSWORD = os.environ.get("SMOKE_PASSWORD", "password123")

# Seeded id for the People-tab fallback (Studio Starter, owned by test@tethyr.com).
STUDIO_STARTER = "20000000-0000-0000-0000-000000000008"


def login(page) -> None:
    """Sign in. The dev server SSR's the form, so let React hydrate first."""
    page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("#email", timeout=30000)
    page.wait_for_timeout(6000)
    page.fill("#email", OWNER_EMAIL)
    page.fill("#password", PASSWORD)
    page.click("button[type=submit]")
    page.wait_for_timeout(5000)
    if "/dashboard" not in page.url:
        raise AssertionError(f"expected /dashboard after login, got {page.url}")


def main() -> int:
    failures = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        try:
            login(page)
        except Exception as exc:  # noqa: BLE001
            failures.append(("login", str(exc)[:160]))
            browser.close()
            return _report(failures)

        # ---------------------------------------------------------------
        # Studio customization — enter customize mode, move a module, exit.
        # ---------------------------------------------------------------
        try:
            page.goto(f"{BASE_URL}/profile", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)

            # The preset picker renders an "Arrange sections" entry point when
            # not customizing (profile hides the built-in customize bar).
            page.get_by_role("button", name="Arrange sections").click(timeout=30000)
            page.wait_for_timeout(1500)
            body = page.inner_text("body")
            if "Private Studio layout" not in body:
                failures.append(("studio-customize", "customize mode did not open (no banner)"))
            else:
                # Customize chrome exposes per-module move buttons.
                page.get_by_role("button", name="Move Direction up").click(timeout=30000)
                page.wait_for_timeout(1500)
                if "Private Studio layout" not in page.inner_text("body"):
                    failures.append(("studio-customize", "move button exited customize mode"))
                # Escape exits customize mode (profile has no visible Done button).
                page.keyboard.press("Escape")
                page.wait_for_timeout(1000)
                if "Private Studio layout" in page.inner_text("body"):
                    failures.append(("studio-customize", "Escape did not exit customize mode"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("studio-customize", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Project creation — run the full wizard and publish.
        # ---------------------------------------------------------------
        unique = f"Smoke Project {int(time.time() * 1000) % 1000000}"
        try:
            page.goto(f"{BASE_URL}/profile", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(4000)
            # Sidebar CTA is present on every authenticated page.
            page.get_by_role("button", name="New project", exact=True).click(timeout=30000)
            page.wait_for_timeout(1500)
            if "Start a project" not in page.inner_text("body"):
                failures.append(("project-create", "project dialog did not open"))
                raise AssertionError("no dialog")

            page.get_by_placeholder("Give the project a clear working name").fill(unique)
            page.get_by_role("button", name="Continue", exact=True).click(timeout=30000)
            page.wait_for_timeout(1000)
            page.get_by_role("button", name="Continue", exact=True).click(timeout=30000)
            page.wait_for_timeout(1000)
            page.get_by_role("button", name="Publish project").click(timeout=30000)
            page.wait_for_timeout(4000)

            if "Project published" not in page.inner_text("body"):
                failures.append(("project-create", "no 'Project published' toast after publish"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("project-create", str(exc)[:160]))

        # Verify the new project shows up on the Studio Work module, and grab
        # its route so the People check runs against the real created project.
        project_href = None
        try:
            page.goto(f"{BASE_URL}/profile", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            body = page.inner_text("body")
            if unique not in body:
                failures.append(("project-visible", f"created project {unique!r} missing on Studio"))
            else:
                link = page.locator('a[href^="/projects/"]', has_text=unique).first
                project_href = link.get_attribute("href") if link.count() > 0 else None
                if not project_href:
                    failures.append(("project-visible", "could not find the created project card link"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("project-visible", str(exc)[:160]))

        # ---------------------------------------------------------------
        # Project People — owner adds an open role on the new project.
        # ---------------------------------------------------------------
        people_base = project_href or f"/projects/{STUDIO_STARTER}"
        try:
            page.goto(
                f"{BASE_URL}{people_base}?tab=people",
                wait_until="domcontentloaded",
                timeout=30000,
            )
            page.wait_for_timeout(5000)
            body = page.inner_text("body")
            if "Project people" not in body:
                failures.append(("project-people", "People tab did not render 'Project people'"))

            role_title = f"Smoke Role {int(time.time() * 1000) % 1000000}"
            # Owner-only "Add" button opens the inline role form.
            page.get_by_role("button", name="Add", exact=True).first.click(timeout=30000)
            page.wait_for_timeout(800)
            page.get_by_placeholder("Role title (e.g. React Developer)").fill(role_title)
            page.get_by_role("button", name="Save", exact=True).click(timeout=30000)
            page.wait_for_timeout(3000)
            body = page.inner_text("body")
            if role_title not in body:
                failures.append(("project-people", f"added role {role_title!r} missing from list"))
            if "Role added" not in body:
                failures.append(("project-people", "no 'Role added' toast after saving role"))
        except Exception as exc:  # noqa: BLE001
            failures.append(("project-people", str(exc)[:160]))

        browser.close()

    return _report(failures)


def _report(failures) -> int:
    print("Interactive flows browser test")
    if failures:
        for name, reason in failures:
            print(f"  FAIL  {name}: {reason}")
        print(f"{len(failures)} check(s) failed")
        return 1
    print("  PASS  studio customization, project creation, and project People")
    return 0


if __name__ == "__main__":
    sys.exit(main())
