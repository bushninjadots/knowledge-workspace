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
- [ ] Verify remote migration state before shipping database-dependent changes.
- [ ] Establish authenticated browser coverage for dashboard, Studio customization, Explore, project People, and project creation.

## Stage 1 — Trust and state clarity (current)

**Goal:** remove duplicate visual ownership, blank/incorrect states, and misleading terminology.

- [x] Make WorkspaceGrid module chrome single-owner on dashboard and Studio.
- [x] Ensure dashboard errors render as errors instead of falling through to loading or unauthenticated UI.
- [x] Ensure optional modules do not reserve layout space when their body is absent.
- [x] Canonicalize visible skill language to “Skills I share” and “Skills I’m growing.”
- [x] Add reputation-tier math regression tests and clarify the current/next-tier meaning.
- [ ] Add focused component/browser regression tests for WorkspaceGrid ownership and dashboard error/empty rendering; reputation and label unit tests are now present.

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

- [ ] Recompose first-view hierarchy: README/identity → current work → people/roles → conversation → evidence.
- [ ] Add a concise current-work/needed-next summary.
- [ ] Keep files, repos, resources, activity, and timeline available as secondary tools.
- [ ] Remove or consolidate duplicate project actions/sections only after runtime confirmation.

## Stage 4 — Studio and dashboard simplification

**Goal:** make personal surfaces answer the next meaningful question.

- [ ] Reduce dashboard default prominence to Today, active projects, collaboration actions, discovery, and evidence.
- [ ] Make project work and contribution evidence dominate Studio.
- [ ] Consolidate overlapping Stats/Reputation surfaces without losing useful evidence.
- [ ] Share shell primitives between dashboard and authenticated routes where behavior is truly equivalent.
- [ ] Keep customization optional, reversible, and quiet.

## Stage 5 — Connect supporting systems to work

**Goal:** prevent Community, Messages, Sessions, Challenges, and Library from becoming disconnected products.

- [ ] Add project context to messages and feedback where appropriate.
- [ ] Connect Library resources to projects with explicit visibility and permissions.
- [ ] Make sessions and challenges visibly relate to projects, people, or skills.
- [ ] Keep community centered on updates, help, feedback, lessons, showcases, and open roles.

## Stage 6 — Type safety, accessibility, and scale

**Goal:** harden the seams before feature expansion.

- [ ] Replace high-risk Supabase `as any` boundaries with typed query/mutation adapters.
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

### 2026-08-09 — Stage 1 started

- Confirmed baseline: 59 tests passing.
- Confirmed only pre-existing application changes are the public landing navbar/index edits.
- Completed the source fixes for single-owner workspace chrome, dashboard error-state ordering, canonical skill labels, and reputation math.
- Added unit coverage for reputation tiers and canonical labels; component/browser coverage for WorkspaceGrid and dashboard branches remains queued.
- Validation: Prettier, TypeScript, 63 Vitest tests, production build, route smoke, and `git diff --check` passed; build emitted only existing Vite/chunk-size notices.
