# Tethyr Implementation Stages

> Created August 9, 2026 from `docs/TETHYR_FULL_FORENSIC_AUDIT_2026-08-09.md`.
> This is an implementation plan, not a permission to expand the product scope.

## Operating rule

Implement the smallest change that improves coherence, trust, or the core collaboration loop. Each stage must be validated before the next stage begins. Do not add new top-level features while a higher-priority stage is incomplete.

## Stage 0 — Baseline and release safety

**Goal:** know what is safe to change and prevent regressions.

- [x] Preserve the public landing header as Logo + Log in + Join Tethyr.
- [x] Record the forensic audit and its evidence limitations.
- [x] Capture the current test/build/typecheck/smoke baseline.
- [x] Verify remote migration state before shipping database-dependent changes. (2026-08-18: 8 pending migrations pushed — GitHub tokens, role-app notifications, poll vote RPC, challenge-review hardening, project needs, milestone attribution, teams, milestone reputation.)
- [x] Establish a repeatable authenticated browser smoke test (`tests/seed_browser_smoke.py`) covering dashboard, Explore, Studio, community, challenges, sessions, and the project page. Interactive flows (Studio customization, project creation, project People) still need dedicated coverage.

## Stage 1 — Trust and state clarity (current)

**Goal:** remove duplicate visual ownership, blank/incorrect states, and misleading terminology.

- [x] Make WorkspaceGrid module chrome single-owner on dashboard and Studio.
- [x] Ensure dashboard errors render as errors instead of falling through to loading or unauthenticated UI.
- [x] Ensure optional modules do not reserve layout space when their body is absent.
- [x] Canonicalize visible skill language to “Skills I share” and “Skills I’m growing.”
- [x] Add reputation-tier math regression tests and clarify the current/next-tier meaning.
- [x] Add focused component regression tests for WorkspaceGrid ownership and dashboard loading/error/empty rendering; reputation and label unit tests are now present. Authenticated browser coverage remains queued in Stage 0.

## Stage 2 — Core collaboration flow verification

**Goal:** prove that the project loop works end to end.

- [ ] Verify project creation, editing, visibility, files, and signed URLs.
- [ ] Verify open roles, applications, accept/decline races, auto-decline, notifications, and People state.
- [ ] Verify private-project child-resource RLS and contributor permissions.
- [ ] Verify challenge submission/review/pass-gated reputation.
- [ ] Verify notification destinations for every collaboration outcome.
- [ ] Add RLS and authenticated browser regression coverage for these flows.

## Stage 3 — Project workspace hierarchy

**Goal:** make the project page feel like a human collaboration workspace.

- [x] Recompose first-view hierarchy: README/identity → current work → people/roles → conversation → evidence.
- [x] Add a concise current-work/needed-next summary.
- [x] Keep files, repos, resources, activity, and timeline available as secondary tools.
- [ ] Remove or consolidate duplicate project actions/sections only after runtime confirmation.

## Stage 4 — Studio and dashboard simplification

**Goal:** make personal surfaces answer the next meaningful question.

- [ ] Reduce dashboard default prominence to Today, active projects, collaboration actions, discovery, and evidence.
- [x] Make public Studio work and contribution evidence lead the public presentation; add owner-controlled freeform public layout.
- [ ] Consolidate overlapping Stats/Reputation surfaces without losing useful evidence.
- [x] Share the existing workspace primitives between private and public Studio layout behavior where the interaction contract is equivalent.
- [x] Keep public customization optional, reversible, and quiet; the identity header remains fixed.
- [ ] Decide whether the dashboard priority flow should expose controlled user focus preferences.

## Stage 5 — Connect supporting systems to work

**Goal:** prevent Community, Messages, Sessions, Challenges, and Library from becoming disconnected products.

- [ ] Add project context to messages and feedback where appropriate.
- [ ] Connect Library resources to projects with explicit visibility and permissions.
- [ ] Make sessions and challenges visibly relate to projects, people, or skills.
- [ ] Keep community centered on updates, help, feedback, lessons, showcases, and open roles.

## Stage 6 — Type safety, accessibility, and scale

**Goal:** harden the seams before feature expansion.

- [x] Replace high-risk Supabase `as any` boundaries with typed query/mutation adapters. (2026-08-18: all hand-written `as any` sites removed; the only remaining ones are auto-generated in `routeTree.gen.ts`.)
- [ ] Add tests for permissions, loading/error/empty states, and notification destinations.
- [ ] Add keyboard/focus coverage for WorkspaceGrid, ProjectShelf, dialogs, drawers, and mobile navigation.
- [ ] Audit meaningful image alt text and dynamic-accent contrast.
- [ ] Measure query/list performance, then add pagination or lazy loading where evidence requires it.

## Stage 7 — Deferred depth

**Goal:** only build additional platform depth after the existing loop has usage evidence.

- [ ] Evaluate video/audio sessions.
- [ ] Evaluate external calendar sync.
- [ ] Evaluate push/email notifications.
- [ ] Evaluate API, analytics, leaderboards, and native mobile only with a concrete product case.

## Execution log

### 2026-08-20 — UX full-review fixes (dead ends, consolidation, settings hub)

Implemented the findings from `docs/UX_FULL_REVIEW_2026-08-20.md` (full status table in that doc). Highlights:

- **Routing dead ends**: dashboard activity card routes connection requests to `/connections` (browser-verified with a real incoming request); public-page "back" fallbacks go to `/` instead of the authenticated `/explore`; removed the dead `!isOwnProfile` action buttons from `ProfileLayout`; dashboard "Your projects → View all" points at `/profile`.
- **Handle-less profile links**: new shared `ProfileLink` component guards all 7 sites that previously linked to `/u/` (a 404) when a handle was missing.
- **Conversation gating**: public profiles only show "Start a conversation" for accepted connections, deep-linking `/messages?c=…`.
- **Space moderation de-dup**: `/spaces/$slug/settings` no longer embeds a second reports queue — it links to the dedicated `/spaces/$slug/reports` inbox (embedded ban/dismiss dialogs removed).
- **Settings hub** (`/settings`, added to sidebar Account group + footer): email change, password change, per-category notification mute preferences, links to Studio appearance/skills and the sessions weekly schedule, sign out, and a confirmed delete-account flow. Deletion runs through a service-role server function (`src/lib/account-server.ts` → `auth.admin.deleteUser`); the schema cascades (74 CASCADE + 8 SET NULL references).
- **Notification preferences**: `profiles.notification_preferences` JSONB column added by `20260820170000_notification_preferences.sql` (applied to remote and local). `src/lib/notification-categories.ts` is the single type→category map; the notifications page tabs are derived from it (no overlaps); mutes filter both the page and the bell dropdown.
- **Sessions**: tabs are URL-driven (`?tab=requests`, `?tab=availability`); dashboard "Review requests" and the TodayCard deep-link to the queue; global search includes sessions the user participates in.
- **Availability**: dashboard welcome duplicate removed (sidebar is the single status control); sessions tab renamed to "Weekly schedule".
- **Community nav**: "Profile" removed from the community rail; "Projects" relabeled "Project updates".
- **Polish**: unified page-header typography (Sessions, session detail, Notifications); auth-aware footer; Messages empty-state CTAs; search-box shortcut tooltip.
- **Validation**: `npm run typecheck`, `npm test` (193 tests incl. new coverage for the notification-preferences hook and account-deletion server function), ESLint, production build, and authenticated browser walks (dashboard → connections → sessions → settings → public profiles) all passed.

#### 2026-08-20 (second pass) — remaining findings closed

- **Navigation ownership (M3)**: "Challenges" removed from the community rail — the app sidebar owns the destination; the feed's `challenges` nav id stays valid for deep links. "Trending" kept as a community-feed sort.
- **Label consistency (L1)**: mobile primary nav now matches the sidebar ("Dashboard", "Your Studio"); "Teams I build with" → "Crews I build with".
- **Completeness consolidation (L2)**: the dashboard welcome header no longer duplicates the completeness ring — the next-steps module is the single completeness surface on that screen.
- **Shared SegmentedControl (L3)**: extracted `src/components/tethyr/segmented-control.tsx` (one container + pill treatment, tab semantics) and adopted it on the Explore views and Skill workshop tabs; challenges filter chips intentionally stay chips (`rounded-full` per the radius scale).
- **Validation**: typecheck, 203 Vitest tests, ESLint, production build, and browser checks (mobile nav labels, Explore/skills tablists, community rail) all passed.

### 2026-08-19 — Public Studio layout

- Added an owner-controlled public Studio layout stored on `profiles.public_studio_layout`, separate from private `user_layout_preferences` so anonymous visitors can read the public arrangement without exposing private workspace preferences.
- Recomposed `/u/:handle` around Featured work, Contributions, Contribution activity, shared/growing skills, links, and about content through the existing `WorkspaceGrid` interaction model.
- Added mobile move-up/move-down controls and a contextual link from private Studio to the public Studio view.
- Validation: TypeScript, Vitest, production build, bundle budget, and Chromium desktop/mobile smoke all passed.


### 2026-08-09 — Audit P0 challenge trust hardening

- Verified the core collaboration audit surface and found a concrete gap: the broad participant UPDATE policy allowed a client-side `review_status = 'passed'` write even though the reputation trigger was intended to be creator-gated.
- Added `20260809120000_harden_challenge_review.sql`: participant identity is immutable; participants can submit/resubmit evidence; only the challenge creator can pass/reject another participant; self-review and evidence-less submissions are rejected.
- Added 39 pgTAP assertions covering the real none → submitted → rejected → resubmitted → passed flow, self-award prevention, evidence requirements, private-project child RLS, storage, and sessions. Local database was reset only; remote migration state was not changed.
- Added a canonical notification destination map and wired challenge review outcomes plus role application outcomes consistently to their project/challenge destinations.
- Frontend validation: 75 Vitest tests, TypeScript, production build, changed-file ESLint (0 errors/warnings), and `git diff --check` passed. Local RLS validation passed after migration reset; remote migration state remains pending and must be verified/applied separately before shipping.


### 2026-08-09 — Stage 1 started

- Confirmed baseline: 59 tests passing.
- Confirmed only pre-existing application changes are the public landing navbar/index edits.
- Completed the source fixes for single-owner workspace chrome, dashboard error-state ordering, canonical skill labels, and reputation math.
- Added unit coverage for reputation tiers and canonical labels, plus component coverage for WorkspaceGrid ownership and dashboard state branches.
- Validation: Prettier, TypeScript, 71 Vitest tests, production build, route smoke, and `git diff --check` passed; build emitted only existing Vite/chunk-size notices. Changed-file ESLint has no errors; existing dashboard warnings remain.

### 2026-08-09 — Stage 1 regression coverage completed

- Extracted the dashboard top-level state contract into `DashboardStateBoundary` without changing branch precedence.
- Added coverage for signed-out, loading, error/retry, stale-data error precedence, and authenticated states.
- Added WorkspaceGrid coverage proving child-owned headers remain single-owner in normal and customize modes, while grid-owned chrome renders exactly one title.
- Validation: 71 Vitest tests, TypeScript, changed-file lint (0 errors), Prettier, production build, route smoke, and `git diff --check` passed.
