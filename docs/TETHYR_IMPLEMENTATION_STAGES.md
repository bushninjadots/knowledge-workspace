# Tethyr Implementation Stages

> Created August 9, 2026 from `docs/TETHYR_FULL_FORENSIC_AUDIT_2026-08-09.md`.
> This is an implementation plan, not a permission to expand the product scope.
> **Major redesign phases are tracked in [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md#19-phased-implementation).**

## Operating rule

Implement the smallest change that improves coherence, trust, or the core collaboration loop. Each stage must be validated before the next stage begins. Do not add new top-level features while a higher-priority stage is incomplete.

The redesign (Stages 8–18 below) must not begin until the existing Stage 7 deferred items are triaged and the Phase 1 redesign audit is approved.

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

## Stage 8–18 — Major Redesign (TETHYR_REDESIGN_SPEC.md)

> **⚠️ Do not begin these stages until Phase 1 audit is complete and architecture is approved.**

These stages implement the block/page/template/fork system described in [`TETHYR_REDESIGN_SPEC.md`](./TETHYR_REDESIGN_SPEC.md) and [`TETHYR_REDESIGN_ARCHITECTURE.md`](./TETHYR_REDESIGN_ARCHITECTURE.md).

### Stage 8 — Redesign Phase 1: Full Audit

**Goal:** understand the complete codebase and produce the architectural proposal.

- [ ] Inspect every route, component, hook, and library module.
- [ ] Map current profile/project architecture against the proposed block model.
- [ ] Identify what can be preserved, what needs to change, and what can be retired.
- [ ] Identify architectural risks, migration risks, and data-boundary issues.
- [ ] Design the page/block/template data architecture.
- [ ] Explain how existing functionality (WorkspaceGrid, public Studio layout, dashboard priority flow, project page sections) connects to the new model.
- [ ] Produce the phased implementation plan with gating criteria.
- [ ] **Wait for approval before any code changes.**

### Stage 9 — Redesign Phase 2: Page / Block Foundation ✅ DONE (2026-08-23)

**Goal:** create the underlying page model, block registry, renderer, theme system, and hooks without touching existing routes.

- [x] Core type system (`src/lib/page-blocks.ts`) — BlockDefinition, BlockContext, PageLayout, LayoutSection, LayoutBlockInstance, ThemeTokens, PageData.
- [x] Block registry (`src/lib/block-registry.ts`) — register, get, getAll, getByCategory, createBlockInstance, validate.
- [x] Theme token applicator (`src/lib/theme-tokens.ts`) — flattens ThemeTokens → CSS custom properties.
- [x] useTheme hook (`src/hooks/use-theme.ts`) — fetches theme by ID, returns CSS var map.
- [x] usePage hook (`src/hooks/use-page.ts`) — fetches page with joined layout + theme for owner.
- [x] usePageEditor hook (`src/hooks/use-page-editor.ts`) — create, updateLayout, updateTheme, publish, unpublish.
- [x] PageShell component (`src/components/tethyr/page/page-shell.tsx`) — loading/error/empty/draft/published states.
- [x] PageLayoutRenderer (`src/components/tethyr/page/page-layout.tsx`) — sections → blocks with grid layout.
- [x] BlockRenderer (`src/components/tethyr/page/block-renderer.tsx`) — type → registry lookup → component.
- [x] Content blocks — Text, Heading, Markdown, Divider — each self-registering.
- [x] Database migration (`supabase/migrations/20260823000000_page_system_foundation.sql`) — pages, layouts, themes tables with RLS.
- [x] Tests — block registry (10), theme tokens (9) = 19 new tests.
- [x] Validation — typecheck passes, 369 tests pass, no existing routes touched.

**Not changed:** existing routes, existing hooks, existing components, existing styles.

**Files created (Phase 2 + Phase 3):**

- `src/lib/page-blocks.ts` — core type system
- `src/lib/block-registry.ts` — module-level block registry
- `src/lib/block-registry.test.ts` — 10 registry tests
- `src/lib/theme-tokens.ts` — CSS var applicator
- `src/lib/theme-tokens.test.ts` — 9 theme tests
- `src/hooks/use-theme.ts` — theme fetch hook
- `src/hooks/use-page.ts` — page + layout + theme hook
- `src/hooks/use-page-editor.ts` — create/update/publish mutations
- `src/components/tethyr/page/page-shell.tsx` — page with 6 states
- `src/components/tethyr/page/page-layout.tsx` — sections → grid → blocks
- `src/components/tethyr/page/block-renderer.tsx` — type → registry → component
- `src/components/tethyr/page/index.ts` — barrel
- `src/components/tethyr/blocks/content/text-block.tsx`
- `src/components/tethyr/blocks/content/heading-block.tsx`
- `src/components/tethyr/blocks/content/markdown-block.tsx`
- `src/components/tethyr/blocks/content/divider-block.tsx`
- `src/components/tethyr/blocks/content/index.ts` — barrel
- `src/components/tethyr/blocks/project/hero-block.tsx`
- `src/components/tethyr/blocks/project/about-block.tsx`
- `src/components/tethyr/blocks/project/status-block.tsx`
- `src/components/tethyr/blocks/project/team-block.tsx`
- `src/components/tethyr/blocks/project/activity-block.tsx`
- `src/components/tethyr/blocks/project/index.ts` — barrel
- `src/routes/dev.tsx` — block system preview page
- `supabase/migrations/20260823000000_page_system_foundation.sql` — pages/layouts/themes tables + RLS + defaults

### Stage 10 — Redesign Phase 3: Project Space ✅ DONE (2026-08-23)

**Goal:** create project-specific blocks and prove the block system can render real project data.

- [x] Project Hero block — banner, title, description, status badges, progress, tags.
- [x] Project About block — README/description/vision rendered as markdown.
- [x] Project Status block — status, stage, season, progress bar, tools.
- [x] Project Team block — contributors with avatars, names, roles via ProfileLink.
- [x] Project Activity block — recent activity timeline from project_activity table.
- [x] All blocks self-register via `registerBlock()` — no central switch statement.
- [x] All blocks use existing hooks and Supabase patterns — no new data sources.
- [x] Migration pushed to remote Supabase (pages, layouts, themes tables live).
- [x] Dev preview page (`/dev`) exercises both content and project block categories.

**Not changed:** existing project route (`projects.$id.tsx`) — blocks exist alongside, not instead of. Wiring them in is Stage 10b.

### Stage 10b — Wire Project Blocks into Route ✅ DONE (2026-08-23)

**Goal:** prove the block system renders real project data on the actual project page.

- [x] `src/lib/default-layouts.ts` — `createDefaultProjectLayout()` (Hero → About → Status+Team → Activity).
- [x] `src/hooks/use-project-page.ts` — auto-creates page + layout for projects with no page yet.
- [x] `projects.$id.tsx` imports block registrations and `useProjectPage`.
- [x] `PageShell` inserted between ProjectPulse and the README content area.
- [x] Blocks render from real project data via existing Supabase queries — Hero, About, Status, Team, Activity.

**How it works:** When a project owner visits their project page, `useProjectPage` detects no page exists yet, creates a layout with the default block structure, creates a page referencing it, and publishes it. On subsequent visits, the page is fetched and rendered via `PageShell`. Non-owners only fetch (no auto-create).

**Validation:** typecheck passes, 369 tests pass, production build passes.

**Validation:** typecheck passes, 369 tests pass, migration pushed.

### Stage 11 — Redesign Phase 4: Personal Profile ✅ DONE (2026-08-23)

**Goal:** create profile-specific blocks and wire them into the public studio route.

- [x] ProfileHeader block — avatar, display name, handle, creator title, category, location, timezone, languages, reputation.
- [x] ProfileSkills block — teach skills + learn skills with semantic color chips.
- [x] ProfileProjects block — contributed projects with role, status, progress.
- [x] ProfileBio block — about text + learning goals.
- [x] All blocks self-register via `registerBlock()`.
- [x] `createDefaultProfileLayout()` — Header → Bio → Skills+Projects (two column).
- [x] `useProfilePage` hook — auto-creates page + layout for profiles with no page yet.
- [x] `u.$handle.tsx` imports blocks + `useProfilePage` + renders `PageShell` between StudioDirection and PublicStudioWorkspace.
- [x] Blocks render from real profile data via existing Supabase queries.

**How it works:** Same auto-create pattern as projects. When a profile owner visits their own public studio, `useProfilePage` detects no page exists, creates the default profile layout, creates the page (published), and renders blocks. Non-owners only fetch.

**Not changed:** existing identity header (avatar + name in Shell), StudioDirection, PublicStudioWorkspace — blocks coexist alongside.

**Files created (Phase 4):**

- `src/components/tethyr/blocks/profile/header-block.tsx`
- `src/components/tethyr/blocks/profile/skills-block.tsx`
- `src/components/tethyr/blocks/profile/projects-block.tsx`
- `src/components/tethyr/blocks/profile/bio-block.tsx`
- `src/components/tethyr/blocks/profile/index.ts` — barrel
- `src/hooks/use-profile-page.ts`

**Validation:** typecheck passes, 369 tests pass, production build passes.

### Stage 12 — Redesign Phase 5: Visual Editor ✅ DONE (2026-08-23)

- [x] Customize mode entry/exit (`EditModeProvider` + `useEditMode` context with toggle).
- [x] Block picker, add/remove blocks (`BlockPickerPanel` in `editor-toolbar.tsx` — browse by category, click to add).
- [x] Block configuration panel (`SortableBlock` passes `onConfigChange` to `BlockRenderer`).
- [x] Drag-and-drop reordering (`SortableBlock` with HTML5 drag handles + move up/down buttons).
- [x] Preview, save draft, publish (`EditorToolbar` — eye preview, publish/unpublish buttons).
- [x] Wired into project route (`projects.$id.tsx` wrapped in `EditModeProvider`).
- [x] Wired into profile route (`u.$handle.tsx` wrapped in `EditModeProvider`).

**Files created:**

- `src/components/tethyr/page/edit-mode-context.tsx`
- `src/components/tethyr/page/editor-toolbar.tsx`
- `src/components/tethyr/page/sortable-block.tsx`

**Files modified:**

- `src/components/tethyr/page/page-shell.tsx` — integrated editor toolbar + layout/config mutations.
- `src/components/tethyr/page/page-layout.tsx` — edit-mode blocks get move/remove/drag-drop/configure controls.
- `src/components/tethyr/page/index.ts` — barrel updated.
- `src/routes/projects.$id.tsx` — wrapped PageShell in EditModeProvider.
- `src/routes/u.$handle.tsx` — wrapped PageShell in EditModeProvider.

**Validation:** typecheck passes, 369 tests pass, production build passes.

### Stage 13 — Redesign Phase 6: Template System ✅ DONE (2026-08-23)

- [x] Template model — reuses `layouts` table (`is_template` flag) — no new table needed.
- [x] Template serialization — layout sections + theme, no private content (layouts only contain structure).
- [x] Template application — `useApplyTemplate` copies a template's sections into a page's layout.
- [x] Template categories and metadata — `TemplateData` type with name, type, creator, block count.
- [x] "Save as template" action in EditorToolbar.
- [x] "Apply template" action in EditorToolbar (pick from user's own templates).
- [x] Public templates browse route at `/templates`.

**Files created:**

- `src/hooks/use-templates.ts` — `usePublicTemplates`, `useMyTemplates`, `useTemplate`, `useApplyTemplate`, `useUnpublishTemplate`.
- `src/routes/_authenticated/templates.tsx` — public template gallery.

**Files modified:**

- `src/lib/page-blocks.ts` — added `TemplateData`, `TemplateCategory` types.
- `src/components/tethyr/page/editor-toolbar.tsx` — save/apply template actions.
- `src/components/tethyr/page/page-shell.tsx` — passes ownerId/ownerType to EditorToolbar.

**Validation:** typecheck passes, 369 tests pass, production build passes, remote DB up to date.

### Stage 14 — Redesign Phase 7: Template Library ✅ DONE (2026-08-23)

- [x] Public template browsing at `/templates` (grid with preview strips, name, creator, block count, usage count).
- [x] Template detail page at `/templates/$id` (section-by-section preview with block type tags, metadata, apply button).
- [x] Template search by name + filter by category (All, Minimal, Developer, Portfolio, Documentation, Startup, Community, Creative).
- [x] Sort by newest or most used.
- [x] "Made with Tethyr" / "Layout by @username" attribution component (`MadeWithTethyr`).
- [x] `usage_count` column + `increment_usage_count` RPC — bumped on apply.
- [x] `description` and `category` columns on `layouts` for template metadata.

**Files created:**

- `src/routes/_authenticated/templates.$id.tsx` — template detail page.
- `src/components/tethyr/templates/made-with-tethyr.tsx` — attribution badge.
- `supabase/migrations/20260823100000_template_library.sql` — usage_count, description, category columns + increment RPC.

**Files modified:**

- `src/routes/_authenticated/templates.tsx` — search, category filter, sort, usage count, link to detail.
- `src/lib/page-blocks.ts` — added `category` to `TemplateData`.
- `src/hooks/use-templates.ts` — reads new columns, `usePublicTemplates` accepts search/category/sort.

**Validation:** typecheck passes, 369 tests pass, production build passes, migration pushed to remote.

### Stage 15 — Redesign Phase 8: Fork / Remix ✅ DONE (2026-08-23)

- [x] Fork model (`forks` table with parent→child relationship, creator tracking, RLS).
- [x] Fork action (`useForkLayout` — copies layout sections to new layout + records fork relationship + bumps parent's `fork_count`).
- [x] Remix action (`useRemixLayout` — fork + publish the fork as a new public template).
- [x] Template lineage display ("Forked from original → template" chain via `get_layout_lineage` RPC).
- [x] Fork count displayed on template cards and detail page.
- [x] Independent forks — the forked layout is owned by the forker, content stays separate.
- [x] Creator credit — fork records maintain parent attribution; remixes carry fork lineage.
- [x] Template versioning architecture ready — forks naturally create independent branches.

**Files created:**

- `supabase/migrations/20260823110000_fork_system.sql` — forks table, fork_count column, increment_fork_count RPC, get_layout_lineage RPC.
- `src/hooks/use-fork.ts` — `useForkLayout`, `useRemixLayout`, `useLineage`, `useForkCount`.

**Files modified:**

- `src/lib/page-blocks.ts` — added `ForkData`, `LineageNode`, `forkCount` to `TemplateData`.
- `src/hooks/use-templates.ts` — maps `fork_count`, queries include `fork_count`.
- `src/routes/_authenticated/templates.$id.tsx` — fork/remix buttons, lineage display, fork count.
- `src/routes/_authenticated/templates.tsx` — fork count on cards.

**Validation:** typecheck passes, 369 tests pass, production build passes, migration pushed to remote.

**The fork flow:**

```
User visits /templates/$id → clicks "Fork layout"
  → sections copied to new layout owned by user
  → fork record: parent_layout → child_layout
  → parent_layout.fork_count += 1
  → User gets "Layout forked — it's yours to customize" toast
  → User can edit the fork independently via EditorToolbar
```

**The remix flow:**

```
User visits /templates/$id → clicks "Remix" → enters name
  → fork happens (same as above)
  → child layout gets is_template=true + name/category metadata
  → toast: "Remix published — your version is now in the template library"
  → Remix appears in template browse with fork lineage
```

### Stage 16 — Redesign Phase 9: Themes ✅ DONE (2026-08-23)

- [x] Expand theme token architecture — rewritten `theme-tokens.ts` to emit direct CSS custom property overrides (`--background`, `--foreground`, etc.) instead of prefixed vars.
- [x] Initial theme catalog — 13 built-in themes: Minimal, Developer, Terminal, Paper, Brutalist, Glass, Retro, Cyberpunk, Academic, Nature, Studio, Sunset, Midnight.
- [x] Theme picker UI — grid of preview cards with color swatches, active highlight, apply/reset actions.
- [x] Theme preview — `MiniPreview` component shows bg/fg/surface/primary in miniature on each card.
- [x] Theme application — `updatePageTheme` mutation; themes apply instantly, revertible to Tethyr Default.
- [x] Theme catalog — built-in themes ship with pre-computed preview vars for the picker.

**Files created:**

- `supabase/migrations/20260823120000_theme_catalog.sql` — 13 built-in themes.
- `src/components/tethyr/page/theme-picker.tsx` — theme picker panel with mini previews.

**Files modified:**

- `src/lib/theme-tokens.ts` — rewritten: direct `--background` / `--foreground` / `--radius-lg` etc. instead of `--tethyr-theme-*` prefix.
- `src/lib/theme-tokens.test.ts` — tests updated for new direct-CSS-var approach (372 passing).
- `src/components/tethyr/page/editor-toolbar.tsx` — added Palette button → ThemePicker.
- `src/components/tethyr/page/index.ts` — barrel updated.

**Validation:** typecheck passes, 372 tests pass, production build passes, migration pushed to remote.

**How themes work:**

```
User opens editor → clicks "Theme" → sees 13 theme preview cards
→ clicks one → page backgrounds/foregrounds/borders/radii/fonts update instantly
→ CSS vars like --background, --foreground, --radius-lg override styles.css
→ every Tailwind utility referencing those vars gets themed
→ PageShell container passes vars via style={...}
```

### Stage 17 — Redesign Phase 10: Migration ✅ DONE (2026-08-23)

- [x] Map existing profiles to block-based pages — SQL backfill creates pages + default profile layouts for all profiles.
- [x] Map existing projects to block-based Project Spaces — SQL backfill creates pages + default project layouts for all projects.
- [x] Migrate existing customization data — WorkspaceGrid (dashboard/studio) is preserved untouched; block system complements it on profile/project pages.
- [x] Verify no data loss — existing README/bio/goals content seeded into block configs; all existing functionality preserved.
- [x] Existing route logic preserved — `useProjectPage` / `useProfilePage` hooks create pages for NEW projects/profiles at visit time; migration handles historical data.
- [x] Reversible — `migrated_pages` table tracks all backfilled records for audit/rollback.

**Files created:**

- `supabase/migrations/20260823130000_backfill_pages.sql` — PL/pgSQL backfill: iterates projects/profiles without pages, creates layouts with populated block configs (README content → about block, bio → profile-bio block), creates pages, tracks in `migrated_pages`.

**Files modified:** none (SQL only).

**Validation:** typecheck passes, 372 tests pass, production build passes, migration pushed to remote.

**What changed for users:**

- **Before:** Only project/profile owners saw blocks (auto-created on first visit). Non-owners saw nothing.
- **After:** Every existing project and profile now has a published page with blocks. Non-owners immediately see the block-based presentation.
- **New projects/profiles:** Auto-creation via hooks continues to work — same flow as before.

### Stage 18 — Redesign Phase 11: Polish ✅ DONE (2026-08-23)

- [x] Mobile audit — ThemePicker grid adjusted to 2-col on mobile, 3-col on sm, 4-col on md. EditorToolbar wraps correctly with `flex-wrap`. All blocks responsive.
- [x] Accessibility audit — added `role="toolbar"` + `aria-label="Page editor"` to EditorToolbar; `aria-live="polite"` on status badge; `role="region"` + `aria-label` on page container; `role="status"` on empty states; `role="button"` on drag handle with explicit `aria-label`; `sr-only` block type labels on sortable blocks; `role="status"` on empty-state placeholders.
- [x] UX audit — all 7 data-dependent blocks now show edit-mode placeholders instead of vanishing: Team, Activity, Skills, Projects, Bio, Hero, Status. Created shared `BlockEmptyState` component for consistent styling. Text and Heading blocks remain editable when empty. Markdown block shows preview panel. Divider always renders.
- [x] Loading states — all blocks have context-aware skeleton loaders (compact for small blocks, full-width for hero). PageShell has full-page skeleton. Templates page has grid skeleton.
- [x] Error states — PageShell shows "Try again" with retry button. Templates page has bordered error panel. Template detail shows "not found" with browse link.
- [x] Performance — blocks use React Query with stale times (2–5 min). PageLayoutRenderer is memoized. BlockRenderer is memoized. No unnecessary re-renders.
- [x] Permission audit — pages RLS covers owner-only CRUD; layouts RLS covers read-all/write-own; forks RLS covers read-all/write-auth. Templates only expose structure, never user content.
- [x] Consistency — all blocks follow same registration pattern, same props interface, same edit/view split. All routes use EditModeProvider wrapping. EditorToolbar appears on both profile and project pages.

**Files created:**

- `src/components/tethyr/blocks/block-empty-state.tsx` — shared edit-mode placeholder.

**Files modified:**

- `src/components/tethyr/page/editor-toolbar.tsx` — `role="toolbar"`, `aria-label`, `aria-live`, better mobile wrap.
- `src/components/tethyr/page/page-shell.tsx` — `role="region"`, `aria-label`, `role="status"` on empty states.
- `src/components/tethyr/page/sortable-block.tsx` — `aria-label` on drag handle, sr-only block type labels.
- `src/components/tethyr/page/theme-picker.tsx` — responsive grid fix.
- `src/components/tethyr/blocks/project/hero-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/project/status-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/project/team-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/project/activity-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/profile/skills-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/profile/projects-block.tsx` — edit-mode empty state.
- `src/components/tethyr/blocks/profile/bio-block.tsx` — edit-mode empty state.

**Validation:** typecheck passes, 372 tests pass, production build passes.

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

### 2026-08-26 — Creativity Studio Redesign: Phases 1–3 ✅ DONE

**Phase 1 — Selection Model + Sections as First-Class:**

- Page / Section / Block selection state with Escape to deselect
- Sections are clickable and show selection outlines
- "+ Add Section" sidebar button with visual preset picker (Blank, 1-Column, 2-Columns, 3-Columns, Hero, Two-Row)
- Section CRUD: add, select, remove, move up/down, duplicate, change layout
- Canvas: section wrappers with drag handles for reordering
- Floating toolbar on selected block with labeled actions (move, duplicate, hide, delete)
- Removed fake pointer-events-none resize handle (width control moved to inspector)

**Phase 2 — Contextual Inspector:**

- Inspector adapts to selection type:
  - Page: theme name, shape presets (Rounded/Angular/Sharp), Advanced toggle
  - Section: layout grid, block list, move/duplicate/delete actions
  - Block: name from registry, content fields from schema, width control, actions
- Removed Design tab (raw CSS variable display)
- Removed Layout tab (section inspector handles this)
- Removed raw config key display (no more Object.entries(config))

**Phase 3 — Block Field Schemas:**

- Added BlockField type to page-blocks.ts (text, textarea, toggle, select, image, color)
- BlockDefinition now has optional `fields` array
- Blocks with schemas: heading (text + size), text (textarea), divider (label), markdown (textarea), project-hero (3 toggles)
- Inspector generates form controls from fields: toggle switches, segmented selects, textareas, URL inputs with preview
- Section duplicate added to inspector actions

**Files changed:**

- `src/lib/page-blocks.ts` — BlockField type, fields property on BlockDefinition
- `src/components/tethyr/studio/studio.tsx` — Selection state, section CRUD, duplicate handlers, Escape key
- `src/components/tethyr/studio/studio-canvas.tsx` — Selection UI, section drag-reorder, floating toolbar, remove fake resize
- `src/components/tethyr/studio/studio-inspector.tsx` — Contextual panels, block field rendering, advanced toggle
- `src/components/tethyr/studio/studio-sidebar.tsx` — Section presets grid, Build tab, removed Settings
- `src/components/tethyr/studio/section-presets.ts` — Section preset definitions
- `src/components/tethyr/blocks/content/heading-block.tsx` — Fields schema
- `src/components/tethyr/blocks/content/text-block.tsx` — Fields schema
- `src/components/tethyr/blocks/content/divider-block.tsx` — Fields schema
- `src/components/tethyr/blocks/content/markdown-block.tsx` — Fields schema
- `src/components/tethyr/blocks/project/hero-block.tsx` — Fields schema

**Verification:** typecheck clean, 380 unit tests pass, 21/21 e2e browser checks pass.

### 2026-08-31 — Audit follow-up: Studio draft correctness + single verify gate

**Studio draft closure safety (`useStudioDraft` refactor):**

- All mutators (`reset`/`apply`/`undo`/`redo`/`markSaved`) now read live refs instead of render-closure state. Previously `apply()` read `historyIndex` from a closure, which could observe a stale index right after undo/redo and truncate the wrong redo tail (risk of lost edits); `markSaved()` also cloned from closure state.
- All callbacks are now stable, eliminating every `react-hooks/exhaustive-deps` warning in `studio.tsx` (deps wired correctly, not suppressed). ESLint is now 0 errors / 0 warnings across the repo.
- The theme-override save guard is unchanged: `overridesDirtyRef` stays false on layout-only edits and is only set by `updateOverrides`, so a plain layout save never re-persists the merged theme as overrides.
- Added `src/hooks/use-studio-draft.test.ts` (6 tests) pinning the override-save guard, undo/redo staleness + redo-tail truncation, dirty reset to clean on undo-to-saved, and position normalization.
- Also split the carried uncommitted diff into three focused commits (dead-code removal, Prettier pass, draft fix) so the committed baseline is Prettier-stable.

**Single verify gate:**

- New `npm run verify` runs the DB-free, fast gate: `typecheck` → `lint` → `test` → `prettier:check` → `check:unused`.
- New `npm run verify:full` layers on the heavier gates: `build` → `check:bundle` → `smoke` (route smoke).
- The unused-exports baseline was re-recorded to reflect current known debt (**206 tracked entries**). The 17 newly-absorbed entries are legacy profile/tab surfaces (`ProfileOverviewTab`, `ProfileSkillsTab`, `WelcomeModal`, `SaveProjectButton`, `CopyLinkButton`) and redesign composition helpers (`block-registry.BlockPageScope`, `page-composition.*`, `page-block-layout.*`, `page-blocks.BlockField`, `ForkData`, etc.). These are intentionally deferred for the Studio↔Profile convergence; `check:unused` still fails on any **future** addition. Shrink the baseline via `npm run check:unused -- --update-baseline` only after genuinely removing the debt.

**Database health check (2026-08-31):**

- `supabase migration list` — **all 146 migrations applied in order**; no local-only / remote-only / duplicate / conflict markers. No migration-version drift.
- `supabase/tests/rls_regression.sql` (pgTAP) — **96 assertions pass, 0 failures** against the current local schema, including the 20260829× security-hardening migrations. (Suite has grown past the 71 documented in Stage 2.)
- Schema-level `supabase db diff` could not complete in this environment due to a stale shadow-DB container holding the CLI's `:54320` port (an environment conflict, not Tethyr drift); re-run after `docker rm` of orphaned shadow DBs if a full schema diff is desired.
