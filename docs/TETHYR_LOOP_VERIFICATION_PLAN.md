# Tethyr — Core Loop Verification & Focus Plan

> Working plan for the four recommendations made after the membership/RLS
> hardening pass. Each phase proves the previous one before the next begins.
> This is a sequencing document, not a replacement for the canonical
> constitution (`AGENTS.md`) or the stage definitions in
> `TETHYR_IMPLEMENTATION_STAGES.md` (Stage 2–5).

## The one risk this plan targets

The engineering is disciplined, but **the primary loop is unverified**: nobody
has proven a person can `discover → join → contribute → get credited → be
found` end-to-end in a real browser. That is a product gap, not a code gap.
Every phase below either proves a loop transition or removes diffusion.

```
DISCOVER → Explore work → Find people → Collaborate → Build
        → Contribute → Become known → DISCOVER
```

---

## Phase 1 — Prove the loop (automated authenticated browser tests)

Goal: a repeatable, two-user browser test that exercises the actual
collaboration transitions, not just page renders.

- [ ] **Create → open role → apply → accept → People** — user B applies to an
      open role on user A's project; user A accepts; B appears in People as a
      contributor.
- [ ] **Challenge submit → review → pass-gated reputation** — B joins and
      submits to A's challenge; A passes; B's review flips to `passed` and the
      reputation event lands.
- [ ] **Notification destinations** — the accept and pass outcomes create the
      right notifications for B (and A where applicable).
- [ ] **Private-project visibility** — a private project renders for its
      creator/contributors and 404s (or is hidden) for outsiders.
- [ ] Wire the new test next to `tests/seed_browser_smoke.py` and document its
      run order.

**Exit condition:** the test passes against a freshly reset local Supabase +
dev server, and both users' flows are asserted in the browser.

## Phase 2 — Project page legibility (Stage 3)

Goal: the flagship reads as a human workspace, not 10+ equal sections.

- [ ] Recompose first-view hierarchy: **README/identity → current work → people
      → conversation → evidence**.
- [ ] Add a concise current-work / needed-next summary at the top.
- [ ] Keep files, repos, resources, activity, timeline as secondary tools.
- [ ] Consolidate duplicate project actions/sections only after runtime
      confirmation of what actually renders.

**Exit condition:** a first-time visitor can answer "what is this, what's
happening now, who's here, and how do I help" without scrolling past a wall of
tabs.

## Phase 3 — Cut to the center (Stages 4–5)

Goal: remove the five-products-at-once diffusion.

- [ ] Reduce dashboard prominence to Today, active projects, collaboration
      actions, discovery, evidence.
- [ ] Make project work + contribution evidence dominate the Studio.
- [ ] Consolidate overlapping Stats/Reputation surfaces.
- [ ] Wire Sessions, Library, and Messages back to projects (project context,
      visibility, and permissions) instead of parallel islands.

**Exit condition:** the dashboard, Studio, and project pages feel like one
surface answering one sequence of questions, with Sessions/Library/Messages
reachable *through* work.

## Phase 4 — Cold-start

Goal: an empty network shouldn't feel abandoned.

- [ ] Add curated, clearly-labeled starter projects and challenges (real,
      useful, low-scope) — not fake engagement.
- [ ] Label them as starters so discovery has something honest to show on day
      one.

**Exit condition:** a brand-new signed-in user sees several real, joinable
ways to make their first contribution without dead ends.

---

## Validation every phase

- `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
- `supabase db reset` + `supabase test db` when schema/RLS changes.
- Browser test(s) green against a clean local environment.
- Review desktop + mobile, loading/empty/error, and keyboard states per
  `TETHYR_UX_RULES.md`.

---

## Execution log

### 2026-08-18 — Phase 1 started

- Wrote `tests/core_loop_browser.py`, a two-user browser test proving the
  loop: apply → accept → contributor in People; the `role_application_accepted`
  notification; challenge join → submit → pass-gated reputation; and private
  projects staying hidden.
- Fixed a seed bug this test exposed: the `seed_demo.sql` mock users
  (maya/devon/priya/…@tethyr.dev) could never sign in. They were missing
  `auth.identities` rows, had a NULL `instance_id`, and NULL GoTrue-required
  string columns (`confirmation_token`, `recovery_token`, …), so the password
  grant returned 400/500. The demo seed now mirrors `seed.sql` for all of these.
- Validation: core-loop test + `seed_browser_smoke.py` green against a clean
  reset; `tsc --noEmit` clean; 112 Vitest tests pass. No migration (the demo
  seed is local-only), so nothing to `supabase db push`.
