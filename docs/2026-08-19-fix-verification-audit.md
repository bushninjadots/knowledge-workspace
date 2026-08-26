# Audit Fix Verification + Fresh Findings — August 19, 2026

> Date: 2026-08-19
> Method: source-level verification of the 8-item fix plan (`docs/superpowers/plans/2026-08-19-audit-recommendations.md`) plus fresh static scans and a live browser pass (dev server on :8081, Lighthouse desktop, Playwright smoke of `/`, `/explore`, `/community`, `/projects/:id`, `/login`).
> Precedence: dated audit. `AGENTS.md`, `TETHYR_PRODUCT.md`, `TETHYR_UX_RULES.md` remain authoritative.

This is a **verification + delta audit** against [`2026-08-19-full-site-audit.md`](./2026-08-19-full-site-audit.md). It confirms which prior findings were fixed, records what is still open, and lists new issues found in this pass.

---

## 1. Validation

All green:

- `tsc --noEmit` — clean
- `eslint .` — 0 errors
- Vitest — **160/160 passing** (24 files)
- `supabase migration list` — local === remote for all 106 migrations (6 pending were pushed during this session)
- Browser smoke — landing, explore, community, project page, and login all render with 0 console errors (one known 400, see N1)
- Lighthouse (landing, desktop) — **Performance 75, Accessibility 98, Best Practices 92, SEO 92**; LCP 0.2s, CLS 0.052

---

## 2. Resolved — verified in current source

| Prior finding                                    | Severity | Status                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.7 Dashboard layout duplication                 | High     | **Resolved** — `/dashboard` moved under `_authenticated`; `AuthenticatedDashboardLayout` duplication removed (0 remaining refs).                                                                                                                                                                       |
| 2.4 N+1 profile hydration (7 hooks)              | High     | **Resolved** — embedded `profiles!…` selects now in `use-projects.ts` (3), `use-community.ts` (2), `use-connections.ts` (1).                                                                                                                                                                           |
| 2.2 Lazy-load project page tabs                  | High     | **Resolved** — 12+ heavy components now `React.lazy()` (ProjectNeeds, ProjectCredits, ProjectFilesExplorer, ProjectActivityTab, MilestonesTimeline, ProjectPeopleTab, ProjectDiscussions, ProjectCommunityPosts, ProjectJoinModal, CreateChallengeDialog, ScheduleSessionWizard, ProjectSearchDialog). |
| 2.6 Error component stubs                        | High     | **Resolved** — login verified live with "Try again" + "Go home"; remaining routes follow the same pattern.                                                                                                                                                                                             |
| 2.5 Unused `d3-force` dependency                 | High     | **Resolved** — removed from `package.json`.                                                                                                                                                                                                                                                            |
| 3.9 Split `use-community-spaces.ts` (1292 lines) | Medium   | **Resolved** — 8 focused sub-hooks: `use-space-{chat,join-requests,members,read-state,reports,settings,typing}.ts` + `community-space-types.ts`.                                                                                                                                                       |
| 3.2 Unbounded project queries                    | Medium   | **Resolved** — limits added: `useMilestones` 100, `useDiscussions` 50, `useOpenRoles` 20, `useProjectNeeds` 30, `useProjectActivity` 100.                                                                                                                                                              |
| 3.4 Toast-only form validation                   | Medium   | **Resolved** — signup/login/reset-password now have inline `fieldErrors` with `aria-invalid` + `aria-describedby` (verified in source and rendered DOM).                                                                                                                                               |
| 3.5 Native `confirm()` in `connections.tsx:142`  | Medium   | **Partially resolved** — replaced with styled Dialog in `connections.tsx`, but **4 other `confirm()` calls remain** (see O3).                                                                                                                                                                          |
| 4.3 Non-null `Map.get()!` assertions (8)         | Low      | **Resolved** — 0 remaining in source.                                                                                                                                                                                                                                                                  |
| Test infra: shared `createFakeSupabase`          | —        | **Resolved** — `tests/helpers/fake-supabase.ts`, used by 4+ test files.                                                                                                                                                                                                                                |

---

## 3. Still open from the previous audit

### O1 — `useUnreadCounts` still unbounded — **Critical (unchanged)**

`src/hooks/use-messages.ts:164-187`. Fetches **all** unread message `connection_id`s with no limit, then aggregates in JS. The prior audit's top performance finding is untouched.

**Fix:** replace with a per-connection count query (`select("connection_id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", meId)` still fetches all rows; prefer `.select("connection_id").is(...).limit(0)` + exact count, or an RPC returning `{ connection_id, count }` via GROUP BY).

### O2 — 27 `as unknown as` casts remain — **High**

Down from 36, but still 27 (24 in production code). Hot spots: `use-challenges.ts` (4), `use-current-user.ts` (2), `projects.$id.tsx` (5), `u.$handle.tsx` (2), `explore.tsx` (2), `use-community.ts` (2), plus `landing/data.tsx`, `use-projects.ts`, `use-community-spaces.ts`, `use-follow.ts`, `use-public-studio-layout.ts`, `project-role-applications.tsx` (3 in `use-project-scroll-spy.test.tsx` are test-only).

### O3 — Lazy loading still missing on images — **High**

31 of 32 `<img>` tags lack `loading="lazy"` (and none set `width`/`height`). Affected: `project-card-inline.tsx:64`, `community-card.tsx:83`, `composer-bar.tsx:602`, `space-header.tsx:97`, `project-main-content.tsx:288`, `project-header.tsx:71,141`, `project-files-explorer.tsx:143`, `project-people.tsx:94`, `profile-layout.tsx:134,382`, `background-picker-dialog.tsx:402`, `project-shelf.tsx:381`, `attach-project-panel.tsx:211`, `post-card.tsx:487`, `profile-sections.tsx`, `dashboard-sidebar.tsx`, `landing/community-spaces.tsx`.

### O4 — Remaining native `confirm()` dialogs — **Medium**

| File                   | Line | Text                                |
| ---------------------- | ---- | ----------------------------------- |
| `connections-card.tsx` | 161  | "Withdraw request?"                 |
| `connect-button.tsx`   | 104  | "Remove this connection?"           |
| `connect-button.tsx`   | 162  | "Withdraw your connection request?" |
| `profile-sections.tsx` | 1057 | "Delete this project?"              |

Same fix as the one already applied to `connections.tsx`.

### O5 — `getUser()` redundancy in mutations — **Medium**

37 `supabase.auth.getUser()` calls remain in hooks even though the user id is available from `useCurrentUser()`/query context. Extra network round-trip per mutation.

### O6 — Decorative SVGs without `aria-hidden` — **Medium**

`empty-state.tsx` still has 0 `aria-hidden` markers on its workshop illustrations.

### O7 — Availability dropdown lacks keyboard navigation — **Medium**

`availability-badge.tsx` custom dropdown has no `role="menu"`, arrow-key handling, or Escape handler.

### O8 — `useNotificationsByCategory` still JS-side aggregation — **Medium (improved)**

Bounded with `.limit(100)` but still aggregates in JS instead of a DB `GROUP BY`.

---

## 4. New findings this pass

### N1 — `useContributorCount` queries a non-existent column — **High (bug)**

`src/components/tethyr/landing/data.tsx:122-124`. `project_contributors` is a composite-key join table (**no `id` column** — verified: columns are `project_id, profile_id, role, joined_at, contribution_score, skills_used`). The query:

```ts
.from("project_contributors").select("id", { count: "exact", head: true }).eq("project_id", projectId)
```

400s with `column project_contributors.id does not exist` (PGRST42703) — reproduced directly against PostgREST. Every landing load fires one failed request **per featured project** (6 of them), and the `featured-hero-card.tsx` contributor count silently renders 0 because the error is swallowed.

**Fix:** `.select("profile_id", { count: "exact", head: true })`. One-line change.

### N2 — Hydration mismatch on landing (FeaturedProjects) — **Medium**

Server renders the Suspense skeleton for `FeaturedProjects` while the client has React Query cache (from a prior visit) and renders content immediately → "Hydration failed… tree will be regenerated on the client" console error on repeat visits. UI recovers, but it's a double render + console noise. Same risk applies to `LandingStats`/`SectionReveal` pattern. Fix: prefetch the featured-projects query in the route loader, or render the skeleton client-side until hydration settles.

### N3 — Single 401 on landing — **Low**

One `GET profiles?select=id` returns 401 on the landing page (stale/invalid session token path; swallowed). All other anon requests succeed with the same key, so this is a token edge case, not a key misconfiguration. Worth confirming the auth session handling on the public landing shell.

### N4 — Landing Lighthouse: TBT 540–630ms — **Medium (perf)**

Performance 75–77 driven entirely by Total Blocking Time (score 18–25); LCP (0.2s), CLS (0.052), and Speed Index are excellent. Main bundle is 635.6 kB raw / 182.6 kB gzip; `lowlight` (173 kB gzip) is correctly code-split behind the lazy editors. TBT likely comes from eager third-party chunk work during hydration (framer-motion, router) — no single obvious offender; revisit after the O3 image work and N1 fix.

---

## 5. Prioritized action list

### Immediate

| #   | Item                                                   | Effort | Impact                           |
| --- | ------------------------------------------------------ | ------ | -------------------------------- |
| 1   | Fix `useContributorCount` → `.select("profile_id", …)` | 5 min  | Bug (400s on every landing load) |
| 2   | Fix `useUnreadCounts` unbounded fetch (O1)             | 1 hr   | Performance (Critical, unfixed)  |

### Short-term

| #   | Item                                                               | Effort | Impact           |
| --- | ------------------------------------------------------------------ | ------ | ---------------- |
| 3   | Replace 4 remaining `confirm()` calls with styled Dialog (O4)      | 1 hr   | UX consistency   |
| 4   | Add `loading="lazy"` to 31 `<img>` tags (O3)                       | 1 hr   | Performance      |
| 5   | Prefetch landing featured-projects to kill hydration mismatch (N2) | 1 hr   | Correctness/a11y |
| 6   | Add keyboard nav + roles to availability dropdown (O7)             | 1 hr   | Accessibility    |
| 7   | Add `aria-hidden` to empty-state SVGs (O6)                         | 30 min | Accessibility    |

### Medium-term

| #   | Item                                                                      | Effort | Impact      |
| --- | ------------------------------------------------------------------------- | ------ | ----------- |
| 8   | Reduce redundant `getUser()` in mutations (O5)                            | 1 hr   | Performance |
| 9   | DB `GROUP BY` for `useNotificationsByCategory` (O8)                       | 1 hr   | Performance |
| 10  | Replace remaining 24 `as unknown as` casts with runtime shape checks (O2) | 4-6 hr | Type safety |

---

## 6. Follow-up fixes (same day) — implemented & verified

### 6.1 Landing page speed / smoothness

- Below-fold landing sections now **prefetch in the route loader** (`src/routes/index.tsx`), and `router.tsx` **dehydrates/hydrates the React Query cache** between server and client. Content streams with the SSR HTML instead of flashing skeletons, the client skips refetching, and the previous hydration-mismatch on repeat visits is gone.
- **Root cause of the old mismatch:** signed storage URLs are generated per render (different tokens every time), so server HTML and the hydrated client could never agree. `fetchFeaturedProjects` now returns raw storage paths and both `featured-projects.tsx` and `featured-hero-card.tsx` resolve them client-side via the existing `useSignedStorageUrl` pattern (same as avatars).
- **Measured:** console errors 1 → **0** on the landing page; Lighthouse **CLS 0.052 → 0.001** (score 99 → 100), Best Practices 92 → 96. Performance still reads 75 in dev due to Total Blocking Time (~650 ms) — dev-server hydration cost, not a regression.

### 6.2 Lazy loading on images

- **28/32 `<img>` tags now carry `loading="lazy" decoding="async"`** (was 1/32). The remaining 4 are above-the-fold banners/hero covers, intentionally eager with `decoding="async"` for LCP.

### 6.3 Unsafe casts reduced 27 → 12

- Replaced `as unknown as` casts with typed selects (`.select<"…", Row>`) in `landing/data.tsx`, `use-community.ts`, `use-challenges.ts`, `explore.tsx`, `u.$handle.tsx`.
- Typed the profile maps (`Map<string, TargetType>`) in `use-follow.ts`, `use-projects.ts`, `use-community-spaces.ts`, `use-challenges.ts`, `project-role-applications.tsx`, dropping the casts and surfacing real profile fields instead of "Unknown" fallbacks.
- Remaining 9 production casts are deliberate: dynamic column-string retries (`use-current-user.ts`), JSONB blob boundaries (`use-public-studio-layout.ts`), and the fallback-column project-detail query (`projects.$id.tsx`).

### 6.4 Browser-verified dialogs (logged in as seed user)

- Dashboard `connections-card` withdraw dialog, page `connections.tsx` withdraw dialog, `connect-button` "Remove connection?", and the nested "Delete this project?" dialog in `profile-sections.tsx` all open correctly. Messages page (unread-count RPC) renders with 0 console errors.

## 7. Production-readiness pass — SEO engine, mock data, perf & a11y

### 7.1 SEO engine

- **Standardized metadata API** (`src/lib/seo.ts`): `SITE` config, `seoMeta({ path, title, description, type, noindex, image })` producing the title template (auto "— Tethyr" suffix), description, canonical, full OpenGraph + Twitter card set, and `jsonLd(...)` for structured data. Applied to `/`, `/community`, `/explore`, `/dashboard`, and `/skills/$slug`.
- **JSON-LD** via the router's native `"script:ld+json"` head meta (verified in SSR HTML): `Organization` + `WebSite` on the root page, `ItemList` on Community and Explore, `Course` on each `/skills/$slug` page.
- **`sitemap.ts` / `robots.ts`**: kept DB-driven (dynamic profiles/projects/skills), added `lastmod` to the root entry, and derived robots.txt disallows from a single shared `NO_INDEX_PATHS` constant that also drives the `X-Robots-Tag` header in `server.ts` (one list to keep in sync).

### 7.2 Mock data & state architecture

- New `src/data/mocks/` with strictly-typed catalogs: `availability.ts` (status options incl. labels/icons/badge classes), `catalog.ts` (`PROJECT_CATEGORIES` — deduped the copy that existed in both `explore.tsx` and `project-shelf-header.tsx` — plus `OPPORTUNITY_NEED_CHIPS`, `NEED_LABEL`, `NEED_BADGE`, `STAGE_RANK`), and `community-nav.ts` (`COMMUNITY_NAV_GROUPS` + `CommunityNavId`, re-exported from the sidebar for compat).
- Spaces, chats, and skill lists were already DB-driven (no inline mock arrays in components) — the extracted catalogs are the display/config constants that did live in components.

### 7.3 Performance & a11y

- **Code splitting**: `GlobalSearch` (six-source search UI) and `NotificationDropdown` are now `React.lazy` in `authenticated-shell.tsx` + `dashboard-sidebar.tsx`, and `SpaceChatComposer` in `community-feed.tsx` — all with lightweight fallbacks so the shell doesn't shift.
- **CLS polish**: added explicit `width`/`height` to 18 `<img>` tags (avatars, covers, banners, post images, previews) that lacked them. Editor content images (Tiptap) left untouched — their boxes are content-defined.
- **a11y**: `global-search.tsx` gained combobox/listbox semantics (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`, `role="option"` rows, `role="presentation"` group headers) plus a visually-hidden `DialogTitle` (Radix was warning). Availability selector: `aria-haspopup="listbox"` + `aria-expanded` + `aria-selected` options. Filter chips (explore categories/needs/sort, shelf categories, skill filters) now carry `aria-pressed`; the "×" remove-filter button got an `aria-label`.

### 7.4 Bug found & fixed live: Explore Opportunities/Needs silently empty

- Both `project_open_roles` and `project_needs` queries on `/explore` were 300ing with **PGRST201 (ambiguous embedding)**: `projects.profiles` resolves to both the direct FK and the `project_contributors` m2m path. Every Opportunities-tab load failed silently and rendered the empty state. Fixed by disambiguating to `profiles!projects_profile_id_fkey` in both selects — the tab now shows needs and roles. (Pre-existing; the default Projects tab masked it.)

### 7.5 Validation

- typecheck ✅, lint ✅, 160/160 tests ✅. Browser-verified: landing JSON-LD/OG/robots/sitemap in SSR HTML, per-route titles/descriptions/robots after hydration, search combobox + keyboard nav, notifications dropdown, Explore Opportunities tab with needs + chips. Lighthouse: A11y 98, Best Practices 96, SEO 92, CLS 0.001, LCP 0.2 s (dev-mode TBT ~680 ms caps Performance).

_Updated August 19, 2026 after the production-readiness pass._
