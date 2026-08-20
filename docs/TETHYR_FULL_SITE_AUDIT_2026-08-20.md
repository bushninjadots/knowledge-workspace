# Tethyr Full Site Audit — 2026-08-20

**Type:** Fresh end-to-end audit (ground-up, ignoring prior findings)
**Date:** 2026-08-20
**Baseline:** 262 source files, 39 test files, 115 migrations, 253 tests passing, typecheck clean, build succeeds

---

## Executive Summary

| Domain | P0 | P1 | P2 | P3 | Total |
|--------|----|----|----|----|-------|
| Code Quality & Architecture | 0 | 4 | 7 | 4 | 15 |
| UX & Design System | 0 | 5 | 8 | 6 | 19 |
| Accessibility | 5 | 5 | 6 | 3 | 19 |
| Security & RLS | 2 | 4 | 3 | 1 | 10 |
| Performance & Bundle | 3 | 5 | 4 | 3 | 15 |
| **TOTAL** | **10** | **23** | **28** | **17** | **78** |

**Critical themes:**
1. **10 P0s** — 5 accessibility (missing skip nav, unlabeled forms, unlabeled landmarks), 3 performance (unbounded queries), 2 security (SSRF in edge function, `.env` in git history)
2. **Unbounded queries** are the most widespread issue — 7 queries lack `.limit()` and will degrade as data grows
3. **Accessibility has the most P0s** — fundamental keyboard/screen reader barriers exist
4. **Security has 2 real P0s** — the edge function SSRF is the most actionable; the `.env` in git history needs key rotation confirmation
5. **Code quality is strong** — zero `as any`, clean TypeScript, good test patterns, just needs cleanup of duplication and the 1693-line monolith

---

## P0 — Critical (10 items)

### Security

**S1. Edge function SSRF — fetches arbitrary user-supplied URLs server-side**
- `supabase/functions/fetch-project-preview/index.ts:48,71,94,114`
- The Open Graph fallback path does `await fetch(url)` on raw user input with no URL validation or allowlist. Attacker can probe internal services, access cloud metadata endpoints, bypass firewalls.
- **Fix:** Block private IPs, allowlist protocols, remove or restrict the OG fallback path.

**S2. `.env` with publishable keys committed to git history**
- Git history (commit `784841a`). File was removed but credentials remain in history.
- **Fix:** Confirm old Supabase project/key pair is deactivated. Rotate if still active.

### Accessibility

**A1. No skip navigation link**
- `src/routes/__root.tsx:125` — No skip link as first focusable element. Keyboard users must Tab through 10+ nav links on every page load.
- **WCAG:** 2.4.1 Bypass Blocks
- **Fix:** Add sr-only skip link anchoring to `<main id="main-content">`.

**A2. Follow button has no toggle state for assistive tech**
- `src/components/tethyr/follow-button.tsx:63` — No `aria-pressed` attribute.
- **WCAG:** 4.1.2 Name, Role, Value
- **Fix:** Add `aria-pressed={isFollowing}`.

**A3. Radix Progress bar has no accessible value**
- `src/components/ui/progress.tsx:13` — No `aria-label`, `aria-valuenow`, or visible text.
- **WCAG:** 1.1.1, 4.1.2
- **Fix:** Pass `aria-label` to Progress component.

**A4. Multiple unlabeled `<nav>` landmarks**
- `src/components/tethyr/community/left-sidebar.tsx:39` — No `aria-label`. Screen readers can't distinguish between navs.
- **WCAG:** 1.3.1
- **Fix:** Add `aria-label` to every `<nav>`.

**A5. Create Challenge dialog form inputs missing labels**
- `src/components/tethyr/community/create-challenge-dialog.tsx:129-183` — Inputs use placeholder only, no `<label>` or `aria-label`.
- **WCAG:** 1.3.1, 3.3.2
- **Fix:** Add `<Label htmlFor>` or `aria-label` to each input.

### Performance

**P1. useCurrentUser fetches ALL user projects without limit**
- `src/hooks/use-current-user.ts:152-159` — No `.limit()`. Every page load fetches full project list with `*` columns.
- **Fix:** Add `.limit(50)`, select only needed columns.

**P2. useMyProjects fetches ALL user projects without limit**
- `src/hooks/use-projects.ts:873-877` — Same pattern, no limit.
- **Fix:** Add `.limit(50)`.

**P3. useCommunitySpaces fetches ALL spaces without limit**
- `src/hooks/use-community-spaces.ts:70-73` — Unbounded, scales linearly with space count.
- **Fix:** Add `.limit(100)`, implement pagination.

---

## P1 — High (23 items)

### Code Quality (4)

**C1. Duplicate type definitions: `SkillVerificationLevel` and `SkillExperienceLevel`**
- `src/hooks/use-current-user.ts:59-60` and `src/components/tethyr/profile-sections.tsx:84,100` — Identical types in two modules.
- **Fix:** Define once, re-export from the other.

**C2. Dead re-export in `use-current-user.ts`**
- `src/hooks/use-current-user.ts:7,9` — `ProjectRow` and `ActivityRow` imported and re-exported but never consumed from this path.
- **Fix:** Remove dead re-export.

**C3. `profile-sections.tsx` is a 1693-line monolith**
- 20+ exports spanning types, constants, inline components, and a 640-line CRUD dialog.
- **Fix:** Split into focused modules (types, badges, cards, dialog, timeline).

**C4. `as unknown as` type casts in production code (12 instances)**
- 12 double-casts across `projects.$id.tsx`, `use-current-user.ts`, `use-public-studio-layout.ts`, `seo.ts`.
- **Fix:** Fix Supabase queries to select correct shape, or add Zod validation.

### UX & Design System (5)

**U1. `rounded-[2.5rem]` CTA violates border radius scale**
- `src/routes/index.tsx:250` — 2.5rem radius exists nowhere in the design system scale.
- **Fix:** Use `rounded-xl` or `rounded-full`.

**U2. `rounded-2xl` on team avatar — inconsistent with avatar radius**
- `src/components/tethyr/team/team-page.tsx:281` — Should be `rounded-full` per design system.
- **Fix:** Change to `rounded-full` or `rounded-xl`.

**U3. Excessive `shadow-2xl` on 3 custom overlays**
- `global-search.tsx:559`, `project-shelf-overlay.tsx:142`, `project-join-modal.tsx:58`
- **Fix:** Replace `shadow-2xl` → `shadow-lg` on custom overlays.

**U4. `font-title` vs `font-display` inconsistency (8 places)**
- `challenges.tsx`, `empty-state.tsx`, `post-card.tsx`, `challenges-section.tsx`, `community-header.tsx`, `space-header.tsx`, `project-header.tsx`
- **Fix:** Replace all `font-title` → `font-display`.

**U5. Inline error components duplicate error page markup**
- `community.tsx:48-63`, `messages.tsx:31-56` — Identical error markup, not using shared `ErrorComponent`.
- **Fix:** Remove inline `errorComponent` definitions; use root-level or shared component.

### Accessibility (5)

**A6. Dashboard has duplicate `<h1>` headings**
- `src/routes/_authenticated/dashboard.tsx:54` and `:391`
- **WCAG:** 1.3.1
- **Fix:** Demote second heading to `<h2>`.

**A7. Trophy icon uses `aria-label` on non-interactive element without `role="img"`**
- `src/components/tethyr/project/project-header.tsx:175`
- **WCAG:** 1.1.1
- **Fix:** Add `role="img"`.

**A8. Signup "Your main craft" label disconnected from buttons**
- `src/routes/signup.tsx:110-128` — No `htmlFor`, not in `<fieldset>`/`<legend>`.
- **WCAG:** 1.3.1
- **Fix:** Wrap in `<fieldset>` with `<legend>`.

**A9. Multiple `<main>` landmarks on authenticated pages**
- `src/components/tethyr/navbar.tsx:54` and `src/components/tethyr/authenticated-shell.tsx:122`
- **WCAG:** 1.3.1
- **Fix:** Remove `<main>` from navbar; keep only in shell.

**A10. Messages textarea missing label**
- `src/routes/_authenticated/messages.tsx:407-414` — Placeholder only, no `aria-label`.
- **WCAG:** 3.3.2
- **Fix:** Add `aria-label="Message text"`.

### Security (4)

**S3. Edge function CORS allows all origins**
- `supabase/functions/fetch-project-preview/index.ts:5` — `Access-Control-Allow-Origin: *`
- **Fix:** Restrict to application origin.

**S4. Edge function leaks internal error messages**
- `supabase/functions/fetch-project-preview/index.ts:149-153` — Returns `err.message` directly.
- **Fix:** Return generic error, log details server-side.

**S5. `connected_accounts.access_token` exposed to client via RLS**
- `supabase/migrations/20260807000000_project_repositories.sql:70-72`
- **Fix:** Exclude column from client queries, or encrypt at rest.

**S6. `project_repositories` public-read ignores private projects**
- `supabase/migrations/20260807000000_project_repositories.sql:20-22` — `USING (true)` blanket policy.
- **Fix:** Replace with `public.is_project_visible(project_id)`.

### Performance (5)

**P4. lowlight chunk is 480KB — largest client bundle**
- `.output/public/assets/lowlight-BJw2BDUf.js`
- **Fix:** Use `highlight.js/lib/core` with only 4 languages, or evaluate `shiki`.

**P5. Main app chunk is 418KB — too large for initial load**
- `.output/public/assets/index-4ndFt-bc.js`
- **Fix:** Audit with `vite-bundle-analyzer`, lazy-load Radix components not needed on first paint.

**P6. WorkspaceGrid not lazy-loaded on dashboard**
- `src/routes/_authenticated/dashboard.tsx:28` — `react-grid-layout` imported eagerly.
- **Fix:** Lazy-load WorkspaceGrid.

**P7. framer-motion imported eagerly via SectionReveal**
- `src/routes/index.tsx` → `section-reveal.tsx` → `framer-motion` (384KB)
- **Fix:** Lazy-load SectionReveal or extract useReducedMotion check.

**P8. client chunk is 205KB**
- `.output/public/assets/client-Du_W3t_4.js` — Framework overhead, limited optimization possible.

---

## P2 — Moderate (28 items)

### Code Quality (7)

**C5. Duplicate `relTime` function** — `profile-sections.tsx:1636-1644` reimplements `timeAgo` from `src/lib/time.ts`.

**C6. Duplicate `TYPE_ICONS`/`TYPE_COLORS`** — `library-search-bar.tsx` and `item-card.tsx` have identical maps.

**C7. `ACTION_ICON`/`TYPE_ICON` overlap** — `composer-bar.tsx` and `post-card.tsx` have conflicting icon maps for the same types.

**C8. Direct Supabase calls in 14 components** — Bypasses the hook layer, scatters data logic.

**C9. Migration naming inconsistency** — 23 of 115 use UUID names vs descriptive.

**C10. `data/mocks/` contains real constants** — Misleading directory name.

**C11. Test coverage gap** — 39 test files for 262 source files (15%). Major untested areas: routes, large hooks, community composer.

### UX & Design System (8)

**U6. `backdrop-blur` on 40+ elements** — GPU-intensive, visual noise. Reserve for nav/header only.

**U7. Raw `<button>` bypassing design system** — Error components use hand-written Tailwind instead of `<Button>`.

**U8. `bg-[#24292e]` hardcoded color** — GitHub brand color, should be documented or tokenized.

**U9. `shadow-sm` on message input bar** — Inconsistent with other inputs.

**U10. Mixed responsive breakpoints** — `md:grid-cols-2` vs `sm:grid-cols-2` for same patterns.

**U11. `text-gradient-brand` on landing CTA** — Verify it exists in CSS.

**U12. `shadow-glow-green` on landing badge** — Violates "no glows" rule, needs documentation.

**U13. Card radius inconsistency** — Some surfaces bypass Card primitive with `rounded-lg` or `rounded-xl`.

### Accessibility (6)

**A11. Heading hierarchy skips levels** — `skills.$slug.tsx` and `explore.tsx` go h1→h3.

**A12. Form inputs using placeholder-only labels** — Settings URL input, messages textarea.

**A13. Loading state announcements inconsistent** — Some use `role="status"`, others don't.

**A14. Sessions page uses div-based cards** — Should use `<ul>`/`<li>` for screen reader list count.

**A15. Join Project modal close button redundant `aria-label`** — Duplicate "Close" announcements.

**A16. Community sidebar `<nav>` missing accessible name** — Duplicate of A4, specific location.

### Security (3)

**S7. CSP allows `unsafe-inline` for scripts** — Weakens XSS protection. Migrate to nonce-based CSP.

**S8. Authenticated route guard is client-side only** — `ssr: false`. Acceptable for current architecture but should be documented.

**S9. No server-side password complexity enforcement** — Only 8-char minimum, client-side only.

### Performance (4)

**P9. useFollowers/useFollowing have no limit** — `src/hooks/use-follow.ts:42-46,65-69`

**P10. useConnections fetches ALL connections** — `src/hooks/use-connections.ts:42-47`

**P11. useSessions fetches ALL sessions** — `src/hooks/use-sessions.ts:144-153`

**P12. Post hydration logic duplicated 3 times** — `use-community.ts`, `use-follow.ts`, `use-community-spaces.ts`

---

## P3 — Low (17 items)

### Code Quality (4)

**C12.** `@ts-expect-error` in `router.tsx:21` — Documented, acceptable.
**C13.** `const sb = supabase` alias in 28 files — No functional benefit.
**C14.** `console.error`/`console.warn` in 9 production files — Intentional, not structured.
**C15.** `use-community.ts` is 631 lines mixing types/queries/mutations — Well-organized internally.

### UX & Design System (6)

**U14.** `rounded-full` on badges/tags — Correct and consistent.
**U15.** `font-display` used consistently for headings — 67 uses, only 8 `font-title` exceptions.
**U16.** Responsive grids are well-implemented — 71 responsive patterns, mostly correct.
**U17.** Blanket styling on `<body>`/`html` in root layout — Standard pattern.
**U18.** No `rounded-3xl` found — Correct, not in design system.
**U19.** `rounded-full` on CreateProjectButton — Inconsistent pill shape.

### Accessibility (3)

**A17.** Decorative SVGs in empty state — `aria-hidden="true"` is correct, but no heading for context.
**A18.** Landing page sections use `<div>` instead of `<section>` with `aria-labelledby`.
**A19.** Sonner toast — Verify internal ARIA handling, add defensive `aria-live`.

### Security (1)

**S10.** `console.error` in auth middleware logs env var names — Non-sensitive, acceptable.

### Performance (3)

**P13.** useTrendingSkills fetches ALL skills + related rows — Should be RPC/materialized view.
**P14.** useTodaySessions fetches ALL platform sessions — Should filter by user.
**P15.** useSpaceReportHistory fetches 500 reports globally — Should filter server-side.

---

## Positives — What's Done Well

### Code Quality
- Zero `as any` in application code (only auto-generated `routeTree.gen.ts`)
- No `@ts-ignore` usage anywhere
- TypeScript strict mode is clean
- Strong security awareness (`safeHref`, `isSafeUrl`, `validateImageFile`, `friendlyError`)
- Good separation of concerns in `src/lib/`
- Consistent hook patterns across the codebase
- 92 of 115 migrations use descriptive names
- ESLint config is clean and purposeful
- 253 tests passing, typecheck clean, build succeeds

### UX & Design System
- Card primitive used consistently (`border card-border bg-surface rounded-md`)
- Badge/tag system well-defined (`rounded-full` on all pills)
- Responsive grids are mobile-first (`sm:grid-cols-2` → `lg:grid-cols-3` → `xl:grid-cols-4`)
- Typography hierarchy mostly consistent (`font-display` in 67 places)
- Color tokens well-used (`bg-surface`, `bg-surface-elevated`, `--user-accent`)
- Section-before-container pattern followed
- Whitespace is intentional (`py-24`, `py-32`, `gap-6`, `gap-8`)

### Accessibility
- `<html lang="en">` correctly set
- Reduced motion support via `useReducedMotion()` + CSS media query
- SegmentedControl implements proper ARIA tabs pattern
- Mobile primary nav uses `aria-label` and `aria-current="page"`
- Radix UI handles focus trapping, Escape, focus return
- Theme toggle has descriptive `aria-label`
- Search dialog uses `role="listbox"` and `aria-activedescendant`
- OAuth buttons have descriptive `aria-label`
- Notification dropdown shows unread count as visible text
- 100+ `aria-label` instances across the codebase

### Security
- RLS is comprehensive across 115 migrations
- Private project visibility enforced at DB level via `is_project_visible()`
- GitHub tokens are server-only (`user_github_tokens` has no client RLS)
- Membership privilege guards prevent self-elevation
- Challenge review enforced via SECURITY DEFINER trigger
- CSRF protection in place
- Auth middleware properly validates JWT tokens
- Open redirect protection is solid
- Storage upload hardening is thorough
- No hardcoded secrets in source code
- `.env` properly gitignored

### Performance
- 22 `React.lazy()` calls for code splitting
- Paginated community feed with cursor-based pagination
- Most queries bounded with `.limit()`
- RPC for aggregation (`unread_message_counts`)
- Stale time configured thoughtfully
- Optimistic updates well-implemented
- Module-level singleton channels for realtime
- date-fns imported selectively
- Images in `public/` are minimal

---

## Recommended Priority Order

### Immediate (this week)
1. **S1** — Fix edge function SSRF (security P0)
2. **A1** — Add skip navigation link (accessibility P0)
3. **P1-P3** — Add `.limit()` to 3 unbounded queries (performance P0)
4. **S5** — Exclude `access_token` from client queries (security P1)

### Short-term (next 2 weeks)
5. **A2-A5** — Fix 4 accessibility P0s (labels, landmarks, toggle state)
6. **S3-S4** — Fix edge function CORS and error leakage (security P1)
7. **S6** — Fix `project_repositories` public-read for private projects (security P1)
8. **U1-U5** — Fix 5 design system violations (UX P1)
9. **C1-C4** — Fix code quality issues (monolith, duplication, casts)
10. **A6-A10** — Fix accessibility P1s (headings, labels, landmarks)

### Medium-term (1 month)
11. **P4-P8** — Bundle optimization (lazy loading, chunk splitting)
12. **U6-U13** — Design system consistency (backdrop-blur, buttons, responsive)
13. **A11-A16** — Accessibility P2s (heading hierarchy, forms, loading states)
14. **C5-C11** — Code quality P2s (duplication, test coverage)
15. **P9-P15** — Performance P2s (social graph limits, hydration dedup)

### Low priority (when time allows)
16. All P3 items across all domains

---

*Audit conducted by 5 parallel agents (code quality, UX/design, accessibility, security, performance) and consolidated into this report.*
