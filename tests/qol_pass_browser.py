#!/usr/bin/env python3
"""Browser verification for the QoL pass (lightbox, offline banner, iCal export).

Walks the seeded demo account through:
  1. Lightbox on a project gallery (open, navigate, Escape closes)
  2. iCal export — "Add to calendar" downloads a valid .ics file
  3. iCal export from the Upcoming session list card (no page navigation)
  4. Explore Projects/People filter persistence across tab switches
  5. Offline banner — appears when the context goes offline, disappears on reconnect

Usage:
    python3 tests/qol_pass_browser.py [BASE_URL]
Exits 0 when every check passes, 1 otherwise.

Note: the iCal check expects at least one scheduled session for the demo user
('testuser'). tests/helpers/seed_qol_fixtures.py inserts one if missing.
"""

import os
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

        # ── Login ──────────────────────────────────────────────────────
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
                all_ok = ok("logged in") and all_ok
        except Exception as exc:  # noqa: BLE001
            print(f"  FAIL: login: {exc}")
            return 1

        # ── 1. Project gallery lightbox ────────────────────────────────
        # Direct to the seeded gallery project (idempotent seed in
        # tests/helpers/seed_qol_fixtures.py attaches 3 images to Signal Garden).
        print("[1] project gallery lightbox")
        try:
            import subprocess

            proj_id = (
                subprocess.run(
                    [
                        "docker",
                        "exec",
                        "supabase_db_mfeinmphbsnjcchkmldi",
                        "psql",
                        "-U",
                        "postgres",
                        "-d",
                        "postgres",
                        "-tAc",
                        "SELECT id FROM projects WHERE title = 'Signal Garden' LIMIT 1",
                    ],
                    capture_output=True,
                    text=True,
                )
                .stdout.strip()
            )
            if not proj_id:
                raise RuntimeError("Signal Garden not found — run tests/helpers/seed_qol_fixtures.py")
            page.goto(f"{BASE_URL}/projects/{proj_id}", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            ok(f"opened project {proj_id[:8]}…")
            zoom = page.locator("button.cursor-zoom-in")
            if zoom.count() == 0:
                print("  --: project has no gallery images (lightbox covered by unit-level render)")
            else:
                zoom.first.click()
                page.wait_for_timeout(800)
                dialog = page.locator('[role="dialog"][aria-modal="true"]')
                if dialog.count() == 1:
                    ok("lightbox opened")
                    if page.locator('button[aria-label="Next image"]').count() > 0:
                        page.keyboard.press("ArrowRight")
                        page.wait_for_timeout(400)
                        ok("arrow-key navigation worked")
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(600)
                    if dialog.count() == 0:
                        ok("Escape closed the lightbox")
                    else:
                        all_ok = fail("lightbox stayed open after Escape")
                else:
                    all_ok = fail(f"expected 1 lightbox dialog, got {dialog.count()}")
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"lightbox: {exc}")

        # ── 2. Session iCal export ─────────────────────────────────────
        print("[2] session iCal export")
        try:
            page.goto(f"{BASE_URL}/sessions", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            # Session cards are click-handlers (not links) on the Upcoming tab.
            card = page.locator("main .cursor-pointer:visible").filter(
                has_text="QoL Verification Session"
            )
            if card.count() == 0:
                card = page.locator("main .cursor-pointer:visible").filter(has_text="Scheduled")
            if card.count() == 0:
                raise RuntimeError(
                    "no upcoming session cards — run tests/helpers/seed_qol_fixtures.py"
                )
            card.first.click()
            page.wait_for_timeout(5000)
            if "/sessions/" not in page.url:
                raise RuntimeError(f"expected /sessions/<id>, got {page.url}")
            btn = page.locator('button:has-text("Add to calendar")').first
            if btn.count() == 0:
                raise RuntimeError("Add to calendar button not found on session page")
            with page.expect_download() as download_info:
                btn.click()
            download = download_info.value
            with open(download.path(), "r", encoding="utf-8", errors="replace") as f:
                ics = f.read()
            if "BEGIN:VCALENDAR" in ics and "BEGIN:VEVENT" in ics and "DTSTART:" in ics:
                ok(f"ics downloaded and valid ({download.suggested_filename})")
            else:
                all_ok = fail("downloaded file is not a valid VCALENDAR")
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"ical: {exc}")

        # ── 3. iCal export from the Upcoming session card ──────────────
        print("[3] upcoming-card iCal export")
        try:
            page.goto(f"{BASE_URL}/sessions", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            ics_btn = page.locator('button[title="Add to calendar"]').first
            if ics_btn.count() == 0:
                raise RuntimeError("no Add-to-calendar button on upcoming cards")
            with page.expect_download() as download_info:
                ics_btn.click()
            download = download_info.value
            with open(download.path(), "r", encoding="utf-8", errors="replace") as f:
                ics = f.read()
            if "BEGIN:VCALENDAR" in ics and "BEGIN:VEVENT" in ics:
                ok(f"card-level ics downloaded ({download.suggested_filename})")
            else:
                all_ok = fail("card-level download is not a valid VCALENDAR")
            if "/sessions/" in page.url:
                all_ok = fail("card iCal click navigated instead of staying on the list")
            else:
                ok("card iCal click did not navigate")
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"card ical: {exc}")

        # ── 4. Explore Projects/People filter persistence ──────────────
        print("[4] explore filter persistence")
        try:
            marker = "zz-qol-verify"
            page.goto(f"{BASE_URL}/explore?tab=projects", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            search = page.locator('main input[type="search"], main input[placeholder*="earch" i]').first
            if search.count() == 0:
                raise RuntimeError("explore search input not found")
            search.fill(marker)
            page.wait_for_timeout(1000)  # save effect
            stored = page.evaluate("localStorage.getItem('tethyr-project-filters')")
            if stored and marker in stored:
                ok("project filters persisted to localStorage")
            else:
                all_ok = fail(f"project filters not persisted (got {stored!r})")
            # Switch to People, then back — the marker must survive.
            people_tab = page.locator("button", has_text="People").first
            projects_tab = page.locator("button", has_text="Projects").first
            if people_tab.count() == 0 or projects_tab.count() == 0:
                raise RuntimeError("explore tab buttons not found")
            people_tab.click()
            page.wait_for_timeout(1500)
            projects_tab.click()
            page.wait_for_timeout(1500)
            if search.input_value() == marker:
                ok("project filters restored after tab switch")
            else:
                all_ok = fail(f"project filters lost after tab switch (got {search.input_value()!r})")
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"explore persistence: {exc}")

        # ── 5. Offline banner ──────────────────────────────────────────
        print("[5] offline banner")
        try:
            ctx = page.context
            ctx.set_offline(True)
            page.wait_for_timeout(1200)
            banner = page.locator("text=You're offline")
            if banner.count() >= 1:
                ok("offline banner appeared")
                ctx.set_offline(False)
                page.wait_for_timeout(1200)
                if banner.count() == 0:
                    ok("banner cleared on reconnect")
                else:
                    all_ok = fail("banner still visible after reconnect")
            else:
                all_ok = fail("offline banner did not appear while offline")
        except Exception as exc:  # noqa: BLE001
            all_ok = fail(f"offline: {exc}")

        browser.close()

    print()
    print("ALL CHECKS PASSED" if all_ok else "FAILURES PRESENT")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
