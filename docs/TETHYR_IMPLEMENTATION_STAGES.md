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

- [x] Verify project creation, editing, visibility, files, and signed URLs. (2026-08-20: full project wizard create + project page edit/README save exercised in the browser against the local stack; signed images handled by `SignedImage` with editor-provided alt.)
- [x] Verify open roles, applications, accept/decline races, auto-decline, notifications, and People state. (2026-08-20: `tests/core_loop_browser.py` two-user project loop passes end to end; notification-destination map now covers every collaboration outcome and is unit-tested.)
- [x] Verify private-project child-resource RLS and contributor permissions. (2026-08-20: `supabase/tests/rls_regression.sql` — 20 sections, 71 pgTAP assertions — passes against the local DB.)
- [x] Verify challenge submission/review/pass-gated reputation. (2026-08-20: covered by the RLS suite + `20260809120000_harden_challenge_review.sql` tests.)
- [x] Verify notification destinations for every collaboration outcome. (2026-08-20: `src/lib/notification-destinations.test.ts` extended to cover the two missing types — every outcome is now asserted.)
- [x] Add RLS and authenticated browser regression coverage for these flows. (2026-08-20: RLS suite passes locally; `tests/core_loop_browser.py` (two-user create/contribute/comment loop) passes; project-create/edit exercised in the browser.)

## Stage 3 — Project workspace hierarchy

**Goal:** make the project page feel like a human collaboration workspace.

- [x] Recompose first-view hierarchy: README/identity → current work → people/roles → conversation → evidence.
- [x] Add a concise current-work/needed-next summary.
- [x] Keep files, repos, resources, activity, and timeline available as secondary tools.
- [x] Remove or consolidate duplicate project actions/sections only after runtime confirmation. (2026-08-20: runtime audit of the built project page — no true duplicates exist; the repeated CTAs are coherent deep-links into their sections: header "Post update" → conversation composer, "Add demonstration"/"Add this week's evidence" → evidence section.)

## Stage 4 — Studio and dashboard simplification

**Goal:** make personal surfaces answer the next meaningful question.

- [x] Reduce dashboard default prominence to Today, active projects, collaboration actions, discovery, and evidence. (2026-08-20: default preset already is projects + applications + activity, with presets + quiet customization; welcome-header completeness ring removed in the UX review second pass.)
- [x] Make public Studio work and contribution evidence lead the public presentation; add owner-controlled freeform public layout.
- [x] Consolidate overlapping Stats/Reputation surfaces without losing useful evidence. (2026-08-20: audit found reputation is already consolidated — compact badges plus one full card; the separate "week" stat module was already retired.)
- [x] Share the existing workspace primitives between private and public Studio layout behavior where the interaction contract is equivalent.
- [x] Keep public customization optional, reversible, and quiet; the identity header remains fixed.
- [x] Decide whether the dashboard priority flow should expose controlled user focus preferences. (2026-08-20: decided — the dashboard already exposes focus through the existing preset + customization system; instead of adding a duplicate control, the quick-arrangement picker is now labeled **"Focus"** on the dashboard (with helper copy: "Pick what your dashboard leads with"), so the preset buttons read as a focus choice. Profile keeps "Creative arrangement" since it is about presentation. The presets themselves (Build center / Network center) already move the right modules to the top.)

## Stage 5 — Connect supporting systems to work

**Goal:** prevent Community, Messages, Sessions, Challenges, and Library from becoming disconnected products.

- [x] Add project context to messages and feedback where appropriate. (2026-08-20: verified — messages/feedback carry project context, and the project page links its Sessions/Challenges sections.)
- [x] Connect Library resources to projects with explicit visibility and permissions. (2026-08-20: already implemented — `20260819030000_library_project_link.sql` + RLS + `useProjectLibraryItems`.)
- [x] Make sessions and challenges visibly relate to projects, people, or skills. (2026-08-20: project page has Sessions/Challenges sections; verified in the browser.)
- [x] Keep community centered on updates, help, feedback, lessons, showcases, and open roles. (2026-08-20: audit — the rail and feed are already scoped to those categories; "Challenges" moved out in the UX review second pass.)

## Stage 6 — Type safety, accessibility, and scale

**Goal:** harden the seams before feature expansion.

- [x] Replace high-risk Supabase `as any` boundaries with typed query/mutation adapters. (2026-08-18: all hand-written `as any` sites removed; the only remaining ones are auto-generated in `routeTree.gen.ts`.)
- [x] Add tests for permissions, loading/error/empty states, and notification destinations. (2026-08-20: notification-destination tests cover every outcome; settings tests cover loading/error paths + delete-account gating; mobile-primary-nav tests cover labels + `aria-current`; RLS suite covers permissions.)
- [x] Add keyboard/focus coverage for WorkspaceGrid, ProjectShelf, dialogs, drawers, and mobile navigation. (2026-08-20: fully closed — `SegmentedControl` (ARIA tabs), `ProfileLink`, `MobilePrimaryNav`, `WorkspaceGrid` (Escape exits customize, arrow-key + button module moves), `ProjectShelf` (arrow-key browsing, prev/next + thumbnail navigation, overlay auto-focus + Escape close), the Radix `Dialog` (focus-in, Escape close, focus return to trigger), and the vaul `Drawer` (open, Escape close) all have dedicated keyboard/focus tests.)
- [x] Audit meaningful image alt text and dynamic-accent contrast. (2026-08-20: audit — all `<img>`s are decorative with `alt=""` plus adjacent text or use `SignedImage` with editor-provided alt; accent colors always pair with designed foreground/subtle tokens.)
- [x] Measure query/list performance, then add pagination or lazy loading where evidence requires it. (2026-08-20: audit of list queries found one genuinely unbounded query — the platform-wide challenges list; capped with `.limit(100)`. All other list hooks bound with limit/range or `maybeSingle`.)

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

#### 2026-08-20 (third pass) — keyboard/focus coverage + commit

- Added the ARIA tabs keyboard pattern to the shared `SegmentedControl` (roving tabindex — only the active tab is in the tab order — plus Left/Right/Up/Down arrow selection with focus following) and component tests for it, plus `ProfileLink` tests (renders a link with a handle, a non-interactive fallback without one, and passes title/style through).
- Pushed the UX-review commit (`6cfceff`) to `origin/main`; re-verified the full surface in the browser post-commit (dashboard, explore + arrow-key tab navigation, skills tablist, settings, community rail, messages) with no console errors.
- Validation: typecheck, 218 Vitest tests, ESLint, production build all passed.

#### 2026-08-20 (fourth pass) — finish all stages

Ran the remaining stages to completion (see checkboxes above for per-item status). Highlights:

- **Stage 2 verified end to end**: `supabase/tests/rls_regression.sql` (20 sections, 71 pgTAP assertions) passes against the local DB; `tests/core_loop_browser.py` (two-user create/contribute/comment loop) passes; full project-wizard creation and project-page editing (README save) exercised manually in the browser; `notification-destinations.test.ts` extended to cover the two previously missing outcomes.
- **Stage 3 closed**: runtime audit of the built project page found no true duplicate actions — repeated CTAs are coherent section deep-links (header "Post update" → composer; "Add demonstration" → evidence), so nothing needed consolidating.
- **Stage 4**: dashboard default prominence and reputation consolidation were already in place (audited + confirmed); the only remaining item is the focus-preferences product decision, left open deliberately.
- **Stage 5**: already implemented — project context in messages, Library↔project link (`20260819030000` + RLS + `useProjectLibraryItems`), Sessions/Challenges sections on the project page, community scoped to updates/help/feedback/lessons/showcases/open roles. Verified.
- **Stage 6**: alt-text + dynamic-accent contrast audit clean; list-query audit found one unbounded query (challenges) → capped with `.limit(100)`; added `MobilePrimaryNav` tests (labels + `aria-current`) and `SettingsPage` tests (sections render, invalid-email validation, short-password validation, delete-account email gating, delete + sign-out flow). WorkspaceGrid/ProjectShelf/dialog/drawer focus tests remain as follow-up work.
- **Stage 7**: by design, deferred until there's usage evidence — no action taken.
- **Validation**: typecheck, 229 Vitest tests, production build all passed.

#### 2026-08-20 (fifth pass) — focus decision + remaining keyboard/focus coverage

- **Stage 4 decision**: the dashboard's focus preference is the existing preset + customization system, now labeled explicitly — the quick-arrangement picker reads **"Focus — Pick what your dashboard leads with"** on the dashboard (profile keeps "Creative arrangement"). No duplicate control added.
- **Stage 6 keyboard/focus closed out**: new tests for `WorkspaceGrid` (Escape exits customize mode; arrow-key handle and up/down buttons move modules), `ProjectShelf` (arrow-key browsing with clamping, prev/next + thumbnail navigation, overlay auto-focuses its close button, Escape closes, pointer-capture stub for jsdom), the Radix `Dialog` primitive (focus moves into the dialog, Escape closes, focus returns to the trigger), and the vaul `Drawer` primitive (opens from trigger, Escape closes; matchMedia stubbed for jsdom).
- **Validation**: typecheck, 244 Vitest tests, production build all passed.

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
