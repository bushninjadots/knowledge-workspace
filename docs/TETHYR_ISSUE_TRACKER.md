# Tethyr Functional Issue Tracker

> Living tracker for the feature inventory audit (2026-09-05). Each issue
> links to its fix once implemented. Status legend:
> `open` · `in progress` · `fixed` · `won't fix` (with reason) · `deferred`.

## 1. Authentication & Onboarding

Features: email/password + OAuth (OAuthButtons) + password reset with redirect
preservation + open-redirect guard (`safeRedirectPath`) + first-session onboarding
with completeness meter (`profile-completeness.ts`) + account deletion
(`deleteUserAccount`) + offline notice on auth pages.

| #   | Issue                                                                                | Severity | Status |
| --- | ------------------------------------------------------------------------------------ | -------- | ------ |
| 11  | No email verification enforcement visible — signup may allow unverified email access | Low-Med  | open   |

## 2. Projects (The Flagship)

Features: full CRUD, presentation presets (`project-presentation.ts`), block
system (15 project blocks + 4 content blocks + 10 profile blocks), PageShell
(edit mode, drag-drop, theme tokens), legacy + block dual rendering
(`blocksArePage`), milestones, activity feed, discussions, open roles
(accept/decline RPCs), needs, file explorer, GitHub integration, search ("/"
shortcut), visits return shelf (`useProjectLoop`), watchers, credits roll
(`credits.ts`), cover gradient, dominant-color extraction.

| #   | Issue                                                                                | Severity | Status                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `communityPostCount = 0` hardcoded (projects.$id.tsx) — community post count is dead | Medium   | **fixed** (`useProjectCommunityPostCount` in `use-projects.ts` + test)                                                                                                                                                                                                                                                                             |
| 2   | Client-side achievement checking — race risk; should be DB-only                      | Medium   | **fixed** (migration `20260905150000_event_driven_achievements.sql`: `trg_award_earned_achievements` AFTER INSERT on projects/comments/posts/project_contributors/skill_endorsements/teams/team_members + project_role_applications accepted; `award_earned_achievements(p_profile_id uuid DEFAULT NULL)`; dashboard client call kept as backstop) |
| 3   | Dual rendering path (blocks + legacy) — maintenance debt                             | Medium   | open                                                                                                                                                                                                                                                                                                                                               |
| 4   | Column fallback queries silently degrade on unmigrated DBs                           | Low-Med  | open                                                                                                                                                                                                                                                                                                                                               |

## 3. Profiles ("Your Studio")

Features: public `/u/:handle`, Creation Studio, 10 block types, background
customization, banner system, theme tokens, Studio config (5 dimensions),
starter presets, page versioning (`useRollbackPageVersion`), quick edit mode.

| #   | Issue                                                                                                          | Severity | Status                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5   | Profile creation race — public route uses `isOwner: false`; visitors see "not published" if owner never visits | Low      | won't fix — by design (see Top Functional table): lazy draft `pages` creation + published-only public query prevent the builder/public race; unseen/unpublished studios legitimately show the fallback |
| 6   | Studio config migration — legacy fields accepted on read, never produced on write                              | Low      | open                                                                                                                                                                                                   |

## 4. Community & Social

Features: community feed (infinite scroll, type filtering), posts CRUD,
threaded comments + best-answer, likes/upvote/pin/share-to-space, polls,
community spaces (join/leave/settings/members/roles/bans), space chat
(real-time + typing), space reports/moderation, space join requests, space read
state, follow system, connections, direct messages (read receipts, unread), notifications.

| #   | Issue                                                                                                                             | Severity | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 7   | 7 realtime channels, no cleanup/connection-pool audit (connections hook uses module-level singleton; others useRef per-component) | Low-Med  | open   |
| 8   | Community search bar only filters current feed, not global search                                                                 | Low      | open   |

## 5. Sessions (Mentoring & Collaboration)

Features: lifecycle CRUD, types (upcoming/calendar/history/requests/availability),
session requests, participants, resources, notes, availability slots, per-user
stats, schedule wizard, project sessions.

| #   | Issue                                                                                | Severity | Status                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | No calendar integration (Google Calendar / iCal export) despite a "calendar" tab     | Low      | open                                                                                                                                                                                                                                            |
| 10  | No video call integration                                                            | Low      | open                                                                                                                                                                                                                                            |
| 11  | No timezone awareness in UI (`timezones.ts` exists; times render in browser TZ only) | Low      | **fixed** (2026-09-05) — `zonedDateTimeToUtcIso` in `src/lib/timezones.ts`; `schedule-session-wizard` now stores the UTC instant for the _chosen_ zone, not the browser's (previously a diverging pick scheduled the wrong local time); 8 tests |

## 6. Challenges

Features: full lifecycle, difficulty + type filtering, participation tracking,
review workflow (submit → review → approve/reject, DB-enforced via
`enforce_challenge_review_transition`), reputation points, notifications,
project-linked challenges.

| #   | Issue                                                                             | Severity | Status                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Reviewer permission model unclear in UI (RPC exists, no visible "who can review") | Low      | won't fix — the challenge-creator-reviews model is already surfaced in UI copy (`challenges.$id.tsx`: "the creator will review your work", "Creator review panel") and enforced server-side by `enforce_challenge_review_transition` (`20260809120000_harden_challenge_review.sql`) |

## 7. Library

Features: personal library CRUD, collections, tags, versioning, favorites/pins,
GitHub sync, file upload, TipTap note editor, signed images.

| #   | Issue                                            | Severity | Status |
| --- | ------------------------------------------------ | -------- | ------ |
| 13  | No sharing — items/collections are personal only | Low      | open   |
| 14  | No full-text search within the library           | Low      | open   |

## 8. Reputation & Achievements

Features: 9 point-awarding actions, 23 achievement types, auto-award
(`checkAndAwardAchievements` client-side + `award_earned_achievements` RPC),
achievement notifications, reputation score, contribution log
(`log_contribution`), endorsements + upgrade trigger.

| #   | Issue                                                                                                              | Severity | Status                 |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------- |
| 15  | Client-side achievement checking — race risk across tabs / crashes; should be DB-only with client as display layer | Medium   | **fixed** (same as #2) |
| 16  | No achievement revocation on resource deletion                                                                     | Low      | open                   |

## 9. Skill System

Features: 154+ skill catalog, Teach/Learn/Wishlist tiers, matching engine
(`skill-match.ts`), verification levels, experience levels, skill pages,
trending skills, endorsements, proof uploads.

| #   | Issue                                                                                     | Severity | Status |
| --- | ----------------------------------------------------------------------------------------- | -------- | ------ |
| 17  | Skill matching is client-side — won't scale (needs server-side query / materialized view) | Low      | open   |
| 18  | No browseable skill directory (only `/skills/:slug` + trending on landing/explore)        | Low      | open   |

## 10. Teams (Crews)

Features: CRUD, invites, roles, team projects, team credits, public page `/teams/:slug`.

| #   | Issue                                  | Severity | Status |
| --- | -------------------------------------- | -------- | ------ |
| 19  | No team messaging channel              | Low      | open   |
| 20  | Only member vs. owner role distinction | Low      | open   |

## 11. Templates

Features: public gallery (browse/search/filter/sort), publish layout as template,
apply template, unpublish, forking with lineage, usage tracking.

| #   | Issue                                 | Severity | Status |
| --- | ------------------------------------- | -------- | ------ |
| 21  | No visual template preview in gallery | Low      | open   |
| 22  | No template versioning once published | Low      | open   |

## 12. Dashboard & Workspace

Features: react-grid-layout grid, per-page layout persistence, 10+ modules,
preset picker, welcome banner, Today section, return shelf, weekly ritual prompt.

| #   | Issue                                                                | Severity | Status                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | `migrateRetiredModules` flag — retired module references are fragile | Low      | won't fix — deliberate and unit-tested: `RETIRED_DASHBOARD_MODULE_IDS` is the single source of truth and `mergeLayout` migration behavior is pinned in `workspace-layouts.test.ts` (retired ids repack upward; unrelated unknown ids are dropped without shifting); the flag distinguishes dashboard (migrate) from profile (never) |
| 24  | No "reset layout" button                                             | Low      | **fixed** — already implemented: `resetLayout` in `workspace-grid.tsx` (confirm-then-reset, `RotateCcw` button in the customize bar)                                                                                                                                                                                                |

## 13. Explore & Discovery

Features: Projects/People/Opportunities tabs, intent filters, project shelf views,
opportunity matching, creator discovery, discover sidebar, segmented control.

| #   | Issue                                                                                      | Severity | Status                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | No pagination/infinite scroll — hard limits (projects 40 / creators 60 / opportunities 80) | Medium   | fixed (2026-09-05) — explore.tsx feeds converted to useInfiniteQuery with cursor-based "Load more" buttons (projects 40, opportunities 80, creators 60 per page) |
| 26  | Saved searches only for opportunities (localStorage), not projects/people                  | Low      | open                                                                                                                                                             |

## 14. Infrastructure & Security

Strengths: CSP + HSTS + frame/type/permissions-policy headers, 449 RLS policies,
open-redirect guard, SSRF guard (edge function url-guard), upload validation,
safe URL validation, error sanitization, bearer-validated token extraction.

| #   | Issue                                                                                  | Severity | Status                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | `unsafe-inline` in script-src (TanStack SSR) — consider nonce-based CSP                | Med      | open                                                                                                                                                                                        |
| 28  | `unsafe-eval` in dev — ensure never in production                                      | Med      | **fixed** (2026-09-05) — verified by construction: `security-headers.ts` appends `'unsafe-eval'` only when `isDevelopment`; production builds emit `script-src 'self' 'unsafe-inline'` only |
| 29  | GitHub tokens stored server-side in Supabase unencrypted — consider encryption at rest | Low-Med  | open                                                                                                                                                                                        |
| 30  | Sentry Replay `maskAllText: false`, `blockAllMedia: false` — GDPR risk (user in ES)    | Medium   | **fixed** (2026-09-05) — `replayIntegration({ maskAllText: true, blockAllMedia: true })` in `src/lib/sentry.ts`                                                                             |

## 15. Performance & Architecture

Strengths: code-splitting + lazy/Suspense, route loaders for SSR, React Query
cache, module-level singleton channels, code-split landing, TipTap editor,
Framer Motion reduced-motion support, Sentry.

| #   | Issue                                                                                | Severity | Status                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 31  | N+1 signed URL generation for contributor avatars (`Promise.all` over avatarTargets) | Low-Med  | **fixed** (2026-09-05) — batched `createSignedUrls` in `projects.$id.tsx` and `team-block.tsx`; still N+1 for project-media covers in `explore.tsx` + `use-current-user.ts` (separate finding) |
| 32  | Most data fetched client-side after hydration despite SSR — skeletons on first paint | Med      | open                                                                                                                                                                                           |
| 33  | 155 migrations with many fix-ups — no squash/cleanup                                 | Low      | deferred — conflicts with the Lovable no-history-rewrite policy                                                                                                                                |
| 34  | 3 TODO/FIXME markers remain                                                          | Low      | **fixed** (2026-09-05) — verified: zero TODO/FIXME/XXX markers remain in `src/` (ripgrep over ts/tsx)                                                                                          |

## 16. Testing

Strength: 59 test files (hooks, components, lib).

| #   | Issue                                                                                                                                                                                 | Severity | Status                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35  | Critical paths untested — messages, sessions, challenges (hooks), teams, templates, library, settings, notifications hook, connections hook, follow, skill match, reputation, credits | Medium   | open — messages/sessions/challenges (2026-09-05), then follow + credits (2026-09-05, `use-follow.test.tsx` 15 tests + `use-credits.test.tsx` 7 tests) now covered; teams + templates have baselines; library, settings, notifications, connections, skill match remain untested |
| 36  | No E2E tests (Playwright/Cypress)                                                                                                                                                     | Med      | open — partial: `tests/route_smoke.sh` + `tests/seed_browser_smoke.py` (Playwright) cover key routes; no full E2E suite                                                                                                                                                         |
| 37  | No automated migration-clean-apply verification                                                                                                                                       | Med      | open — partial: `npx supabase test db` applies all migrations to a fresh scratch DB per run (pgTAP, 137 assertions / 4 files)                                                                                                                                                   |

---

## Top Functional Issues (priority order)

| #   | Issue                                                                             | Severity | Status                                                                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `communityPostCount = 0` hardcoded — project community posts feature is dead      | Medium   | **fixed** (2026-09-05)                                                                                                                                                                                                                                                                                           |
| 2   | Client-side achievement checking — race condition risk, should be DB-only         | Medium   | **fixed** (2026-09-05, same as #2 in Reputation)                                                                                                                                                                                                                                                                 |
| 3   | Dual rendering path on project page (blocks + legacy) — maintenance debt          | Medium   | deferred — architectural; tracked in `docs/studio-integration-plan.md` Phase 6                                                                                                                                                                                                                                   |
| 4   | N+1 signed URL generation for contributor avatars                                 | Low-Med  | **fixed** (2026-09-05) — `projects.$id.tsx` now uses one batched `createSignedUrls` for contributor avatars instead of a per-avatar loop; still N+1 for project-media covers in `explore.tsx` + `use-current-user.ts` (separate finding)                                                                         |
| 5   | Profile page creation race — visitors see "not published" if owner hasn't visited | Low      | won't fix — by design: `pages` rows are created lazily as `draft` on owner studio open, and the public route's published-only query (`use-page.ts` `.eq("status","published")`) prevents the builder/public race; a profile without a published studio legitimately shows the fallback                           |
| 6   | No pagination/infinite scroll on explore (hard limits: 40/60/80)                  | Medium   | fixed (2026-09-05)                                                                                                                                                                                                                                                                                               |
| 7   | Skill matching is client-side — won't scale                                       | Low      | deferred — needs server-side re-architecture; revisit when explore data grows                                                                                                                                                                                                                                    |
| 8   | Sentry Replay doesn't mask text/media — GDPR risk (user in ES)                    | Medium   | **fixed** (2026-09-05) — `replayIntegration({ maskAllText: true, blockAllMedia: true })` in `src/lib/sentry.ts`                                                                                                                                                                                                  |
| 9   | Critical features (messages, sessions, challenges) have no test coverage          | Medium   | **fixed** (2026-09-05) — new `use-messages.test.tsx`, `use-sessions.test.tsx`, `use-challenges.test.tsx` (30 tests)                                                                                                                                                                                              |
| 10  | 155 migrations with many fix-ups — no squash/cleanup                              | Low      | deferred — conflicts with the Lovable no-history-rewrite policy and local migration tracking; a consolidated baseline would require careful coordination                                                                                                                                                         |
| 11  | No email verification enforcement visible                                         | Low-Med  | deferred — product decision + Supabase auth config; would need an exemption path for demo/seed users                                                                                                                                                                                                             |
| 12  | GitHub tokens stored unencrypted in DB                                            | Low-Med  | deferred — already mitigated: `user_github_tokens` has RLS with zero policies (service_role only, client never reads the token back) and `connected_accounts.access_token` is excluded by column-scoped grants. At-rest encryption (pgcrypto/vault) needs a key-management design — no vault/pgcrypto exists yet |
| 13  | No team messaging or granular team roles                                          | Low      | deferred — feature request                                                                                                                                                                                                                                                                                       |
| 14  | No template visual preview                                                        | Low      | deferred — feature request                                                                                                                                                                                                                                                                                       |
| 15  | No calendar/video integration for sessions                                        | Low      | deferred — feature request                                                                                                                                                                                                                                                                                       |

---

## Additional findings (2026-09-05 triage)

- **`src/components/tethyr/blocks/project/team-block.tsx` rendered raw `avatar_url` paths** — the `avatars` bucket is private (since `20260822010000_fix_public_bucket_listing.sql`), so those images never resolved. **Fixed (2026-09-05)** — the block now batch-signs contributor avatars via one `createSignedUrls` call in its query. (Original line 87.)
- **Remaining N+1 signed-URL loops** (covers, not avatars): `src/hooks/use-current-user.ts:193-202` and `src/routes/_authenticated/explore.tsx` project covers both sign `project-media` covers one per item; batch with `createSignedUrls` when next touched.

---

## Definition of Done (per fix)

- Smallest change that solves the issue; follow repo conventions and UX rules.
- Restore `communityPostCount` heritage: frontend queries the real data; no hardcoded zeros.
- Each applied fix: `npm run typecheck`, `npm run lint`, targeted test run, then
  full `npm run verify` + `npm run verify:full` at batch end.
- Update this tracker's status column on completion.
