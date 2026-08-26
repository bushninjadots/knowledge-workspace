# Tethyr Forensic UI/UX and Product Coherence Audit

> Date: 2026-08-22
> Stage: Audit only. No product-code changes were made for this audit.
> Method: repository inventory, canonical-document comparison, current-source inspection, static pattern scans, and baseline validation.
> Confidence: findings marked **Current** are evidenced in the source read during this pass; findings marked **Carried forward** come from dated audits and must be re-verified before implementation.

## Operating Decision

This audit is a gated record for safe implementation. The next change must be selected from the P0/P1 list and implemented as one narrow slice, with its own proposal, tests, responsive review, and second-pass audit. Do not launch a broad visual normalization pass.

## Baseline

- Runtime: React + TypeScript, Vite/TanStack Start, TanStack Router, TanStack Query, Supabase, Tailwind, Radix primitives, Framer Motion, React Grid Layout.
- Routes inventoried: public landing, auth entry flows, authenticated dashboard, Explore, Studio/profile, Community, Library, Sessions, Challenges, Connections, Messages, Notifications, Settings, plus public Projects, Studios, Skills, and Teams.
- Tethyr owners are documented in `docs/TETHYR_ARCHITECTURE.md`; the current source generally follows those ownership boundaries.
- `npm run typecheck`: passed.
- `npm test`: passed, 46 test files and 345 tests.
- `npm run smoke`: passed for public/auth route status, 404 behavior, robots, sitemap, and private noindex headers.
- No live authenticated browser pass was performed in this stage; visual/runtime claims that require a browser are explicitly not treated as verified here.
- The starting worktree contains unrelated in-progress security, error-message, GitHub projection, and formatting changes. This audit does not alter or classify those changes as part of the UI implementation.

## 1. Executive Summary

### What is strong

- Product intent is unusually explicit and consistently repeated: work before metadata, projects as first-class objects, and the Discover → Collaborate → Build → Contribute → Become known loop.
- The Project route has the strongest information architecture in the product. It is already shaped around README → identity → work → people → conversation → evidence, with a current-work workbench and secondary files/activity tools.
- Private and public Studio are distinct compositions with owner-controlled layouts, separate storage concerns, responsive mobile ordering, and evidence-oriented modules.
- Dashboard customization has a real interaction contract: saved layouts, presets, hidden modules, pinning, undo, reset, keyboard movement, and tests. The dashboard priority flow is intentionally outside the draggable grid.
- Navigation ownership was improved substantially in the 2026-08-20 work: one global sidebar, a dedicated mobile primary nav, URL-driven Explore/Sessions tabs, and a Settings hub.
- State handling is materially better than the older audits: most major routes have loading, empty, error, and permission-aware branches; root error/not-found handling exists; project, Library, Challenges, Messages, and Connections have meaningful empty states.
- Baseline engineering safety is good: typecheck, all tests, and route smoke pass in the current tree.

### What is weak

- The design language is split between a restrained workspace system in `src/styles.css` and older/marketing-oriented or feature-local treatments still visible in landing, Challenges, Skills, Community, Sessions, and parts of Studio. The result is coherent at the token level but inconsistent at the composition level.
- The product frequently uses rounded containers and card-like surfaces for sections that are not independent objects. This is most visible in Explore, Challenges detail, Sessions detail, profile modules, Community sidebars, and Library. The issue is not any single card; it is cumulative hierarchy flattening.
- The landing page still contains the clearest generic-AI/marketing drift: oversized type, decorative radial gradient blur, glow utility usage, multiple CTA clusters, grid texture, and a large final CTA section. This may be appropriate for public acquisition, but it is not yet clearly subordinate to the work-first Tethyr identity.
- Community remains structurally close to a social-feed product: global app shell plus Community left rail, right rail, and a separate mobile Community nav/drawer. It has collaboration-oriented content, but the composition still asks users to navigate chrome before work.
- Notification category ownership is not fully coherent in current code: the shared type→category map is canonical for category tabs/preferences, but `Needs action` is an intentionally overlapping decision queue. The docs describe disjoint categories, while the route code still filters the cross-cutting queue over category-owned data.
- Some current source still contains broad Supabase `select("*")`, unbounded related queries, and `as unknown as` conversion boundaries. The tests do not cover these contracts broadly enough to make the data/UI consistency claim strong.

### Biggest risk

The biggest risk is not visual polish. It is **semantic drift between the documented canonical model and multiple local implementations**: a page may say “work first” while its controls, metadata, card pile, or category model still behave like a generic dashboard/social feed. This creates cumulative confusion and makes future feature work less predictable.

### Biggest opportunity

Use the existing Project and Workspace patterns as the product’s structural reference, then make one cross-cutting state/data contract canonical at a time. The highest-leverage near-term slice is to close the remaining trust/accessibility/data-boundary issues before any visual restyling.

## 2. Tethyr Identity Score

Scores reflect the current source and documentation, not an aspirational redesign.

| Area                     | Score | Reason                                                                                                                                                              |
| ------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product identity         |  8/10 | Product definition, naming, and primary loop are strong; some surfaces still read as generic feed/dashboard patterns.                                               |
| Visual identity          |  6/10 | Tokens are restrained and recognizable, but landing and several feature surfaces still use older rounded/card/gradient treatments.                                  |
| UX consistency           |  7/10 | Shared primitives, URL-driven tabs, workspace ownership, and state boundaries are good; several local patterns still compete.                                       |
| Information hierarchy    |  7/10 | Project and Studio are strong; Explore, Challenges, Sessions, and Community can still present too many equal-weight controls/surfaces.                              |
| Project experience       |  8/10 | README, workbench, current work, people, conversation, and evidence are present and logically ordered.                                                              |
| Collaboration experience |  7/10 | Roles, applications, connections, messages, sessions, challenges, and project context connect; some flows still need broader end-to-end verification.               |
| Navigation               |  7/10 | Major duplicates were addressed; Community has its own rail/nav and global notification category ownership still needs a final model.                               |
| Responsive design        |  7/10 | Mobile-specific navigation and WorkspaceGrid composition exist; authenticated browser verification across all major surfaces is not current evidence in this stage. |
| Accessibility            |  7/10 | Strong foundations: labels on auth forms, skip link, focus tests, ARIA tabs, semantic lists in key flows. Residual unlabeled/weakly modeled controls remain.        |
| Technical architecture   |  8/10 | Ownership boundaries, query conventions, lazy loading, security hardening, and test infrastructure are strong; some monolithic/data-boundary remnants remain.       |
| Product logic            |  8/10 | The core loop is coherent and many previously identified dead ends are closed; category overlap and incomplete secondary flows remain.                              |

## 3. Page-by-Page Audit

Priority meanings: P0 = trust, safety, access, or core product understanding; P1 = material UX/data/architecture problem; P2 = recurring friction or inconsistency; P3 = polish.

### Landing / Home — P1

**Primary question:** What is Tethyr, and why should a builder enter?

**What works:** The copy directly expresses building together and reputation through work. Auth-aware CTAs, featured project/activity sections, SEO metadata, lazy below-fold sections, and reduced-motion handling exist.

**What does not:** The first viewport uses oversized marketing typography, a blurred radial gradient, glow utilities, grid texture, multiple large CTAs, and a separate final CTA card. This is the clearest place where the implementation can look like generic AI-generated startup marketing rather than a calm creative collaboration network.

**UX / logic:** Public discovery should expose real work early. The page has work/activity sections, but the hero composition still gives more attention to persuasion chrome than to inspectable project work.

**States / responsive:** Suspense skeletons and auth-loading CTA states exist. Mobile layout is structurally stacked, but requires live visual review for hero height, CTA count, and whether the next section remains visible.

**Duplication:** Hero actions and final CTA repeat the same join/explore/dashboard destinations.

**Recommendation:** Do not redesign during the first implementation slice. Later, evaluate whether one CTA cluster and one real project signal can replace the duplicate marketing emphasis.

### Dashboard — P1

**Primary question:** What needs my attention, and what is the next meaningful contribution?

**What works:** Welcome/next-step priority flow, active projects, applications, challenges, connections, messages, opportunities, activity, and customizable workspace modules are present. Error-state boundary and workspace ownership have regression tests.

**What does not:** The route still fetches and prepares many secondary modules together. Even when the grid hides empty modules, the page can feel like a feature index. The dashboard contains many cards/sections with equal visual treatment, so “today” competes with discovery and stats.

**UX / logic:** The product docs say priority flow first and workspace tools second; that is true structurally, but the default module surface remains broad. Verify whether the default landing state answers “what do I do now?” before adding more modules.

**States:** Loading exists. Current `useCurrentUser` errors are handled by the dashboard state boundary, while secondary module failures often collapse to empty arrays; that can hide partial data failures.

**Recommendation:** P1 review of secondary-query error semantics and default module prominence. Do not add new dashboard modules.

### Explore — P1

**Primary question:** What work, person, or open contribution can I meaningfully enter next?

**What works:** URL-driven Projects/People/Opportunities views, explicit intents, project shelf, skill matching, open needs, role applications, bounded main queries, empty states, and handle-safe ProfileLink usage.

**What does not:** The page combines intent controls, tabs, category filters, search, sorting, needs, stats, trending skills, contextual copy, and multiple card grids. The user goal is valid, but the control hierarchy is dense and can make discovery feel like a catalog rather than work-led exploration.

**UX / logic:** “Build,” “Contribute,” “Learn,” and “Feedback” are useful loop entry points. The opportunity view is the strongest collaboration path; the project and people views should preserve the same next-action clarity.

**States:** Main loading and empty states exist. Query errors are not visibly represented in the inspected route; a failed projects/creators/opportunities query can read as an empty result unless React Query error boundaries catch it.

**Recommendation:** P1 information-hierarchy review, especially whether intent and tabs can share one clear entry hierarchy. Avoid a visual card sweep.

### Projects / Individual Project — P1

**Primary question:** What is being built, what is happening now, and where can I contribute?

**What works:** This is the flagship surface. Project header, README homepage, current work, needs, people/roles, sessions, challenges, conversation, evidence, files/activity tools, owner presentation presets, join/sign-in states, project watching, and deep links exist. The route loader now carries project title into head metadata.

**What does not:** The implementation still mixes an editorial workspace flow with a number of rounded/card sections and a sticky workbench with several CTAs. Some data loading is broad and uses fallback casts. The project route loads many secondary queries even when the visitor only needs the README.

**UX / logic:** The narrative is coherent and stronger than other pages. The main risk is that secondary sections and controls can compete with the README and current work, especially on mobile.

**States:** Skeleton, not-found, error, signed-out join, owner/contributor, empty sessions/challenges, and empty README states exist. Secondary query errors are mostly not distinguished from empty data.

**Recommendation:** Preserve composition. First harden query contracts/secondary error semantics; later run a focused mobile read-order review.

### Public Profile / Studio — P1

**Primary question:** What has this person built and contributed, and what direction are they moving in?

**What works:** Public Studio is work-led, has featured work, contributions, evidence shelf, contribution activity, skills shared/growing, links/about, owner-controlled public arrangement, and accepted-connection conversation gating.

**What does not:** The public header uses a large identity container before the work workspace, and the workspace modules are still rendered as repeated SectionCards. Private Studio also contains identity completeness and a separate sidebar, which can dilute projects as the dominant signal.

**UX / logic:** The distinction between private Studio and public Studio is correct. The product risk is presentation emphasis: metadata and customization controls can still compete with visible work.

**States:** Public loading/not-found/error, private loading/error, empty projects/skills/evidence, and owner/non-owner controls exist.

**Recommendation:** P1 preserve the public/private model and review only work-vs-metadata ordering; do not merge the two renderers.

### Community — P1

**Primary question:** What useful work, help, feedback, or collaboration can I join?

**What works:** Feed types include updates, help, collaboration requests, showcases, lessons, and open roles; spaces, composer, project attachment, mobile drawer, deep links, and realtime posts exist. Community navigation has an accessible name.

**What does not:** Global authenticated shell, Community left rail, Community right rail, Community mobile nav, and mobile drawers create a high chrome-to-content ratio. The visual language remains feed/sidebar-oriented even though the product goal is collaboration through work.

**UX / logic:** Community should reinforce Projects and contribution. The feed categories do; the composition still resembles a separate social product. Cross-cutting destinations must remain owned by the global sidebar, with Community rails limited to feed context.

**States:** Feed loading/empty/error behavior is distributed across extracted components; space loading and empty states exist. A full network/error-state review is still needed.

**Recommendation:** P1 composition review after trust/accessibility work. Do not remove Community functionality solely to reduce chrome.

### Skills — P2

**Primary question:** Where can I find people, projects, or learning around this craft?

**What works:** Skill hub includes people sharing, people growing, projects, and workshops/tabs with loading and empty branches.

**What does not:** Terminology remains at risk of drifting between “workshop,” “hub,” “sharing,” “growing,” and canonical “Skills I share / Skills I’m growing.” The source still has local card/shadow/gradient treatments unlike the strict workspace token language.

**States:** Loading, not-found, empty teachers/learners/projects, and error route fallback exist.

**Recommendation:** P2 vocabulary audit and a single canonical skill surface vocabulary. Avoid broad layout changes.

### Library — P2

**Primary question:** What working reference or note helps my projects move?

**What works:** Library has navigation, collections/tags, search, grid/list modes, uploads, notes, Markdown/rich editor, project linking, GitHub sync, signed images, sanitization, and empty/error states.

**What does not:** The Library has duplicate “Start a doc” and “New note” actions, uses card grids for items and collections, and contains a migration/setup error state that exposes raw database error text and manual SQL instructions to end users.

**UX / logic:** Library is correctly secondary to public work, but project linking is not visually central in the list surface. The editor has destructive conversion/sync confirmation flows that still use native `window.confirm`.

**States:** Loading, empty, migration error, item not-found, save/sync paths exist; mutation failures are not uniformly surfaced.

**Recommendation:** P1 trust issue: replace raw schema/setup error exposure with a safe, actionable environment error state. P2 consolidate new-document actions only after confirming intended distinction.

### Sessions — P1

**Primary question:** What focused collaboration is happening, and what needs my response?

**What works:** URL-driven tabs include Upcoming, Calendar, History, Requests, and Weekly schedule. Dashboard deep links to Requests. Session details include project context in the broader system, notes, resources, participant actions, status transitions, and error/not-found states.

**What does not:** Session list/detail surfaces still use card-heavy layouts and status emoji strings. The session detail header is generic in route metadata until client load, and the status/action model is dense.

**UX / logic:** “Weekly schedule” is now distinct from status, which is good. Verify organizer/participant permissions and stale status transitions in browser/RLS flows.

**States:** Loading/error/not-found/empty participants/notes exist. Some mutation errors are generic and do not preserve server state detail.

**Recommendation:** P1 end-to-end permission/state verification; P2 visual normalization only after flow confidence.

### Challenges — P1

**Primary question:** What shared build can I join, complete, submit, and have recognized?

**What works:** Starter/community separation, filters, search, project links, join/progress/submit/review flow, pass criteria, evidence uploads, creator review, and reputation gating are strong product logic.

**What does not:** Challenge detail is visually dense and card-heavy. The page exposes many badges, nested surfaces, progress state, submission controls, review controls, and participant roster with similar emphasis. Several submission/review inputs use placeholder-only labeling in current source.

**UX / logic:** The flow itself is coherent and trust-sensitive. Review controls deserve a dedicated permission and accessibility pass because passing awards reputation.

**States:** Loading, not-found, joined/not-joined, submission statuses, review statuses, empty participants, and upload failures exist.

**Recommendation:** P0/P1 accessibility and permission verification before visual work.

### Connections — P2

**Primary question:** Who am I connected to, and what request needs a response?

**What works:** Incoming requests are prioritized, accepted connections link to profiles/messages, outgoing withdrawal uses a styled dialog, handle-less names do not create broken profile links, loading/empty states exist.

**What does not:** The page is clear but still presents repeated rounded rows and uses a broad connections query capped at 200. It does not show an explicit error state in the route when the hook fails.

**Recommendation:** P2 add visible query-error semantics and verify large-list behavior.

### Messages — P1

**Primary question:** Which collaborator needs a focused conversation now?

**What works:** Accepted-connection gating, project context, deep-linking, pagination for messages, typing/read receipts, empty CTAs, mobile thread navigation, and labeled composer exist.

**What does not:** The conversation list and thread still use multiple rounded/shadowed surfaces; the “table/seating chart” language is memorable but can compete with direct task clarity. Unread-count architecture remains a carried-forward performance concern.

**States:** Loading, empty list, empty thread, older-message loading, sending, typing, and read states exist. Query error is not visibly represented in the route.

**Recommendation:** P1 fix/verify unread-count query behavior and visible failure handling before any composition changes.

### Notifications — P1

**Primary question:** What requires attention, and where should I go next?

**What works:** Notification destinations, realtime, category preferences, mute filtering, and a clear “Needs action” lead are implemented.

**What does not:** Current route code explicitly defines `Needs action` as a cross-cutting overlapping queue while the category tabs/preferences are canonical one-owner categories. The result is intentional but semantically inconsistent with the docs and can make counts/filter expectations unclear. A legacy `NotificationSidebar` also contains a separate category/type map, indicating competing implementations.

**Recommendation:** P1 choose and document one model: either “Needs action” is a cross-cutting inbox with explicit copy/count semantics, or every notification has one exclusive category. Remove/retire the unused competing sidebar map after reference verification.

### Settings — P2

**Primary question:** Where do I control account safety, notifications, and personal preferences?

**What works:** Settings hub exists and has tests for account/security, notification preferences, delete-account gating, and sign-out. Sidebar Account ownership is clear.

**What does not:** Settings links out to Studio appearance/skills and Sessions weekly schedule, so the hub is a settings index rather than a complete settings workspace. This is acceptable if intentional, but should be documented in copy/IA.

**Recommendation:** P2 clarify ownership and avoid duplicating Studio/Sessions controls.

### Authentication / Onboarding — P2

**Primary question:** Can I join safely and understand the first useful step?

**What works:** Auth forms have labels, inline validation, safe redirects, OAuth, password reset session handling, Terms/Privacy links, and craft selection in a fieldset.

**What does not:** Signup still loads up to 36 catalog skills into a dense button field and onboarding does not clearly bridge to the first project/collaboration action in the inspected route. Password strength remains basic length validation.

**Recommendation:** P2 review first-session transition using existing `FirstSessionOnboarding`; do not add onboarding features without a concrete dead end.

### Mobile versions — P1

**What works:** Authenticated shell has mobile drawer and bottom nav; Community has its own mobile navigation/drawer; WorkspaceGrid switches to a vertical flow with move controls; project/profile layouts use responsive stacks; mobile nav has tests.

**What does not:** Multiple mobile navigation systems coexist: global mobile primary nav, authenticated drawer, and Community mobile nav/drawer. This can be correct by context, but requires live browser validation to ensure no overlap, hidden content, duplicate “More” affordances, or excessive viewport chrome.

**Recommendation:** Dedicated mobile pass after current P0/P1 data/accessibility issues. Verify 390px and 768px widths with long titles, empty states, dialogs, drawers, and keyboard/focus.

## 4. Design-System Audit

### Keep

- Tokenized semantic colors and surface hierarchy in `src/styles.css`.
- Tight radius scale in tokens and the rule that pills are for tags/status/avatars.
- `panel`, `surface-section`, `panel-row`, `section-label`, `content-safe`, and restrained transitions as canonical implementation primitives.
- `SegmentedControl` for true tabs and its ARIA keyboard behavior.
- `EmptyState`, `ProfileLink`, `WorkspaceGrid`, `Button`, Radix Dialog/Drawer, and project workspace section ownership.
- Reduced-motion CSS baseline and explicit `aria-current`, labels, focus-visible styling.

### Consolidate

- Page title styles and heading hierarchy across Skills, Challenges, Sessions, Notifications, Explore, and detail routes.
- Notification category ownership: route `CATEGORY_TYPE_MAP`, `TYPE_CATEGORY`, and legacy `NotificationSidebar` should have one source of truth.
- Empty/error/loading state contracts so hook errors do not silently become empty arrays.
- Project/person row/card treatments where they represent the same product concept.
- Raw Supabase select/type adapters, especially around project detail and public Studio.
- Library “Start a doc” versus “New note” action semantics.
- Shared confirmation dialogs in Library and remaining mutation flows.

### Remove or reduce

- Decorative gradient/glow/blur treatment when it adds no information: landing hero radial blur, glow utility usage, animated border glow definitions, and local gradient dividers where a rule would communicate the same structure.
- Section-level rounded containers that do not represent independent objects, especially in Challenges detail, Sessions detail, Explore control groups, and repeated Studio SectionCards.
- Repeated CTA destinations on landing and repeated “create/new” actions in Library when they mean the same thing.
- Raw database schema errors and manual migration instructions in end-user route UI.
- Legacy unused/competing notification sidebar category implementation after confirming references.

### Missing

- A documented error contract for partial dashboard/Explore/project secondary queries.
- A canonical cross-cutting “Needs action” notification model and test cases for overlap/count semantics.
- A reusable, accessible confirmation dialog primitive or local shared wrapper for destructive/conversion actions.
- A current authenticated browser validation record for all major surfaces at desktop/mobile widths.
- Query-level performance budgets/limits for catalog and relation queries, with tests for boundedness where feasible.

## 5. AI-Generated Design Drift

These are not automatic deletion targets; each requires the reason below.

1. **Landing marketing pile:** oversized display type + blurred radial gradient + grid texture + glow utilities + repeated CTA sections. Why it drifts: it prioritizes “modern startup” visual signals over inspectable work and makes the product resemble a generic AI-generated landing page.
2. **Card-as-section default:** repeated `rounded-xl bg-surface-elevated/30` wrappers across Challenges, Sessions, Profile, Community, and Explore. Why it drifts: surfaces that belong to one page flow become independent-looking objects, flattening the information hierarchy.
3. **Pill saturation:** status, filters, tabs, actions, and metadata frequently use `rounded-full`. Why it drifts: pills stop encoding a specific semantic category and become the default shape for controls.
4. **Decorative motion/hover lift:** `hover:-translate-y`, `hover:shadow-md`, animated entrance classes, and decorative glow definitions. Why it drifts: movement becomes a signal of polish rather than a cue for interaction or state.
5. **Feature-index density:** Explore and Dashboard show many unrelated capabilities at once. Why it drifts: the page becomes a catalog of app features rather than a composed answer to one user question.
6. **Social-feed shell:** Community’s rails, right sidebar, mobile nav, counts, and feed filters. Why it drifts: even with collaboration-oriented content, the layout inherits the mental model of a generic social network.

## 6. Duplication Audit

### Current or likely competing implementations

- Notification categories: `src/routes/_authenticated/notifications.tsx`, `src/lib/notification-categories.ts`, `src/components/tethyr/notifications/notification-sidebar.tsx`.
- Page-level error markup: root fallback plus many route-local error components. Some local copy/behavior differs; not all should be merged, but the action contract should be shared.
- Project detail data conversion: route-local fallback selects and multiple `as unknown as` conversions instead of a typed adapter.
- Public/private Studio section surfaces: concepts are correctly distinct, but `SectionCard`-style presentation is repeated and can obscure the difference between an independent object and a page section.
- Library creation actions: sidebar “New Note,” list “Start a doc,” list “New note,” and empty-state “Create note.” Verify whether these are one concept or intentionally separate.
- Confirmation behavior: native `window.confirm` remains in Library item mode conversion and GitHub sync; styled dialogs are used elsewhere.
- Configuration constants under `src/data/mocks/`: production catalogs/navigation constants are named as mocks, which misleads maintainers.
- Data fetching: direct Supabase calls remain in routes/components alongside hooks; this is not always wrong, but the ownership boundary is inconsistent.

### Canonical recommendations

- Keep Project, Profile/Studio, Community, Library, Sessions, and Challenges as distinct compositions.
- Canonicalize only stable concepts: project row/card, profile link, segmented tabs, empty state, error state, notification type ownership, confirmation interaction, and data adapters.
- Do not abstract visually similar but product-distinct sections merely to reduce JSX.

## 7. Product Logic Audit

### Strong flows

- Project creation → project README/identity → workbench → roles/needs → application/contribution → activity/evidence.
- Public Studio → visible work/contribution → accepted connection → message thread.
- Challenge join → progress → submission → creator review → pass-gated reputation.
- Sessions requests → URL-driven request queue → participant/organizer status actions.
- Library note/resource → project link → project context.

### Flows requiring verification or clarification

- Dashboard secondary-query failures: confirm whether a failed applications/challenges/opportunities query should show an error/retry rather than silently show an empty module.
- Notification Needs action overlap: decide whether it is an inbox queue or an exclusive category.
- Community mobile navigation: confirm whether global “More” plus Community “More” is deliberate and understandable.
- Library conversion/sync: native confirmation is inconsistent with the rest of the product and can lose context when canceling.
- Challenge submission/review fields: labels and keyboard/error behavior need a dedicated pass because the flow changes reputation.
- Settings ownership: clarify which settings remain in Studio/Sessions and which belong in the hub.

## 8. Unfinished / Broken Audit

### Current findings

- **P1:** Notification category model has competing current implementations and documented/source mismatch around Needs action overlap.
- **P1:** Library migration/setup error displays raw database error details and manual SQL instructions to end users.
- **P1:** Current source retains `select("*")` in multiple hooks and several broad relation queries; this weakens data minimization and performance predictability.
- **P1:** Current source retains production `as unknown as` boundaries in project detail, public Studio, layout storage, SEO, and current-user project conversion.
- **P1:** Challenge detail submission/review inputs still rely on placeholders for visible labeling in several locations.
- **P2:** Native `window.confirm` remains in Library mode conversion and GitHub sync.
- **P2:** Query failures in Explore, Messages, Connections, and several secondary dashboard modules are not visibly distinct from empty states in the inspected route code.
- **P2:** `src/data/mocks/` name is misleading for production configuration catalogs.
- **P2:** `useTrendingSkills` fetches full skills and all teach/learn/project references, then aggregates in JavaScript; this is a scale risk if catalog/usage grows.
- **P2:** Several `use-projects` and related hooks select `*`; exact limits are uneven across updates/replies/relations.

### Carried-forward and requiring re-verification

- Unbounded `useUnreadCounts` query from prior audit.
- Remaining image lazy-loading/dimension gaps from prior audit.
- Confetti reduced-motion guard from prior audit.
- Remaining `window.confirm` call inventory beyond the two Library uses found here.
- Landing TBT and main-thread cost from prior Lighthouse runs.
- Any historical security issue already addressed by the current worktree migrations/functions must be tested against current deployed/local state before being reopened.

### Keep / Fix / Remove / Defer

- **Keep:** Project workspace model, Studio customization, Community collaboration post types, challenge review trust model, Settings hub, URL-driven tabs, shared primitives, current RLS/security hardening.
- **Fix next:** data/error contracts, notification category ownership, Library raw-error exposure, challenge field labeling, unread-count boundedness, critical query limits.
- **Remove after reference check:** legacy notification sidebar map if unused; duplicate Library creation action wording if same operation.
- **Defer:** landing visual redesign, broad card/radius normalization, animations, gradients, video/audio sessions, calendar sync, push/email, API/analytics/native mobile.

## 9. Priority Register

### P0 — Critical

No newly verified P0 from this source-only pass. The baseline type/test/smoke checks pass. Historical security findings must not be assumed closed in production without deployment verification, but the current worktree includes relevant hardening changes.

### P1 — High

1. Define and test notification “Needs action” semantics; remove competing category ownership.
2. Replace Library raw database/setup error exposure with a safe end-user state.
3. Add explicit error/partial-failure semantics to Explore, Messages, Connections, and dashboard secondary modules.
4. Replace high-risk broad `select("*")` and `as unknown as` data boundaries in the highest-traffic current-user/project/notification paths.
5. Complete accessibility labeling and state review for Challenge submission/review controls.
6. Verify unread-count/query scale and permission behavior in Messages.
7. Run authenticated browser verification across Project, Studio, Dashboard, Community, Explore, Sessions, Challenges, Library, Connections, Messages, Notifications, Settings at desktop and mobile widths.

### P2 — Medium

1. Reduce section-level card/pill/shadow drift in one feature at a time using existing primitives.
2. Consolidate Library action language and confirmation behavior.
3. Canonicalize skill vocabulary and rename misleading `data/mocks` directory when safe.
4. Bound/optimize trending skill aggregation and remaining relation queries.
5. Verify mobile navigation layering and Community/global nav ownership.
6. Review image dimensions/lazy loading and reduced-motion behavior.

### P3 — Polish

1. Landing CTA duplication and decorative public hero treatments.
2. Minor title/metadata consistency and local spacing.
3. Low-impact border/radius differences after structural work.

## 10. Safe Implementation Order

### Stage 1 — Audit record (complete)

- Inventory routes, shells, owners, tokens, navigation, and major states.
- Compare current source against canonical product/design/architecture docs.
- Run typecheck, tests, and route smoke baseline.
- Record current findings and avoid unrelated product edits.

### Stage 2 — Trust and state contracts

- Choose the notification category model and add regression tests.
- Fix raw Library setup/error exposure.
- Add visible partial-query error handling where empty arrays currently hide failures.
- Add Challenge submission/review labels and state announcements.
- Verify unread-count behavior and query bounds.

**Gate:** typecheck, focused tests, full tests, route smoke, and authenticated browser pass for affected flows.

### Stage 3 — Data boundary and scale hardening

- Replace highest-risk `select("*")` with explicit columns.
- Remove or isolate production `as unknown as` conversions through typed adapters.
- Bound remaining relation/catalog queries based on evidence.
- Preserve RLS and add regression coverage where query shape changes.

**Gate:** typecheck, tests, build, query/network inspection, and no permission regressions.

### Stage 4 — Major page hierarchy

- Re-audit Dashboard, Explore, Community, Library, Sessions, and Challenges after state/data fixes.
- Select one page with the clearest hierarchy problem.
- Recompose with existing sections/workspaces/primitives; do not introduce a new card system.

**Gate:** design review, mobile/desktop browser screenshots, accessibility review, and focused tests.

### Stage 5 — Responsive and accessibility sweep

- Validate 390px, tablet, and desktop for major flows.
- Review nav layering, dialogs/drawers, long content, empty states, keyboard paths, and reduced motion.

### Stage 6 — Performance and polish

- Re-measure landing/main-thread cost, image dimensions/lazy loading, and list behavior.
- Only then reduce decorative gradients, shadows, pills, and duplicate CTAs where the audit proves they obscure work.

### Explicitly out of scope until later

- Broad redesign of all pages.
- New top-level navigation or feature concepts.
- Animation/gradient/shadow polish as a first move.
- Product direction changes without updating canonical docs.
- Destructive schema/RLS changes as a workaround for presentation issues.

## 11. Stage Execution Log

### 2026-08-22 — Stage 2: notification model

**Decision:** Keep “Needs action” as an intentional cross-cutting queue while keeping each notification type assigned to exactly one canonical preference/category home.

**Implemented:**

- Centralized `NEEDS_ACTION_TYPES`, category view definitions, view-key validation, and mute resolution in `src/lib/notification-categories.ts`.
- Updated `src/routes/_authenticated/notifications.tsx` to consume the shared definitions instead of maintaining a second inline action/category map.
- Removed the confirmed-unused `src/components/tethyr/notifications/notification-sidebar.tsx`, which contained a competing category/type mapping.
- Added `src/lib/notification-categories.test.ts` covering exclusive category ownership, intentional action overlap, view catalog alignment, and mute resolution.

**Validation:**

- `npm run typecheck` passed.
- `npm test` passed: 47 test files, 350 tests.
- Focused notification tests passed: 19 tests.
- `npm run smoke` passed.
- `git diff --check` passed.
- No remaining source references to `NotificationSidebar` or `notification-sidebar`.

**Not changed:** notification UI styling, category labels, mute persistence, notification destinations, database schema, or unrelated pages. The next stage remains gated.

## 12. Final Tethyr Check

The next implementation is successful only if it makes the work easier to understand, makes collaboration easier to enter, represents state truthfully, and leaves the page feeling more like Tethyr rather than merely more polished.
