# Full Site Audit — August 19, 2026

**Scope:** Comprehensive audit of the Tethyr codebase covering errors, unfinished features, dead ends, UX smoothness, performance, security, accessibility, and testing.

**Codebase stats:** 457 commits, 263 source files, 24 test files (160 tests passing), 106 SQL migrations, ~170 product components.

---

## Executive Summary

The codebase is in **solid MVP shape** — lint clean, type-check clean, production build succeeds, all 160 tests pass. No dead-end routes, no broken links, no TODO/FIXME markers. The issues found are real but manageable: primarily around accessibility gaps, performance shortcuts, unsafe type assertions, and missing error recovery UX. Nothing blocks the core experience, but several items should be addressed before public launch.

### Health at a Glance

| Area | Status | Notes |
|------|--------|-------|
| Build | ✅ Clean | Lint, typecheck, and build all pass |
| Tests | ✅ 160/160 | But coverage is thin — only 24 test files |
| Routing | ✅ No dead ends | 10 routes missing custom error components |
| Type Safety | ⚠️ 36 `as unknown as` casts | Can silently produce garbage data |
| Accessibility | ⚠️ Multiple gaps | Missing aria-labels, unlabeled inputs, no nav landmarks |
| Performance | ⚠️ Project page is heavy | 20+ eager imports, missing image lazy-loading |
| Security | ✅ Solid | Proper auth middleware, RLS, XSS protection. One env concern. |
| UX | ⚠️ 6 error stubs with no recovery | Toast-only validation, native confirm() |

---

## 1. CRITICAL — Must Fix

### 1.1 Rotate `.env` Secrets and Verify Git History

**File:** `.env` (exists in working directory)

The `.env` file contains `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`. While `.gitignore` lists `.env`, if this file was ever committed to git history, those secrets are exposed. The service role key bypasses all RLS.

**Action:**
- Verify these keys were never committed: `git log --all --full-history -- .env`
- If committed, rotate both keys in Supabase dashboard immediately
- Create `.env.example` with placeholder values for onboarding

### 1.2 Fix `useUnreadCounts` — Unbounded Data Fetch

**File:** `src/hooks/use-messages.ts:164-187`

`useUnreadCounts` fetches **all unread messages** across all connections with no limit, then aggregates in JavaScript. A user with thousands of unread messages will see degraded performance.

**Action:** Replace with a database-level count query using `{ count: "exact", head: true }` or an RPC that returns per-connection counts.

---

## 2. HIGH — Should Fix Before Launch

### 2.1 Unsafe Type Assertions (36 instances)

**Pattern:** `data as unknown as SomeType` appears 36 times across hooks and routes.

These bypass TypeScript's type safety entirely. If the Supabase schema changes at runtime, these silently produce garbage data with no error.

**Key files:**
- `src/hooks/use-current-user.ts:97,179`
- `src/hooks/use-projects.ts:274,402,492,757`
- `src/hooks/use-community.ts:268,308,449`
- `src/hooks/use-challenges.ts:111,133,175,191`
- `src/routes/projects.$id.tsx:237,276,289,294,317`

**Action:** Replace with Zod runtime validation or Supabase typed clients. At minimum, add runtime shape checks for the most critical paths (current user, project detail).

### 2.2 Lazy-Load Project Page Tabs

**File:** `src/routes/projects.$id.tsx:34-52`

The project page eagerly imports **20+ heavy components** (ProjectHeader, ProjectTabs, ProjectReadmeTab, ProjectFilesExplorer, ProjectActivityTab, MilestonesTimeline, ProjectPeopleTab, ProjectDiscussions, etc.). This is the largest route bundle.

**Action:** Lazy-load tab content with `React.lazy()` and `<Suspense>`. Only the active tab needs to be loaded. The README editor is already lazy-loaded — extend this pattern to all tabs.

### 2.3 Add `loading="lazy" decoding="async"` to All Images

**13 of 14 `<img>` tags are missing lazy loading.** None have `width`/`height` attributes, causing layout shift (CLS).

**Affected files:**
- `src/components/tethyr/dashboard-sidebar.tsx:165`
- `src/components/tethyr/project/project-header.tsx:71`
- `src/components/tethyr/project/project-main-content.tsx:288`
- `src/components/tethyr/community/space-header.tsx:97`
- `src/components/tethyr/community/community-card.tsx:83`
- `src/components/tethyr/community/project-card-inline.tsx:64`
- `src/components/tethyr/community/composer-bar.tsx:601`
- `src/components/tethyr/community/composer-bar.tsx:601`
- `src/components/tethyr/landing/community-spaces.tsx:61`
- `src/components/tethyr/team/team-page.tsx:283`
- `src/components/tethyr/profile-sections.tsx:272,1071`
- `src/routes/_authenticated/connections.tsx:253`

**Action:** Add `loading="lazy" decoding="async"` and explicit `width`/`height` attributes to all images.

### 2.4 Convert N+1 Profile Lookups to Joins or RPCs

**7 hooks follow a fetch-then-hydrate pattern:** fetch rows, then batch-fetch author profiles in a second query.

**Affected hooks:**
- `useProjectUpdates` (`use-projects.ts:249-283`)
- `useDiscussions` (`use-projects.ts:364-412`)
- `useDiscussionReplies` (`use-projects.ts:467-501`)
- `useProjectActivity` (`use-projects.ts:726-763`)
- `hydratePosts` (`use-community.ts:210-281`)
- `fetchConnections` (`use-connections.ts:41-61`)
- `useComments` (`use-community.ts:411-458`)

**Action:** Use Supabase embedded resource (`select` with joins) or create database views/RPCs that return pre-joined data.

### 2.5 Remove Unused Dependencies

**`d3-force` and `@types/d3-force`** in `package.json` are never imported anywhere. They add ~30kB+ to `node_modules`.

**Action:** Remove from `package.json`.

### 2.6 Add Retry/Recovery to Error Component Stubs

**6 route error components** display "Something went wrong" with no retry button, no navigation, and no way to recover:

- `src/routes/login.tsx:27-36`
- `src/routes/signup.tsx:28-37`
- `src/routes/dashboard.tsx:69-78`
- `src/routes/_authenticated/messages.tsx:31-40`
- `src/routes/_authenticated/sessions.tsx:12-21`
- `src/routes/_authenticated/community.tsx:28-37`

**Good example:** `src/routes/__root.tsx:41-77` and `src/routes/_authenticated/notifications.tsx:16-31` both provide "Try again" and "Go home" buttons.

**Action:** Replace all 6 stubs with the root error component pattern (retry + go home).

### 2.7 Dashboard Layout Duplication

**Files:**
- `src/components/tethyr/authenticated-shell.tsx` — canonical layout
- `src/routes/dashboard.tsx:97-209` — near-copy of the same layout

The dashboard creates its own `AuthenticatedDashboardLayout` that duplicates the sidebar, header, mobile menu, and scroll-to-top from `AuthenticatedShell`. Any a11y or UI fix must be applied in both places.

**Action:** Move `/dashboard` under `_authenticated/` and use `AuthenticatedShell`, or extract a shared layout component.

---

## 3. MEDIUM — Should Fix

### 3.1 Accessibility Gaps

#### 3.1.1 Missing `aria-label` on Icon-Only Buttons

| File | Line | Element |
|------|------|---------|
| `notification-dropdown.tsx` | 52-59 | Bell button |
| `notification-card.tsx` | 228-234 | "More actions" dropdown |
| `composer-bar.tsx` | 602-606 | Remove-image button (X) |
| `composer-bar.tsx` | 684-687 | Remove poll option button (X) |
| `composer-bar.tsx` | 701-706 | Clear poll end-date button (X) |
| `create-space-dialog.tsx` | 155-162 | Add-rule button (+) |
| `create-space-dialog.tsx` | 175-181 | Remove-rule button (X) |

#### 3.1.2 Unlabeled Form Inputs

| File | Line | Input |
|------|------|-------|
| `composer-bar.tsx` | 566-571 | Post title input |
| `composer-bar.tsx` | 659-663 | Poll question input |
| `composer-bar.tsx` | 671-679 | Poll option inputs (dynamic list) |
| `composer-bar.tsx` | 694-698 | Poll end-date input |
| `composer-bar.tsx` | 788-793 | Link URL input |
| `library.$id.tsx` | 237-239 | Library note title input |

#### 3.1.3 Multiple `<nav>` Without Distinguishing Labels

- `dashboard-sidebar.tsx:103` — sidebar nav
- `navbar.tsx:41` — public navbar
- `sessions-sidebar.tsx:76` — sessions nav
- `library-sidebar.tsx:117,171,226` — three library navs
- `notification-sidebar.tsx:69` — notification nav

**Good example:** `mobile-primary-nav.tsx:16` uses `aria-label="Primary mobile navigation"`.

#### 3.1.4 Missing `aria-current="page"` on Active Sidebar Links

**File:** `dashboard-sidebar.tsx:112-143`

Active state is tracked via CSS class but `aria-current="page"` is never set.

**Good example:** `mobile-primary-nav.tsx:33` correctly uses `aria-current={active ? "page" : undefined}`.

#### 3.1.5 Decorative SVGs Missing `aria-hidden="true"`

**File:** `empty-state.tsx:11-276` — All five workshop SVG illustrations lack accessibility markers. Since they're decorative, they should have `aria-hidden="true"`.

#### 3.1.6 Progress Bars Without Accessible Value Descriptions

**File:** `ui/progress.tsx:11-22` — The `Progress` component doesn't forward `aria-label` or `aria-valuetext`.

**Usages without accessible descriptions:**
- `dashboard.tsx:352,617`
- `project-header.tsx:333-338`

#### 3.1.7 Images with Empty `alt=""` on Meaningful Content

10 instances of user-uploaded images (avatars, banners) marked as decorative with `alt=""`:

- `dashboard-sidebar.tsx:165`
- `profile-sections.tsx:272,1071`
- `project-header.tsx:71`
- `project-main-content.tsx:288`
- `connections.tsx:253`
- `space-header.tsx:97`
- `community-card.tsx:83`
- `project-card-inline.tsx:64`
- `composer-bar.tsx:601`
- `community-spaces.tsx:61`

### 3.2 Unbounded Database Queries

| Hook | File | Issue |
|------|------|-------|
| `useDiscussions` | `use-projects.ts:364` | Fetches all discussions + all reply bodies just to count them |
| `useMilestones` | `use-projects.ts` | Fetches all milestones, no limit |
| `useProjectActivity` | `use-projects.ts:726` | Fetches all activity, no limit |
| `useOpenRoles` | `use-projects.ts` | Fetches all open roles, no limit |
| `useProjectNeeds` | `use-projects.ts` | Fetches all needs, no limit |

**Action:** Add pagination or limits. For reply counts, use `select("discussion_id", { count: "exact" })` instead of fetching all bodies.

### 3.3 JS-Side Aggregation That Should Be Database Queries

**`useNotificationsByCategory`** (`use-notifications.ts:135-157`) fetches all unread notification rows then aggregates types in JavaScript. This should be a database `GROUP BY` or RPC.

### 3.4 Toast-Only Form Validation

Forms use `toast.error()` for validation errors. Toasts auto-dismiss, aren't associated with fields, and screen readers may not announce them.

**Affected:**
- `signup.tsx:60,65`
- `login.tsx:73`
- `reset-password.tsx:82,86`
- `composer-bar.tsx:437,442,451`

**Action:** Add inline validation messages near form fields with `aria-describedby` for accessibility.

### 3.5 Native `confirm()` Dialog

**File:** `connections.tsx:142` — Uses `window.confirm("Withdraw request?")`. This is unstyled and inconsistent with the rest of the UI.

**Action:** Replace with a styled confirm dialog (e.g., using the existing `Dialog` component).

### 3.6 Availability Selector Missing Keyboard Navigation

**File:** `availability-badge.tsx:94-150` — Custom dropdown with `onClick` only. No Escape key handler, no arrow-key navigation, no `role="menu"` / `role="menuitem"`.

### 3.7 Inconsistent Error Handling Across Hooks

Some hooks catch `42P01` (table not found) and return empty arrays, while others let the error propagate:
- `useMyProjects()` catches `42P01` → returns `[]`
- `useMilestones()` does NOT catch `42P01` → throws
- `useInfinitePosts()` catches table-not-found → returns empty

**Action:** Standardize — either all gracefully handle missing tables or none do.

### 3.8 Redundant `getUser()` Calls in Mutations

Multiple mutation hooks call `supabase.auth.getUser()` to get `userId` even though it's already available from `useCurrentUser()` or React Query context:
- `useCreateProjectUpdate()`
- `useCreateDiscussion()`
- `useCreateDiscussionReply()`
- `useFillProjectNeed()`
- `useFollowUser()` / `useUnfollowUser()`

**Action:** Pass userId from the hook's closure instead of making an extra network round-trip.

### 3.9 `use-community-spaces.ts` Is 1292 Lines

This single file handles spaces, members, bans, reports, join requests, chat messages, and settings.

**Action:** Split into focused sub-hooks: `use-space-members.ts`, `use-space-chat.ts`, `use-space-reports.ts`, `use-space-settings.ts`.

---

## 4. LOW — Nice to Have

### 4.1 Missing `errorComponent` on 10 Routes

These routes rely on the root `ErrorComponent` (generic). Custom error components would provide better context:

- `/reset-password`
- `/explore`
- `/connections`
- `/challenges`
- `/challenges/$id`
- `/library`
- `/library/$id`
- `/spaces/$slug/reports`
- `/spaces/$slug/settings`

### 4.2 Missing `notFoundComponent` on 22 Routes

Only 3 routes define custom not-found handlers: `/projects/$id`, `/u/$handle`, `/teams/$slug`. Routes most likely to hit 404 without a custom handler:

- `/challenges/$id`
- `/sessions/$id`
- `/library/$id`
- `/spaces/$slug/reports`
- `/spaces/$slug/settings`

### 4.3 Non-Null Assertions on `Map.get()` (8 instances)

`Map.get()` returns `T | undefined`. Using `!` after `.get()` can crash if the key doesn't exist:

- `use-community.ts:247`
- `use-community-spaces.ts:1224`
- `use-follow.ts:201`
- `profile.tsx:495,662`
- `post-card.tsx:855`
- `sessions-calendar.tsx:256,338`

### 4.4 Non-Null Assertions on Nullable Values

- `projects.$id.tsx:311` — `c.profile!.avatar_url`
- `explore.tsx:657` — `n.projects!.id`
- `profile.tsx:305,1238` — `profile!.id`
- `project-people.tsx:46` — `c.other!.id`
- `use-projects.ts:921,923` — `context.previous!.project`

### 4.5 Suppressed `react-hooks/exhaustive-deps` (9 instances)

All 9 suppressions are deliberate (avoiding re-runs on state changes) with inline comments. Worth auditing periodically.

### 4.6 Duplicated Supabase Client Code

`isNewSupabaseApiKey` and `createSupabaseFetch` are identically copy-pasted across 3 files:
- `integrations/supabase/client.ts:5-29`
- `integrations/supabase/client.server.ts:8-32`
- `integrations/supabase/auth-middleware.ts:8-32`

Marked "automatically generated" — likely a Lovable codegen constraint. A fix to one must be replicated to all three.

### 4.7 Missing Composite Indexes

- `notifications(user_id, read_at, type)` — for category-count queries
- `comments(post_id, created_at)` — for comment count subqueries

### 4.8 Global Search Inline Variant Has No Focus Trapping

**File:** `global-search.tsx:460-485` — The inline variant renders a dropdown that isn't focus-trapped. Tab can escape into the page behind.

### 4.9 Fire-and-Forget Error Swallowing

| File | Line | What's swallowed |
|------|------|-----------------|
| `dashboard.tsx:261` | `checkAndAwardAchievements().catch(() => {})` | Achievement failures |
| `workspace-grid.tsx:202` | `saveRef.current(payload).catch(() => {})` | Layout save failures |
| `use-current-user.ts:110-115` | `safeQuery()` catches all errors silently | Any Supabase query failure |

---

## 5. Test Coverage Gap Summary

### What HAS Tests (24 files, 160 tests)

- 11 lib/utilities files
- 3 hook files (use-teams, use-projects, use-project-scroll-spy)
- 10 component files

### What NEEDS Tests (by priority)

**Critical — data mutation hooks with no safety net:**
- `use-connections.ts`
- `use-follow.ts`
- `use-messages.ts`
- `use-library.ts`
- `use-notifications.ts`
- `use-community.ts` / `use-community-spaces.ts`
- `use-sessions.ts`

**High — flagship views:**
- `project-header.tsx`
- `project-readme.tsx` + `readme-editor.tsx`
- `project-open-roles.tsx`
- `project-people.tsx`
- `profile-layout.tsx`
- `profile-overview-tab.tsx`

**Infrastructure:**
- Extract `createFakeSupabase()` into `tests/helpers/fake-supabase.ts` (currently copy-pasted across 4+ test files)
- Add `vitest --coverage` for actual line/branch coverage numbers

---

## 6. Prioritized Action List

### Immediate (Before Any Public Exposure)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Rotate `.env` secrets + verify git history | 15 min | Security |
| 2 | Fix `useUnreadCounts` unbounded fetch | 1 hr | Performance |
| 3 | Add retry/home to 6 error component stubs | 1 hr | UX |
| 4 | Add `loading="lazy" decoding="async"` to all images | 1 hr | Performance |
| 5 | Add `aria-label` to 7 icon-only buttons | 1 hr | Accessibility |
| 6 | Add `aria-label`/`id` to 6 unlabeled inputs | 1 hr | Accessibility |

### Short-Term (This Sprint)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 7 | Lazy-load project page tabs | 2-3 hr | Performance |
| 8 | Move dashboard under `_authenticated/` | 2-3 hr | Maintainability |
| 9 | Add `aria-current="page"` to sidebar links | 30 min | Accessibility |
| 10 | Add `aria-label` to 5+ `<nav>` elements | 30 min | Accessibility |
| 11 | Replace N+1 profile lookups with joins | 3-4 hr | Performance |
| 12 | Add inline form validation (not just toasts) | 3-4 hr | UX/Accessibility |
| 13 | Remove `d3-force` unused dependency | 5 min | Bundle |
| 14 | Add pagination to unbounded queries | 2-3 hr | Performance |
| 15 | Standardize `42P01` error handling | 1 hr | Consistency |

### Medium-Term (Before v1.0)

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 16 | Replace `as unknown as` casts with Zod validation | 4-6 hr | Type Safety |
| 17 | Add tests for mutation hooks (5 hooks) | 4-6 hr | Reliability |
| 18 | Split `use-community-spaces.ts` into sub-hooks | 2-3 hr | Maintainability |
| 19 | Replace native `confirm()` with styled dialog | 1 hr | UX |
| 20 | Add `width`/`height` to all `<img>` tags | 1 hr | CLS |
| 21 | Add `aria-hidden="true"` to decorative SVGs | 30 min | Accessibility |
| 22 | Add `aria-valuetext` to progress bars | 30 min | Accessibility |
| 23 | Add `role="menu"` to availability dropdown | 1 hr | Accessibility |
| 24 | Reduce redundant `getUser()` in mutations | 1 hr | Performance |
| 25 | Add composite database indexes | 1 hr | Performance |

---

*Generated by full site audit on August 19, 2026.*
