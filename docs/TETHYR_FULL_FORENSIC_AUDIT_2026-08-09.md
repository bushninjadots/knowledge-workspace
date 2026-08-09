# Tethyr Full Product, UI/UX & Codebase Forensic Audit

> **Audit date:** August 9, 2026  
> **Mode:** Read-only forensic audit  
> **Scope:** Product identity, routes, UI/UX, design system, code organization, Supabase/database boundaries, permissions, state handling, accessibility, responsive behavior, performance signals, terminology, and product logic.  
> **Implementation status:** No application code was modified during this audit. This document is analysis and recommendation only.

## Audit framing

This audit treats the existing `UI_UX_FULL_AUDIT.md`, `UX_AUDIT.md`, `PROJECT_AUDIT.md`, `ROADMAP.md`, and `AGENTS.md` as **evidence, not truth**. Those documents describe useful history, but several claims are now stale or conflict with current source. Every finding below is therefore labeled as one of:

- **Verified:** directly observed in the current repository.
- **Strong signal:** supported by code structure or repeated patterns, but needing runtime/product confirmation.
- **Needs verification:** plausible, but not safe to call a bug without a live authenticated check or database inspection.
- **Historical/stale:** present in older audit material but contradicted by current source.

### Current baseline observed

- The working tree already contained two user-requested changes before this audit: `src/components/tethyr/navbar.tsx` and `src/routes/index.tsx`. They make the public landing header explicitly public-only, with **Log in** and **Join Tethyr** rather than authenticated project actions. They were preserved and not changed during this audit.
- The repository contains approximately **52,700 lines** of TypeScript/TSX/CSS under `src/`.
- The product has 73 Supabase migration files covering profiles, projects, workspaces, skills, community, challenges, sessions, notifications, files, moderation, and security hardening.
- The route inventory contains public routes, a legacy/root dashboard route, public project/profile/skill routes, and an authenticated route tree guarded by Supabase `getUser()`.
- Current test inventory includes component/hook/library tests, a route smoke script, and SQL RLS regression tests. Coverage is meaningful for selected foundations but not representative of the largest product surfaces.
- Current source has strong loading/error/empty-state intent, bounded queries in many places, realtime subscriptions, and multiple atomic RPCs. Those are strengths. They do not by themselves prove every end-to-end flow is production-ready.

---

# 1. Executive Summary

Tethyr has a clear and differentiated idea: **people build things together and become known through what they make**. The repository contains substantial product work toward that idea: project workspaces, open roles, applications, contributors, project activity, skill matching, community spaces, challenges, sessions, messaging, notifications, a personal library, and reputation.

The main problem is no longer a lack of features. It is **coherence at the seams**.

The codebase currently feels like a promising collaboration network carrying several overlapping product models at once:

1. a project-centered collaboration workspace;
2. a social/community feed;
3. a personal knowledge and scheduling suite;
4. a customizable dashboard/profile builder; and
5. a reputation and opportunity system.

All of these can belong in Tethyr, but the product needs a stronger hierarchy. The project and the evidence of contribution should be the center. Community, skills, sessions, library, challenges, messaging, notifications, and reputation should clearly feed into or emerge from that center.

## Highest-confidence conclusions

### P0 — Resolve coherence and trust blockers before adding more features

- Establish one canonical ownership model for project/profile/dashboard module headers. The prior duplicate customize-toolbar and Projects-header reports are consistent with a real risk in a layout system where both wrapper and child modules can render chrome. Runtime confirmation is still required, but the architecture should make duplicate ownership impossible.
- Verify production database migration state before shipping UI that depends on recent migrations. `KNOWN_ISSUES.md` documents prior local/remote drift, and the repository contains many sequential corrective migrations.
- Make project privacy, contributor permissions, role applications, file access, challenge review, and community moderation testable as complete user flows—not only as individual RPCs or policies.
- Reduce conflicting product language and navigation. “Profile,” “Studio,” “Projects,” “Workspace,” “Tethrs,” “Connections,” “Skills I teach,” “Skills I share,” “Growing,” and “Skills I want to learn” currently coexist.
- Replace silent or structurally blank data regions with explicit loading, empty, or error states wherever the dashboard and project workspace can render optional modules.

### P1 — Make the flagship project experience legible

- The project page is ambitious, but its 12-ish deep sections/tabs risk making a project feel like a dashboard or repository browser rather than a living workspace.
- Make the first view answer, in order: **What is this? Who is building it? What is happening now? How can I help? What evidence exists?**
- Group deep evidence—files, repos, resources, activity—behind a deliberate secondary navigation model.
- Make roles, people, updates, and contribution evidence more visible than operational metadata.

### P1 — Consolidate large route/component responsibilities

Several files are too large to safely evolve as one unit. Current examples include:

- `src/routes/_authenticated/profile.tsx` — approximately 1,374 lines.
- `src/components/tethyr/profile-sections.tsx` — approximately 1,332 lines.
- `src/hooks/use-community-spaces.ts` — approximately 1,245 lines.
- `src/components/tethyr/community/composer-bar.tsx` — approximately 1,164 lines.
- `src/components/tethyr/community/post-card.tsx` — approximately 1,116 lines.
- `src/components/tethyr/community/...settings.tsx` — approximately 1,107 lines.
- `src/routes/dashboard.tsx` — approximately 1,027 lines.
- `src/routes/_authenticated/explore.tsx` — approximately 918 lines.
- `src/hooks/use-projects.ts` — approximately 846 lines.

This is not a reason to perform a broad refactor immediately. It is a reason to extract only when a product change touches a seam, and to put tests around the seam first.

### P1 — Treat evidence, not vanity, as the reputation model

The repository has reputation scores, achievements, activity events, endorsements, challenges, and contribution logs. That is directionally correct. The risk is that multiple stats surfaces and gamified labels can make reputation feel like a generic score dashboard. Keep the score explainable: every meaningful increase should point to visible work, collaboration, teaching, learning, reliability, or community contribution.

### P2 — Improve discovery and cold-start quality without inventing noise

Empty community, people, opportunities, and project states are understandable for an early product but can make Tethyr appear abandoned. Do not seed fake social activity indiscriminately. Prefer curated, clearly labeled starter projects, example challenges, onboarding prompts, and useful empty-state actions.

### P2 — Increase test depth before feature depth

The foundation has tests, but the largest surfaces—dashboard, Explore, Community, Sessions, Messages, Library, Notifications, project workspace, and authenticated route transitions—need representative tests. Browser validation is also a separate gap; route smoke is not equivalent to authenticated interaction coverage.

### What not to do next

- Do not add another generic dashboard module.
- Do not add social engagement mechanics merely to fill empty states.
- Do not standardize the whole UI by applying more cards, more pills, larger radii, gradients, or shadows.
- Do not merge every similarly named component without checking differences in permissions, data shape, and context.
- Do not implement every older audit recommendation. Several are stale, and some conflict with the current product direction.

## Disposition of the originally reported bug list

This is the direct status map for the eight issues that motivated the forensic audit. “Resolved in source” means the current code contains a targeted implementation; it does not claim that an authenticated browser or production database verification was completed in this pass.

| Original issue                            | Current evidence                                                                                                                                                                                                                                                      | Disposition                                                                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate “Customize layout” toolbar      | `src/components/tethyr/workspace/workspace-grid.tsx` owns the toolbar and exposes `showCustomizeBar`; profile usage in `src/components/tethyr/profile/profile-layout.tsx` passes `showModuleTitles={false}` and the grid call sites are limited to dashboard/profile. | **Likely resolved in source; P0 browser regression needed.** The ownership contract now exists, but the recorded visual bug must be reproduced once.                                                                                    |
| Duplicate “Projects” module header        | `WorkspaceGrid` exposes `showModuleTitles`; profile disables built-in module titles while the rendered module owns its body/header.                                                                                                                                   | **Likely resolved in source; P0 browser regression needed.** Add an assertion for one header per module.                                                                                                                                |
| Blank dashboard rectangles                | `WorkspaceGrid.visibleItems` removes null module content and repacks the grid; dashboard has loading/error/empty components.                                                                                                                                          | **Improved in source; P0 runtime verification needed.** A failed nested query or a separate wrapper can still produce a blank region.                                                                                                   |
| Repeated activity actions                 | `src/components/tethyr/activity-timeline.tsx` merges mirrored events and groups identical actions within `GROUP_WINDOW_MS = 10 * 60 * 1000`, displaying `×N`.                                                                                                         | **Resolved in source; add regression coverage.** The grouping identity should be tested for banner/profile iterations and unrelated entities.                                                                                           |
| Reputation/stats duplicated               | `src/components/tethyr/profile/profile-overview-tab.tsx` renders `ReputationCard`; `src/components/tethyr/profile/profile-layout.tsx` also renders a `Stats` block with counts.                                                                                       | **Still a product/UX issue to review.** The components are not identical, but the surfaces overlap and should have clearly distinct purposes.                                                                                           |
| Skill taxonomy naming inconsistency       | `src/routes/_authenticated/profile.tsx`, `profile-layout.tsx`, `profile-skills-tab.tsx`, and `profile-overview-tab.tsx` use “Skills I teach” / “Skills I want to learn”; `src/routes/skills.$slug.tsx` uses “Growing” and teachers/learners.                          | **Open terminology issue.** Canonicalize to “Skills I share” and “Skills I’m growing,” with teaching/learning as explanatory copy.                                                                                                      |
| “Contributor · 0% to Builder” stuck at 0% | `src/lib/reputation.ts` defines a correct `getTierProgress(score)` calculation using the current tier minimum and next tier minimum; `src/components/tethyr/reputation-display.tsx` consumes it.                                                                      | **Source math appears resolved; displayed value needs runtime/data verification.** Confirm the rendered score is live profile data and that score 20 yields 0% toward the 50-point Builder threshold or explain the label more clearly. |
| Cold-start emptiness                      | Empty states are explicit and truthful across Explore, dashboard, Community, skills, projects, and connections.                                                                                                                                                       | **Not a bug; product risk.** Add a curated starter path or clearly labeled seed content, not fabricated organic activity.                                                                                                               |

---

# 2. Product Identity Assessment

## Intended identity

Tethyr is a **creative collaboration network** where builders—developers, designers, writers, musicians, researchers, founders, artists, and others—create projects together in public, grow through real contributions, and become known for what they make.

The strongest product loop is:

```text
Discover work
  → Understand a person or project
  → Find a useful way to contribute
  → Join, discuss, teach, learn, or build
  → Leave visible evidence
  → Earn trust and reputation
  → Discover the next meaningful collaboration
```

## Does the implementation feel like Tethyr?

**Partly, and increasingly so.**

### Where it succeeds

- Projects have a real lifecycle: planning, building, testing, launch, and growing.
- Projects support roles, applications, contributors, updates, milestones, files, discussions, resources, repositories, and activity.
- Skill matching and availability connect people to collaboration rather than only to profile browsing.
- Reputation is connected to activity, project work, learning, teaching, challenges, and community participation.
- The public landing copy and the design constitution consistently state the builder-centered identity.
- The public landing header now has a clean signed-out purpose: **Log in** and **Join Tethyr**.

### Where it drifts

- The surface area is broad enough to resemble several products at once.
- The dashboard contains many independently framed modules, recommendations, counts, and empty states. Without strict hierarchy it can read as a generic SaaS dashboard.
- The project page contains many deep sections. Comprehensive capability is not the same as a coherent first experience.
- Profile sections can make identity feel like a database record—skills, counts, labels, and social links—unless projects and contribution evidence dominate.
- Follower/connection-style mechanisms exist in the codebase despite the roadmap’s “no followers / reputation over popularity” principle. The product needs a clear distinction between a useful collaboration connection and a popularity metric.
- The design system comments describe a restrained “panels and rules” language, while much existing markup still uses rounded containers, gradients, blur, glows, and card-like module wrappers.

## Product north star for decisions

When a proposed feature or change is ambiguous, ask:

> Does this help a person discover meaningful work, understand who is building it, find a useful contribution, participate, or make contribution visible?

If not, the feature should be postponed, merged into an existing workflow, or rejected.

---

# 3. Architecture Assessment

## Strengths

- TanStack Router provides explicit file-based route ownership.
- The authenticated route tree has a clear `beforeLoad` boundary using Supabase `getUser()` and redirects unauthenticated users to `/login`.
- `AuthenticatedShell` centralizes the authenticated sidebar/header, search, notifications, theme, and scroll behavior for routes under `/_authenticated`.
- Supabase migrations show a deliberate evolution from core data to project workspaces, collaboration, reputation, community, moderation, visibility, storage, and security hardening.
- Database-side RPCs are used for sensitive state transitions including project role acceptance/decline, poll voting, space join requests, bans, and achievement awards.
- React Query is used broadly for server state and invalidation.
- Loading, error, retry, and empty-state patterns exist across many major surfaces.
- The codebase has reusable design primitives and shared components rather than only route-local markup.
- Route smoke, unit/component tests, and RLS regression tests provide a foundation for safer iteration.

## Architectural risks

### Route duplication and shell duplication

`/dashboard` is a root-level route with its own authenticated/unauthenticated branching and its own sidebar/header composition, while most other authenticated routes live under `/_authenticated` and use `AuthenticatedShell`. This may be intentional for the dashboard’s custom workspace behavior, but it creates two shell implementations that can drift.

**Recommendation:** Keep the dashboard as a distinct workspace only if its requirements justify it. Otherwise extract a shared shell primitive and make dashboard-specific behavior a content concern. Do not blindly move the route; first compare auth loading, dynamic palette, mobile navigation, notifications, search, and scroll behavior.

### Large files combine data, state, layout, and policy

Route-level query logic and large component render switches make it difficult to test product behavior independently from layout. This increases the chance of stale data, accidental duplicate rendering, and inconsistent mutations.

**Recommendation:** Extract at stable boundaries:

1. query functions and selectors;
2. mutation adapters and permission-sensitive actions;
3. pure view models for module data;
4. large visual sections only after their ownership is clear.

### Type escape hatches

Current source contains approximately 39 occurrences of `supabase as any`/related casts based on the read-only scan, concentrated in projects, sessions, community, notifications, profile/public profile, dashboard, Explore, and project components. Earlier audit documentation estimated a higher count; the exact count depends on the search expression.

**Risk:** database column and result-shape errors can compile silently. This is especially important in a schema with many migrations and nested relationships.

**Recommendation:** regenerate/verify Supabase types, then convert the highest-risk permission and mutation paths first. Do not convert every cast in one speculative sweep.

### Migration complexity

The migration history contains many corrective and hardening migrations, including RLS recursion repairs, storage fixes, visibility fixes, notification additions, poll RPCs, role application handling, challenge review, moderation, and project child visibility.

**Risk:** a frontend can appear complete against one database state and fail against another.

**Recommendation:** maintain an explicit migration verification checklist for each release and keep RLS regression tests near the feature’s acceptance criteria.

---

# 4. Route Inventory

The following is the current source-level route map. Status is a product classification, not a claim that every interaction has been browser-verified in this audit.

| Route                    |                         Auth | Primary goal                                                                       | Classification       | Status / note                                                                                                                |
| ------------------------ | ---------------------------: | ---------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `__root`                 |                          All | Provide document metadata, root error/not-found handling, and the application root | Core infrastructure  | Root layout; not a user destination.                                                                                         |
| `/`                      |                       Public | Understand Tethyr and choose Log in or Join Tethyr                                 | Core                 | Strong landing experience; public-only navbar is explicit. Many marketing sections still need cold-start/content validation. |
| `/login`                 |                       Public | Sign in or request password reset                                                  | Core                 | Password reset link and redirect are present. OAuth is not evidenced in current login/signup source.                         |
| `/signup`                |                       Public | Create an account and initial identity                                             | Core                 | Form exists; craft selection and post-signup guidance deserve review.                                                        |
| `/reset-password`        |       Public/auth transition | Set a new password from recovery flow                                              | Core                 | Route exists; older claims that it is missing are stale.                                                                     |
| `/dashboard`             |                   Auth-aware | See the next meaningful personal action                                            | Core                 | Custom workspace with its own shell; high complexity and duplicate-shell risk.                                               |
| `/_authenticated`        |                         Auth | Shared authenticated layout and auth boundary                                      | Core infrastructure  | Redirects unauthenticated users to `/login`; `ssr: false`.                                                                   |
| `/explore`               |                         Auth | Discover projects, people, roles, and skills                                       | Core                 | Project shelf is distinctive; opportunities connect to open roles. Needs hierarchy and scalable loading.                     |
| `/community`             |                         Auth | Ask, share, discuss, and connect project activity                                  | Supporting/Core loop | Broad feed and spaces model; risk of becoming a separate social product.                                                     |
| `/notifications`         |                         Auth | Understand actionable updates                                                      | Supporting           | Dropdown and full page exist; notification taxonomy should remain action-oriented.                                           |
| `/messages`              |                         Auth | Continue a collaboration conversation                                              | Supporting/Core loop | Connection-gated messaging with realtime and pagination. Project context can be stronger.                                    |
| `/profile`               |                         Auth | Manage “Your Studio” and show work                                                 | Core                 | Rich customizable profile; too many sections and data surfaces risk diluting work.                                           |
| `/u/$handle`             |                       Public | Understand a person through their work                                             | Core                 | Uses shared profile layout; public identity should prioritize projects and evidence over tags.                               |
| `/projects/$id`          |            Public/auth-aware | Understand and contribute to a living project                                      | Core flagship        | Most strategically important route; comprehensive but potentially overloaded.                                                |
| `/skills/$slug`          |                       Public | Explore a skill’s people, projects, and learning context                           | Supporting           | Useful discovery node; terminology needs canonicalization.                                                                   |
| `/challenges`            |                         Auth | Find practice/contribution challenges                                              | Supporting           | Challenge discovery exists; should connect visibly to projects and evidence.                                                 |
| `/challenges/$id`        |                         Auth | Join, submit, review, and complete a challenge                                     | Supporting           | Review/pass criteria improve trust; verify end-to-end production behavior.                                                   |
| `/sessions`              |                         Auth | Schedule or manage learning/collaboration sessions                                 | Supporting           | Powerful but complex; should remain a collaboration tool, not a separate calendar product.                                   |
| `/sessions/$id`          |                         Auth | Attend/manage a specific session                                                   | Supporting           | Notes/resources/participants; direct project context could help.                                                             |
| `/library`               |                         Auth | Store personal notes, files, and links                                             | Secondary            | Useful knowledge layer; currently weakly connected to projects.                                                              |
| `/library/$id`           |                         Auth | Edit a library note/item                                                           | Secondary            | Rich editor exists; needs project-sharing relationship if it remains central.                                                |
| `/spaces/$slug/settings` |            Auth + permission | Manage a community space                                                           | Supporting/admin     | Deep settings surface; high permission and cognitive complexity.                                                             |
| `/spaces/$slug/reports`  | Auth + moderation permission | Review moderation reports                                                          | Supporting/admin     | Appropriate for governance; should not shape the main product identity.                                                      |

## Route relationships

```text
Landing
  → signup/login
  → Explore

Explore
  → Project
  → Person / Studio
  → Skill
  → Open role

Person / Studio
  → Projects
  → Skills and evidence
  → Message / connection / session

Project
  → README and identity
  → People and open roles
  → Apply / join / discuss
  → Updates, milestones, files, resources
  → Contribution activity

Community / Challenge / Session / Library
  → should feed project discovery, learning, collaboration, or evidence

Contribution evidence
  → reputation and future discovery
```

## Route evidence index

The table above is intentionally a compact inventory. The following index records the main implementation owners, data dependencies, and related destinations so future agents do not need to rediscover the architecture before acting:

| Route family              | Main components                                                                                            | Primary data/dependencies                                                                                  | Related routes                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Landing/auth              | `Navbar`, `Footer`, `landing-sections`, `AuthShell`                                                        | Supabase auth/current user; public project/skill/activity queries                                          | `/login`, `/signup`, `/reset-password`, `/dashboard`                           |
| Dashboard                 | `WorkspaceGrid`, `DashboardSidebar`, activity/suggestion/connection components                             | current user, projects, applications, sessions, connections, challenges, notifications, layout preferences | `/profile`, `/explore`, `/projects/$id`, `/challenges`, `/notifications`       |
| Explore                   | `ProjectShelf`, creator/role/skill result sections, `CreateProjectButton`                                  | projects, profiles, skills, open roles, skill matching                                                     | `/projects/$id`, `/u/$handle`, `/skills/$slug`, `/profile`                     |
| Studio/public profile     | `ProfileLayout`, profile tabs, reputation, skills, projects, activity                                      | profiles, teach/learn skills, projects, banner/avatar storage, activity, reputation                        | `/u/$handle`, `/projects/$id`, `/skills/$slug`, `/sessions`, `/messages`       |
| Project workspace         | `ProjectHero`, `ProjectMainContent`, README, people, roles, discussions, files, repos, resources, activity | projects and child tables, storage signed URLs, repositories/files, applications, contributors, posts      | `/explore`, `/u/$handle`, `/profile`, `/community`                             |
| Community/spaces          | composer/feed/post cards, space header/settings/reports, challenges                                        | posts/comments/replies, spaces/members/join requests, moderation, polls, feedback, notifications           | `/projects/$id`, `/challenges/$id`, `/notifications`, `/spaces/$slug/settings` |
| Sessions/messages         | session layouts/wizard/calendar; message thread/list                                                       | sessions/participants/availability, connections, messages/realtime channels                                | `/u/$handle`, `/projects/$id`, `/profile`, `/notifications`                    |
| Library/skills/challenges | library layout/editor; skill route; challenge list/detail                                                  | library items/collections/tags/storage; skills/catalog; challenges/participants/submissions                | `/projects/$id`, `/explore`, `/profile`, `/community`                          |
| Notifications/admin       | notification feed/dropdown; space settings/reports                                                         | notifications/realtime; space membership/moderation/report tables                                          | destination-specific project/profile/challenge/space routes                    |

## Route concerns

- The product has a good separation between public discovery, authenticated work, and moderation/admin routes.
- `/dashboard` being outside `/_authenticated` is a source-level architectural inconsistency even if it has equivalent auth behavior.
- Public `/projects/$id` and `/u/$handle` need especially careful privacy handling because nested project data, files, updates, people, and activity can reveal more than the hero intends.
- “Projects” is both a sidebar destination label and an Explore tab concept. This is reasonable, but the distinction between “discover projects” and “your projects” should be explicit.

---

# 5. UI/UX Issues

## P0 — Confusing or trust-threatening

### 5.1 Duplicate layout ownership risk

The reported profile customize view showed two copies of the toolbar and two Projects headers. The source contains a reusable `WorkspaceGrid` with its own customization controls and profile/dashboard modules that render their own section headers. This is a strong architectural explanation for the observed symptom, although a live browser reproduction was not available during the read-only audit.

**Problem:** A wrapper and a child both believe they own the title/action chrome.

**Recommendation:** Define one contract:

- `WorkspaceGrid` owns only layout controls, or
- each module owns its own header, while the grid supplies no module header, or
- a module descriptor supplies a single header model rendered by one shell.

Add a regression test that renders customize mode and asserts one toolbar and one module header per module.

### 5.2 Blank dashboard regions

The dashboard has optional modules that return `null`, loading modules, query-backed sections, and conditional empty states. This is valid in principle, but full-width blank rectangles are a high-signal usability failure if they are visible during normal loading or failed data retrieval.

**Recommendation:** Every module needs an explicit state contract:

```text
idle / not requested
loading
success with data
success empty
error
hidden by user
```

A hidden module should take no grid space. A loading module should have a layout-matched skeleton. An error should show a compact retry state. An empty module should explain the next action.

### 5.3 Project page overload

The project page exposes README, updates, milestones, people, open roles, discussions, files, repos, resources, activity, community, and timeline. This is strategically rich but cognitively heavy.

**Recommendation:** Make the first view a project workspace composition, not a 12-tab inventory:

```text
README / identity
Current work and updates
People / open roles
Conversation
Evidence and deep tools
```

Keep deep tools discoverable, but do not give every tool equal first-order prominence.

## P1 — Significant experience problems

### 5.4 Dashboard module repetition

Dashboard modules include projects, applications, challenges, connections, suggested projects, suggested creators, trending skills, activity, weekly reputation, profile completeness, and more. Many are individually reasonable, but the combined page can become a list of independent cards rather than a personal workspace.

**Recommendation:** prioritize “today” and “your active work.” Make discovery modules secondary and optional. Prefer a few compositional sections over many equal-weight cards.

### 5.5 Profile information density

Profile/Studio combines identity, banner, avatar, bio, stats, reputation, social links, skills, projects, communities, activity, sessions, reviews, and customizable modules.

**Recommendation:** project work should visually dominate. Move operational/account-like information down or into editing surfaces. Keep public profile and private studio variants intentionally different.

### 5.6 Empty-state product impression

Current source contains useful empty states such as no people, no skills, no files, no tethrs, and no discussions. However, multiple empty discovery surfaces together can make an early network feel abandoned.

**Recommendation:** use truthful starter content, curated example projects, clear onboarding actions, or “coming from your profile” explanations. Do not fabricate engagement metrics or fake user activity.

### 5.7 Community scope drift

Community supports many post types, spaces, challenges, polls, feedback, moderation, follows, and project linking. Without strong project context, it can become an engagement feed that competes with the collaboration loop.

**Recommendation:** foreground project updates, requests for help, lessons learned, feedback requests, and concrete collaboration prompts. Treat general posting as secondary.

### 5.8 Sessions complexity

Sessions include availability, calendar views, requests, history, resources, notes, and scheduling. This is valuable for learning and collaboration but may be too much for the primary navigation level.

**Recommendation:** preserve the capability, but enter it from a person/project collaboration context where possible. A session should answer “why are these people meeting?” and connect to a project, skill, or goal.

## P2 — Valuable polish and clarity

- Explore’s project shelf is distinctive but should have a clear accessible grid/list alternative if the carousel interaction is difficult for keyboard or screen-reader users.
- Project cover behavior differs between center and preview cards (`object-contain` versus `object-cover`); decide whether the difference is intentional.
- Public pages should maintain strong headings and predictable back navigation.
- Long pages need clear section landmarks, not only scroll-spy controls.
- Images with meaningful content should use meaningful alt text; decorative images can use empty alt intentionally, but this should be deliberate rather than default.

---

# 6. Design System Inconsistencies

## 6.1 The design token contradiction

`src/styles.css` describes a restrained workspace system:

- tight radii from 2–8px;
- panels and rules rather than floating cards;
- no shadows for ordinary cards;
- restrained motion;
- neutral structure with semantic colors.

`AGENTS.md` similarly says to avoid excessive rounded containers, gradients, blur, shadows, and generic SaaS patterns.

Actual source usage still contains a substantial legacy/marketing layer:

- approximately 393 `rounded-xl` occurrences;
- approximately 355 `rounded-full` occurrences;
- approximately 128 `rounded-lg` occurrences;
- approximately 64 `rounded-md` occurrences;
- approximately 24 `rounded-sm` occurrences;
- approximately 124 `bg-surface` occurrences;
- approximately 121 `bg-surface-elevated` occurrences;
- approximately 96 `card-border` occurrences;
- approximately 37 `shadow-sm`, 22 `backdrop-blur-sm`, 16 `bg-gradient-brand`, 14 `shadow-md`, and 9 `shadow-lg` occurrences.

These counts do not prove every usage is wrong. They do prove the product has two visual languages: a restrained workspace language in tokens and some newer/older markup, and a more decorative rounded/card/gradient language in many pages.

## 6.2 Typography

Strengths:

- semantic fonts and mono usage exist;
- base heading hierarchy is defined in CSS;
- `section-label`, `numeric`, and `mono` utilities support consistent information display.

Risks:

- page-local arbitrary sizes are common, especially around metadata and marketing sections;
- `font-display` historically appears in places where the token now maps to Inter, while `font-title` maps to Space Grotesk; this is a naming/intent mismatch;
- the landing page uses very large marketing typography while authenticated workspace surfaces use dense typography. This can be intentional, but it should be documented as two contexts rather than allowed to bleed across routes.

**Recommendation:** define three explicit type contexts: marketing, workspace, and long-form/editorial. Do not globally retune typography to solve one page.

## 6.3 Radius

The token scale says 2–8px, but `rounded-xl` is the most common explicit class and `rounded-full` is extremely common. The constitution permits full rounding for avatars and tags, not every button/container.

**Recommendation:** do not run a global search-and-replace. Create canonical component rules:

- inputs/buttons: small radius;
- panels: small radius;
- project/person/challenge objects: modest radius;
- avatars/tags/status chips: full radius;
- marketing hero only: large radius if composition requires it.

## 6.4 Shadows, gradients, blur, and glow

The CSS token layer neutralizes several legacy glow/shadow utilities, but markup still expresses decorative intent through gradients, blur, backdrop blur, and shadow classes. This creates confusing semantics: a class name can suggest visual emphasis while the token intentionally renders nothing.

**Recommendation:** either remove obsolete names gradually or document them as compatibility aliases. Avoid adding new uses of decorative utilities in workspace surfaces. Reserve them for brand/marketing moments or a clearly featured object.

## 6.5 Surfaces and borders

There are many combinations of `bg-background`, `bg-surface`, `bg-surface-elevated`, `bg-surface-sunken`, opacity variants, `card-border`, and direct border classes. Layering is useful, but opacity variants can make hierarchy difficult to reason about.

**Recommendation:** establish a surface ladder with examples and use named primitives (`panel`, `surface-section`, `panel-flush`, `panel-row`) in new work. Migrate opportunistically rather than undertaking a global visual rewrite.

## 6.6 Motion

The intended system is restrained and supports reduced motion. Some interactive components still have spatial transforms, hover scale, carousel motion, drag behavior, and animated border effects. This is acceptable for intentional interactions but should not be the default solution to every hierarchy problem.

---

# 7. Cardification Report

Cards are meaningful when they represent an independent object a user may inspect or act on. They are harmful when they are only wrappers around spacing or when every section competes as an equal object.

| Component/surface                 | Why it is currently card-like                      |          Necessary? | Recommendation                                                                                            |
| --------------------------------- | -------------------------------------------------- | ------------------: | --------------------------------------------------------------------------------------------------------- |
| Project cards / shelf objects     | A project is an independent object to discover     |                 Yes | Keep, but make the visual treatment restrained and consistent.                                            |
| Person/creator cards              | A person is a discoverable collaboration candidate |             Usually | Keep where comparison/discovery is the task; use list/row alternatives for dense views.                   |
| Challenge cards                   | Challenges are independent opportunities           |                 Yes | Keep; show purpose, evidence requirements, and project connection.                                        |
| Dashboard `SectionCard` modules   | Each module is a data widget                       |           Sometimes | Consolidate into larger “Today / Your work / Discover” sections; do not give all modules equal elevation. |
| Profile stats/reputation surfaces | Metrics and reputation are secondary evidence      |             Limited | Use a compact summary or inline rows; avoid duplicate stats and reputation cards.                         |
| Project tabs/sections             | Operational and evidence areas                     |         No, not all | Use workspace sections, grouped navigation, and rows rather than a card behind every tab.                 |
| Community post cards              | A post is an independent contribution              | Yes, with restraint | Keep feed items distinct; avoid nested cards inside post cards for every attachment.                      |
| Empty-state wrappers              | They provide visual grouping                       |           Sometimes | Prefer a section-level empty state; do not add a card solely to center text.                              |
| Form/dialog containers            | Dialogs need focus and modal hierarchy             |                 Yes | Keep modal surface and border; do not duplicate containers inside.                                        |
| Library item cards                | Items are independently actionable                 |    Yes in grid view | Provide list view and avoid badges for every metadata field.                                              |
| Session overview cards            | Some next-session summaries are useful             |             Limited | Keep the next action prominent; turn supporting counts into rows.                                         |
| Notification cards                | Each notification is an action/event               |             Usually | Use a feed/list treatment; reserve card elevation for unread or urgent state.                             |
| Skill chips/badges                | Skills are compact labels                          |        Yes, as tags | Keep pills only for tags/status; avoid making the entire skill section a pill wall.                       |

## Cardification conclusion

Do not eliminate cards. **Change their role.** Projects, people, challenges, library items, posts, and notifications can be objects. Dashboard sections, project navigation, profile metadata, and supporting statistics should more often be compositions, rows, panels, or continuous surfaces.

---

# 8. Duplicate Code

## Significant or likely duplication

### Dashboard shell vs authenticated shell

- `src/routes/dashboard.tsx` includes its own desktop sidebar, mobile overlay, top header, search, notification dropdown, theme toggle, palette, and scroll-to-top behavior.
- `src/components/tethyr/authenticated-shell.tsx` provides a very similar shell for `/_authenticated` routes.

**Recommendation:** establish a shared shell primitive or document why dashboard intentionally differs. Do not maintain two copies of navigation behavior without tests.

### Customize/layout chrome

- `WorkspaceGrid` owns customize-mode controls and layout persistence behavior.
- Profile/dashboard module renderers own module titles and actions.

**Recommendation:** use one header ownership contract and a descriptor-driven module model.

### Create project actions

`CreateProjectButton` is reused across navbar, sidebar, Explore, dashboard, empty states, onboarding, and hero/action surfaces. Reuse is good, but labels and placement need a consistent product rule:

- public landing: no create action;
- authenticated workspace: create action is available;
- empty project state: create action is contextual.

### Profile identity/project/skill sections

Profile route logic and `profile-sections.tsx` carry overlapping editing and presentation responsibilities. This makes it easy for labels, validation, and persistence to diverge.

### Authenticated state handling

Several routes/components independently handle loading, unauthenticated, error, retry, and empty states. Shared primitives exist, but their use is not universal.

### Supabase query shapes and casts

Nested selects and `as any` casts repeat across projects, community, profile, sessions, notifications, and dashboard. Canonical typed query functions would reduce drift.

### Activity and reputation representations

Activity can come from `activity_events` and contribution logs; reputation is represented in profiles, dashboard modules, profile surfaces, and achievements. The activity timeline has grouping/deduplication logic, which is good, but the product should define one canonical event vocabulary and one explanation path for score changes.

## Intentional duplication to preserve

- Public profile vs private Studio can share visual primitives but should not be forced into identical behavior.
- Project hero, project card, and project shelf preview can share data selectors but need different compositions.
- Full notifications page and notification dropdown can share notification formatting while differing in density and navigation.
- Community posts and project updates can share rendering infrastructure but should preserve project context.

---

# 9. Dead / Unused Code

> **Scope note:** This is a preliminary, non-destructive dead-code scan—not proof that every unused symbol in the repository has been found. A complete answer requires TypeScript/ESLint project analysis plus reference review, and must account for route generation, dynamic imports, Supabase migrations, and externally linked public routes.

This audit did not perform a destructive dead-code removal pass. The following categories require verification before deletion:

## Safe candidates for investigation

- Compatibility design utilities whose visual output is now neutralized (`text-gradient-brand`, glow aliases, legacy color aliases).
- Old audit/spec references that claim features are missing even though the source now implements them.
- Unused icon imports or constants in large profile/route files, where earlier audits already identified possible leftovers.
- Historical feature remnants around retired QuickMatch behavior.

## Needs verification

- Any route that appears to duplicate another route’s destination.
- Unused UI primitives under `src/components/ui`; these may be generated shadcn/Radix building blocks intended for future use.
- Components that return `null` for optional modules; many are legitimate hidden states, not dead code.
- Legacy `AuthShell` usage in dashboard; it may be required for unauthenticated fallback.
- “Coming soon” or placeholder text in settings/profile/community; some are intentional product sequencing rather than unreachable code.

## Do not remove yet

- Supabase migrations, even if corrective or repetitive. They encode production history.
- RLS helper functions and security-definer RPCs without database dependency analysis.
- Shared empty/loading/error components.
- Public profile/project components that appear unused in authenticated navigation but are linked externally.

## Process recommendation

Add a lightweight dead-code review to feature work: when a replacement is introduced, record the old component, its references, and a removal decision. Do not rely on filename similarity alone.

---

# 10. Unfinished Features

| Feature                  | What exists                                                                                       | What appears missing/unclear                                                                                          | User impact                                                     | Priority                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| OAuth/social login       | Email auth is present; no current `signInWithOAuth` evidence in login/signup                      | Older audit calls out social buttons, but current source needs direct verification; do not assume buttons still exist | Confusing if advertised; low if not advertised                  | P2 / verify                                  |
| Password reset           | Login contains “Forgot password?” and `/reset-password` exists                                    | End-to-end email/session verification still needs browser/provider testing                                            | Recovery failure would block users                              | P1 verify                                    |
| Project creation         | Shared `CreateProjectButton` appears in authenticated navbar/sidebar/dashboard/Explore/onboarding | Full create/edit/visibility/persistence flow needs authenticated browser and database verification                    | Users may still encounter dead or inconsistent entry points     | P0 verify                                    |
| Workspace customization  | Drag, resize, hide/pin/reset concepts and persistence exist                                       | Duplicate chrome and module state contract need regression coverage                                                   | Users lose trust in layout controls                             | P0                                           |
| Polls                    | Poll validation, expiry, and row-locked vote RPC exist                                            | Live multi-user UI/server behavior and expiry refresh need verification                                               | Votes can appear stale if UI does not refresh at expected times | P1 verify                                    |
| Feedback requests        | Focus areas and draft persistence exist                                                           | Completion/response loop and notifications need end-to-end validation                                                 | Requests may not lead to useful collaboration                   | P1                                           |
| Role applications        | Atomic accept/decline RPCs, race handling, notifications, project People navigation exist         | Production migration state and all applicant outcomes need verification                                               | Core collaboration loop fails if status is stale                | P0 verify                                    |
| Community composer       | Rich post types, drafts, attachments/links/polls/feedback metadata exist                          | Composer is very large; rich editing, validation, and error states need consolidation                                 | Posting can feel complex and brittle                            | P1                                           |
| Community spaces         | Membership, review join flow, rules, moderation, bans, reports exist                              | Permission matrix and mobile settings flow need broad tests                                                           | Governance errors can harm trust                                | P1                                           |
| Challenge review         | Submission, criteria, creator review, pass-gated reputation migrations exist                      | Verify no self-award path remains on production DB                                                                    | Reputation can be farmed if review is bypassed                  | P0 verify                                    |
| Library ↔ project bridge | Personal notes/files/links exist                                                                  | Existing audit identifies weak project sharing/linking                                                                | Knowledge remains isolated from building                        | P1                                           |
| Sessions                 | Scheduling, availability, calendar, requests, history, notes/resources exist                      | Video/audio, email reminders, external calendar sync are absent                                                       | Collaboration can stop at scheduling                            | P2; do not add until core loop proves demand |
| Messages                 | Connection-gated realtime messages, read state, typing, pagination exist                          | Attachments, search, project context absent                                                                           | Collaboration conversation is detached from work                | P1 for context, P2 for attachments           |
| Skill hub                | Teachers, learners, projects, popularity and catalog-backed pages exist                           | Endorsements/progression/related skills are not prominent                                                             | Skill discovery can feel directory-like                         | P2                                           |
| Notifications            | Dropdown/page, categories, read state, realtime count, role/challenge/community paths exist       | Taxonomy consistency and destination coverage need regression tests                                                   | Users may miss actionable changes                               | P1                                           |
| Cold-start discovery     | Empty states and suggestions exist                                                                | Curated truthful starter content is limited                                                                           | First impression can feel empty                                 | P1/P2                                        |

## Important distinction

A feature can be **implemented in code** and still be **unfinished as a user journey**. The audit should evaluate:

```text
entry point → loading → validation → permission → persistence → notification → destination → evidence
```

---

# 11. Broken User Flows

These are the end-to-end flows most worth testing next. Some are verified risks; others are high-value verification targets.

## 11.1 Discover → apply → join project

Expected:

```text
Explore role
  → inspect project and people
  → apply with context
  → owner receives notification
  → owner accepts/declines atomically
  → applicant receives outcome
  → project People state updates
  → contribution becomes visible
```

Current source supports much of this. Verify migration state, stale clients, race conditions, alternate navigation paths, and non-owner attempts.

## 11.2 Create project → publish identity → invite contribution

Expected:

```text
Create project
  → save identity/readme/visibility
  → add role or update
  → discover project publicly if allowed
  → receive application/join request
```

This is central enough to require a browser regression suite.

## 11.3 Profile/studio customization

Expected:

```text
Enter customize mode
  → one toolbar
  → each module has one header
  → drag/resize/hide/pin
  → save
  → reload
  → layout persists
  → reset returns to canonical layout
```

The duplicate toolbar/header report is a direct reason to prioritize this flow.

## 11.4 Poll creation → vote → expiry

Expected:

```text
Compose valid poll
  → save draft and publish
  → vote once
  → concurrent votes do not overwrite
  → expiry is enforced server-side
  → open page transitions to Ended
```

Current implementation direction is strong; test realtime/read refresh and expired UI behavior.

## 11.5 Feedback request → response → evidence

Expected:

```text
Choose focus areas
  → publish request
  → discoverer understands what feedback is wanted
  → response is attributable to the project/person
  → requester can use it as contribution evidence
```

The product should decide whether feedback belongs primarily to a project, a profile, or a post—and render that relationship consistently.

## 11.6 Library knowledge → project contribution

Expected:

```text
Create note/resource
  → attach or share to a project
  → collaborator can access according to permissions
  → resource appears as project evidence
```

This is a currently weak loop and likely the highest-value knowledge-layer improvement.

## 11.7 Challenge submission → review → reputation

Expected:

```text
Join challenge
  → submit proof
  → creator reviews against pass criteria
  → pass/reject notification
  → only a pass creates reputation/badge evidence
```

Verify every direct update path is closed by RLS and triggers.

---

# 12. Navigation Problems

## Current navigation model

Authenticated sidebar groups are:

- **Workspace:** Dashboard, Projects, Library
- **Network:** Community, Messages, Notifications
- **Learning:** Profile, Challenges, Sessions

This is a reasonable first grouping, but “Projects” points to Explore while the user’s own projects live across Dashboard/Profile. “Profile” is also the Studio, and Library is a separate personal workspace.

## Problems

1. **Dashboard shell and authenticated shell are duplicated.** Navigation behavior can drift.
2. **Projects means both “discover” and “my work.”** The sidebar label should make the primary intent clear.
3. **Profile vs Studio is unresolved language.** “Profile” is easier to understand; “Studio” better expresses identity-through-work. Pick one primary label and use the other as a subtitle if needed.
4. **Sessions, Challenges, and Library are top-level despite being supporting systems.** They may deserve contextual entry points from projects/people before permanent top-level prominence is increased.
5. **Notifications are a destination and an overlay.** This is normal, but every notification type must have a valid, permission-safe destination.
6. **Community spaces settings/reports are deep routes.** They need clear return navigation and permission-specific empty/error states.
7. **Public and authenticated navigation need distinct intent.** The landing page now correctly keeps signed-out actions minimal; do not reintroduce creation or workspace navigation there.

## Recommended navigation direction

```text
Home / Landing (public)

Authenticated:
  Today / Dashboard
  Discover (projects, people, roles, skills)
  My Studio (identity, projects, skills, evidence)
  Community (project-centered discussion)
  Messages / Notifications (action inbox)

Contextual:
  Project workspace
  Sessions
  Challenges
  Library
  Space moderation/settings
```

Do not implement this as a broad navigation rewrite without analytics or user testing. First fix naming and ownership within the existing structure.

---

# 13. Mobile Problems

## Strengths

- Authenticated shell provides a mobile menu and overlay sidebar.
- Community has mobile bottom navigation and drawers.
- Project shelf has a mobile fallback and touch interaction.
- Forms and major routes contain responsive classes and loading states.

## Risks requiring verification

- Dashboard customization with drag/resize is fundamentally different on touch devices; desktop controls should not simply shrink.
- Project deep navigation can become a horizontal overflow or an unreadable tab strip.
- Three-column Community layout needs a strong priority order on small screens.
- Messages two-pane layout needs a clear conversation-list/thread transition.
- Sessions calendar views require a mobile-specific agenda-first mode.
- Project file explorer and code/repository browsing may need a dedicated mobile hierarchy rather than compressed desktop rows.
- Large landing hero typography may overflow at 320px; this is present in prior audit evidence and should be tested at narrow widths.
- Modals with many fields—project creation, challenge creation, space settings, feedback/poll composer—need keyboard and viewport testing.

## Recommendation

For each major surface define a mobile composition, not just responsive widths:

- Dashboard: Today-first list.
- Project: identity → current work → people/roles → conversation → deep tools.
- Community: feed first; spaces/trending behind drawers.
- Profile: identity → projects → evidence → supporting metadata.
- Sessions: agenda first.
- Library: list first, grid optional.

---

# 14. Accessibility Problems

## Strengths

- Many icon-only controls have `aria-label` values.
- Focus-visible outlines are defined globally.
- Dialogs, menus, drawers, tabs, tooltips, and Radix primitives provide a good base.
- Reduced-motion CSS exists.
- Loading regions sometimes provide `aria-label` descriptions.

## Findings and risks

### Image semantics

Many `<img>` elements use empty alt text. This is correct for decorative images but insufficient for meaningful project covers, profile banners, screenshots, and resource previews. Audit each image by purpose.

### Complex interactive widgets

- Project shelf keyboard and screen-reader behavior needs direct testing.
- Workspace drag/resize controls need an accessible non-pointer alternative; an arrow-key move label exists, but the complete interaction should be tested.
- Scroll-spy navigation should not be the only way to understand project sections.
- Mobile overlays need focus return and focus trapping verification.

### Buttons and links

- Icon-only controls generally have labels, but large source files make it easy for new controls to regress.
- Some links use text labels such as “View all,” “Explore,” or arrows without enough surrounding context when read out of order.

### Contrast and dynamic accents

- Dynamic user palette colors should be tested against both light/dark surfaces and text. The CSS provides semantic fallbacks, but runtime banner-derived colors can still reduce contrast.

### Forms and errors

- Validate that every input has an associated visible or programmatic label.
- Ensure toast-only mutation errors are also understandable to screen readers and persist long enough to act on.
- Error text should be connected to fields where validation is field-specific.

## Priority

- **P0/P1:** keyboard/focus testing for project shelf, workspace customization, dialogs, and mobile navigation.
- **P1:** image alt audit for meaningful content and dynamic accent contrast.
- **P2:** improve contextual link names and non-toast error announcements.

---

# 15. Performance Problems

## Evidence-based signals

- Approximately 52,700 source lines create a large application surface.
- Several route/component files exceed 900–1,300 lines.
- Explore, dashboard, landing, community, and project pages can combine multiple queries and rich interactive components.
- Realtime subscriptions are used for messages, notifications, and connections.
- Some lists are bounded with `.limit()`, and messages use pagination/infinite-query behavior.
- Some queries use high limits, including community-space and library-related data. These are acceptable for small MVP datasets but will not scale indefinitely.
- Dashboard `renderModule` has a large dependency surface and multiple query-backed modules.
- Global search, project shelf, workspace grid, editor surfaces, and realtime channels all add client work.

## Recommendations

1. Measure before optimizing. Add route-level performance traces or simple query timing in development.
2. Keep list limits and pagination explicit. Replace broad high-limit reads with cursor/pagination when real data volume grows.
3. Avoid duplicate dashboard and shell subscriptions when both can mount.
4. Use selectors/view models to avoid rerendering every module when one query changes.
5. Lazy-load deep project tools, editors, charts, and repository/file surfaces where route behavior permits.
6. Ensure realtime subscriptions are cleaned up and keyed to the current user/project/space.
7. Optimize images at their source and preserve signed URL behavior; do not reintroduce raw storage paths.
8. Do not add a coverage provider or performance library merely because it is fashionable; add measurement where a decision depends on it.

## Do not optimize prematurely

- Do not replace the project shelf before measuring whether it is actually slow or confusing.
- Do not memoize every component.
- Do not split every large file without a stable boundary.
- Do not add infinite scroll to solve an empty-state problem.

---

# 16. Frontend / Backend Inconsistencies

## Strong areas

- Role application state transitions have database RPCs and notification paths.
- Poll votes have server-side validation/expiry and a row-locked RPC.
- Challenge review migrations gate reputation on review pass.
- Project visibility and child-resource policies have dedicated migrations.
- Community join request and moderation operations use backend authorization paths.
- Storage access has been hardened with signed URLs and bucket policies.

## Risks

### Schema drift

The large migration history and repeated repair migrations make schema drift a recurring operational risk. `KNOWN_ISSUES.md` documents that local and remote databases previously diverged.

### `as any` data boundaries

Typed-client bypasses can hide mismatched columns, enums, nested relationship shapes, and nullable values.

### Client-side assumptions

Examples to verify:

- status enums and stage values used in dashboard filters;
- private project child-resource visibility;
- notification types and destination parameters;
- project role/application nested relationship shapes;
- skill catalog names and teach/learn representations;
- challenge review status and reputation triggers;
- poll expiration timezone handling.

### Permissions

Every UI action that appears available should be tested for:

- anonymous user;
- signed-in non-owner;
- project owner;
- contributor;
- applicant;
- space member;
- moderator/owner;
- challenge creator/reviewer;
- banned user;
- private project visitor.

## Recommended consistency artifact

For each core entity, maintain a small contract table:

| Entity         | UI owner                | Database tables         | Mutations/RPCs           | Visibility rule              | Notification       | Evidence               |
| -------------- | ----------------------- | ----------------------- | ------------------------ | ---------------------------- | ------------------ | ---------------------- |
| Project        | Project workspace       | `projects` + children   | create/update/role/files | public/private + contributor | role/update/join   | activity/update        |
| Person         | Studio/public profile   | profiles + skills       | profile/skill updates    | public fields                | connection/message | projects/contributions |
| Role           | Project People          | open roles/applications | apply/accept/decline     | project visibility           | applicant outcome  | contributor roster     |
| Challenge      | Challenge detail        | challenges/participants | join/submit/review       | challenge policy             | review outcome     | pass/reputation        |
| Community post | Feed/project discussion | posts/comments/replies  | create/edit/delete/vote  | space/project policy         | mentions/feedback  | post/activity          |

---

# 17. Terminology Problems

## Proposed canonical dictionary

| Concept                                | Canonical term                             | Avoid or clarify                                                                       |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Product identity page for a member     | **Studio**                                 | Use “Profile” in URLs if retained for familiarity; do not alternate randomly.          |
| Work a person creates                  | **Projects**                               | “Workspace” means the project’s working environment, not the project itself.           |
| A person’s project environment         | **Project workspace**                      | Avoid calling every project a workspace.                                               |
| Person-to-person accepted relationship | **Connection** or **Tethr**                | Choose one primary UI term; explain the branded term once.                             |
| Someone who builds                     | **Builder** or **creator**                 | Pick based on context; avoid switching between contributor, creator, member, and user. |
| Skill offered to others                | **Skills I share**                         | “Skills I teach” can be a supporting explanation, not a competing label.               |
| Skill being developed                  | **Skills I’m growing**                     | Avoid “Growing” alone if the noun is unclear.                                          |
| Skill catalog page                     | **Skill**                                  | Teachers/learners may remain as relationship labels.                                   |
| Project participant                    | **Contributor**                            | Role-specific labels: owner, contributor, mentor.                                      |
| Open collaboration need                | **Open role**                              | “Opportunity” can be the Explore category containing open roles.                       |
| Reputation                             | **Reputation**                             | “Score” is too generic; always provide explanation/evidence.                           |
| Activity event                         | **Contribution activity** where applicable | Avoid presenting every profile edit as equal contribution.                             |
| Community grouping                     | **Space**                                  | “Community” can refer to the overall network or destination.                           |
| Personal knowledge area                | **Library**                                | Explain how it contributes to projects.                                                |
| Scheduled collaboration                | **Session**                                | Add project/skill context wherever possible.                                           |

## Immediate language issue

The codebase contains both `Skills I teach` / `Skills I want to learn` and `Skills I share` / `Growing`, plus skill pages using teachers/learners. This is not merely copy polish: it changes the user’s mental model of whether skills are claims, offers, or growth goals.

**Recommendation:** use “Skills I share” and “Skills I’m growing” as canonical profile labels. Explain “share” as teaching, mentoring, or collaboration in helper copy.

---

# 18. Product Logic Problems

## 18.1 Too many parallel centers

Projects are intended to be the center, but dashboard, community, skills, sessions, challenges, library, and messages can each become a destination users visit without project context.

**Decision:** every supporting feature should have a project/person/skill relationship visible at the moment it matters.

## 18.2 Reputation can become gamification

Achievements and scores can encourage contribution, but badges and percentages can pull the product toward a game or social status system.

**Decision:** reputation should be explanatory and evidentiary. Prefer “because you completed X with Y” over an unexplained number.

## 18.3 Connections can become popularity mechanics

Connections are useful for messaging and collaboration. Follower-like mechanics, counts, or popularity rankings conflict with the no-vanity principle.

**Decision:** keep relationship mechanics task-oriented: message, collaborate, invite, mentor, learn, or contribute.

## 18.4 Customization can become configuration work

Dashboard/profile customization supports identity, but drag/resize/hide/pin can itself become a product users must manage.

**Decision:** ship a strong default composition first. Make customization optional, reversible, and visually quiet.

## 18.5 Community can become an attention feed

Fourteen post types, spaces, polls, challenges, feedback, follows, and trending topics create a risk of optimizing for posting rather than building.

**Decision:** prioritize posts that change a project or help a person contribute. De-emphasize engagement counts and generic feed mechanics.

## 18.6 Library is disconnected

The Library is a good knowledge layer but has weak visible linkage to the project lifecycle.

**Decision:** if the Library remains, its next meaningful feature should be project sharing/attachment with clear permissions—not more personal organization features.

## 18.7 “Create project” placement needs product logic

The signed-out landing page should only present Log in and Join Tethyr in its header. Authenticated users need project creation accessible in workspace contexts. These are not contradictory once public and authenticated navigation are treated as separate states.

---

# 19. Features That Should Be Removed

These are recommendations for review, not changes made during the audit.

1. **Remove or retire obsolete decorative utilities** only after reference verification. Do not remove the CSS aliases before all call sites are understood.
2. **Remove duplicate or stale audit claims** from documentation when they are contradicted by current source, so future agents do not reimplement resolved work.
3. **Remove any popularity-oriented follower/count behavior** if it is not required for a concrete collaboration action. Preserve useful connections.
4. **Remove redundant stats presentations** when the same numbers appear in reputation, sidebar, dashboard, and profile without different meaning.
5. **Remove empty module shells** that reserve space without a meaningful loading, empty, or error state.
6. **Remove unsupported promises** from copy (OAuth, video calls, calendar sync, push notifications) unless the actual workflow exists.

Do not remove challenges, sessions, messages, community, or library simply because they are supporting features. Remove or simplify them only if they cannot connect meaningfully to building together.

---

# 20. Features That Should Be Merged

1. **Dashboard shell + authenticated shell behavior** into shared shell primitives, while preserving dashboard-specific content.
2. **Profile “Sessions” + “Reviews”** into a broader evidence/activity area if user research confirms they are rarely distinct destinations. Do not merge data blindly.
3. **Stats + reputation summary** into one evidence-oriented summary with separate raw counts and explanation, not duplicate numbers.
4. **Skills I teach / Skills I share / Growing / Skills I want to learn** into one canonical skill model with two relationship states: shared and growing.
5. **Project updates + project activity** into a clear distinction: authored progress updates versus system/contribution events, with one timeline where appropriate.
6. **Community project posts + project discussions** only at the data/navigation level where context is preserved; do not flatten project conversations into generic feed posts.
7. **Notification dropdown + notification page rendering** through a shared formatter/destination map.
8. **Empty-state patterns** through one compositional primitive with context-specific copy and action.

---

# 21. Features That Should Be Simplified

## Dashboard

Reduce default modules to:

1. today/next action;
2. active projects;
3. pending collaboration actions;
4. one discovery section;
5. concise evidence/reputation.

Make other modules optional or contextual.

## Project page

Use grouped information architecture:

```text
README / identity
Current work
People / open roles
Conversation
Evidence / tools
```

## Profile / Studio

Prioritize:

```text
Identity
Projects
Contribution evidence
Skills with proof
Supporting details
```

## Community composer

Start with a small set of purposeful post intents:

- project update;
- looking for help/open role;
- feedback request;
- lesson learned;
- showcase;
- question.

Keep advanced types behind an intentional “more” path if they are still needed.

## Sessions

Keep scheduling but make the first interaction simple: who, why, project/skill context, time, and confirmation. Defer advanced calendar views until needed.

## Library

Keep notes/files/links but make “attach to project” a first-class relationship before adding more collections/tags.

## Reputation

Show evidence before score. A compact score can remain, but the user should immediately understand why it changed.

---

# 22. Features That Should Be Added

Only additions that strengthen the core loop are recommended.

## 22.1 Project contribution summary

**Problem:** Visitors can see many project areas but may not understand what is happening now or how to help.  
**Evidence:** Project page has many deep sections.  
**Solution:** A concise “Current work / Needed next” summary with links to open roles, active milestone, latest update, and discussion.  
**Priority:** P1.  
**Scope:** Medium.  
**Need:** Yes.

## 22.2 Project-context links for supporting actions

**Problem:** Messages, sessions, feedback, challenges, and library items can be detached from work.  
**Solution:** Optional but visible project/skill context on each action, with safe permissions.  
**Priority:** P1.  
**Scope:** Medium/Large depending on feature.  
**Need:** Yes for messages/library; validate for sessions/challenges.

## 22.3 Explicit module state contract and regression coverage

**Problem:** Blank dashboard regions and duplicate layout chrome undermine trust.  
**Solution:** Standard module state model plus tests for customize/default/loading/empty/error/hidden.  
**Priority:** P0.  
**Scope:** Medium.  
**Need:** Yes.

## 22.4 Truthful cold-start starter path

**Problem:** Empty community and opportunity surfaces can make the network feel abandoned.  
**Solution:** clearly labeled starter projects, suggested actions, or seeded demo content that is not presented as organic activity.  
**Priority:** P1/P2.  
**Scope:** Small/Medium.  
**Need:** Yes, but content strategy first.

## 22.5 Typed contract tests for core mutations

**Problem:** Many Supabase casts and migration dependencies create silent drift.  
**Solution:** typed query adapters and tests for project creation, role applications, polls, challenge review, visibility, and notifications.  
**Priority:** P0/P1.  
**Scope:** Medium.  
**Need:** Yes.

## Deliberately not recommended now

- video/audio calls;
- external calendar sync;
- push notifications;
- public API;
- mobile app;
- analytics dashboard;
- leaderboards;
- more social reactions;
- more project tabs;
- another generic recommendation surface.

These may eventually be valuable, but they do not outrank making the existing loop coherent and trustworthy.

---

# 23. P0 / P1 / P2 / P3 Roadmap

## P0 — Must fix / verify before broader growth

1. Reproduce and fix duplicate customize toolbar/module headers; add regression coverage.
2. Eliminate blank dashboard module regions with explicit state contracts.
3. Verify production migration state and run RLS regression tests for current migrations.
4. Test project creation, project visibility, files, roles, applications, and contributor transitions end-to-end.
5. Test challenge review/pass gating and reputation triggers end-to-end.
6. Verify notification destinations and permissions for role, challenge, community, feedback, and session events.
7. Canonicalize skill/profile terminology and remove contradictory labels.
8. Ensure public landing remains signed-out simple: Log in and Join Tethyr; keep creation actions authenticated only.

## P1 — Important core experience work

1. Recompose the project page around README/identity/current work/people/conversation/evidence.
2. Reduce default dashboard hierarchy to Today, Your work, Collaboration actions, Discovery, and Evidence.
3. Connect Library items to projects with clear sharing/visibility rules.
4. Add project context to messages and feedback; validate whether sessions/challenges need the same.
5. Improve public Studio so projects and contribution evidence dominate metadata.
6. Extract and type high-risk Supabase query/mutation adapters.
7. Add authenticated browser coverage for dashboard, profile customization, Explore opportunities, project People, and core auth transitions.
8. Add accessibility tests for project shelf, workspace customization, dialogs, overlays, and dynamic accents.

## P2 — Valuable depth and polish

1. Curated truthful cold-start content/onboarding.
2. Explore grid/list alternative alongside project shelf.
3. Challenge discovery and skill hub cross-linking improvements.
4. Message attachments/search if collaboration demand supports them.
5. Profile sessions/reviews information architecture simplification.
6. Image alt and contextual-link audit.
7. Pagination/cursors for growing lists.
8. Reduce legacy visual utilities and migrate high-traffic surfaces to panel primitives.

## P3 — Future / defer

1. Video/audio sessions.
2. Google/Outlook calendar sync.
3. Push notifications and email digests.
4. Public API.
5. Native mobile app.
6. Advanced analytics.
7. Leaderboards and progression systems.
8. Large-scale visual redesign.

---

# 24. Tethyr Design Constitution

## Identity

Tethyr is a creative collaboration network where people become known through what they build.

## Visual hierarchy

1. Page background.
2. Quiet section/surface.
3. Interactive object or workspace panel.
4. Focused/active state.
5. Modal or critical overlay.

Not every element receives a border, shadow, radius, or background.

## Cards

Cards are for independent objects: projects, people, challenges, posts, library items, or meaningful notifications. Do not use cards solely to create spacing or to wrap every dashboard section.

## Surfaces

Prefer continuous workspaces, sections, panel rows, and separators when content belongs together. Let composition and whitespace establish hierarchy.

## Borders

Use borders to define interactive boundaries and data grouping. Do not border every nested element. Use accent borders sparingly for active/featured states.

## Radius

Use tight radii for workspace surfaces, inputs, and buttons. Reserve full rounding for avatars, tags, status chips, and intentionally branded controls. Large radii belong only to deliberate marketing/hero compositions.

## Typography

Use dense, legible workspace type; expressive display type only where brand or content hierarchy warrants it. Metadata must remain readable. Do not solve a local problem by changing global type tokens.

## Color

Neutral structure first. Semantic colors communicate trust, learning, teaching, AI, warning, and active state. Dynamic user colors accent the structure; they do not replace it or dominate the page.

## Animation

Motion explains state, interaction, and spatial change. Keep it restrained, short, and reduced-motion aware. Do not add glow, blur, lift, scale, or parallax merely to make a surface feel modern.

## Spacing and density

Use whitespace intentionally. Avoid both cramped metadata walls and empty reserved regions. A hidden module should not leave a hole.

## Responsive behavior

Mobile is a different composition, not a shrunken desktop. Prioritize the next action, identity, project work, people, and conversation.

## Project pages

The project is Tethyr’s flagship workspace. The first experience is:

```text
README → identity → current work → people → conversation → evidence
```

Deep files, repos, resources, and activity remain available but do not displace the human/project/collaboration story.

## Profiles / Studios

A Studio is a person represented through work. Projects and contribution evidence dominate. Skills are meaningful when supported by work, teaching, learning, or collaboration.

## Dashboard

The dashboard answers: **What is the next meaningful thing I can do?** It is not a showcase of every feature.

## Navigation

Expose the loop, not the database schema. Use contextual links from projects and people for supporting systems.

## Explicit DO

- Do preserve the project/person/collaboration relationship.
- Do reuse existing components and tokens.
- Do make permissions and state transitions explicit.
- Do show evidence for reputation.
- Do create loading, empty, error, and success states.
- Do make mobile composition intentional.
- Do test authenticated workflows, not just public routes.
- Do prefer one strong surface over several nested cards.
- Do make the smallest change that restores coherence.

## Explicit DON’T

- Don’t turn Tethyr into a generic SaaS dashboard.
- Don’t add a card to solve every spacing problem.
- Don’t add followers, vanity counts, reactions, or leaderboards without a concrete collaboration reason.
- Don’t add a new top-level route without explaining its place in the loop.
- Don’t duplicate headers, module chrome, query logic, or terminology.
- Don’t use gradients, glows, blur, or shadows as default decoration.
- Don’t let self-reported tags outweigh visible work.
- Don’t hide a failed query behind a blank region.
- Don’t claim a feature is complete because a button renders.
- Don’t redesign globally to solve a local issue.

---

# 25. AI Design Guardrails

Paste the following into future coding-agent prompts before implementation:

```text
TETHYR IMPLEMENTATION GUARDRAILS

You are modifying Tethyr, a creative collaboration network where people become known through what they build.

1. Audit first. Do not modify code while gathering evidence unless implementation has explicitly begun.
2. Treat AGENTS.md and the current forensic audit as product constraints, not decoration.
3. Preserve the core loop:
   Discover → understand work → find a contribution → collaborate → build → leave evidence → become known.
4. Projects are the flagship. A project page is a human/project/collaboration workspace, not a generic dashboard or repository clone.
5. Do not introduce generic SaaS patterns merely because they are familiar.
6. Do not add cards, pills, borders, shadows, gradients, blur, glow, or animation to solve a hierarchy problem without a specific reason.
7. Use existing tokens, primitives, components, query adapters, and terminology whenever possible.
8. Do not create a second component or header when an existing one can be reused.
9. Each module must have one owner for its title, actions, loading state, empty state, error state, and layout chrome.
10. Keep public landing navigation simple. Signed-out visitors need Log in and Join Tethyr; authenticated creation actions belong in authenticated workspace contexts.
11. Do not change global tokens to solve a local layout issue.
12. Do not redesign a page unless explicitly asked. Preserve intentional composition and whitespace.
13. Do not add a feature unless you can state:
    - the user problem;
    - who needs it;
    - its position in the Tethyr loop;
    - what it replaces or simplifies;
    - its permission/data dependencies;
    - what happens if it is not built.
14. Treat frontend state and database state as one contract. Verify migrations, RLS, enums, nullability, nested relationships, and notification destinations.
15. Sensitive transitions must be server-authorized and race-safe. Never rely only on a client ownership check.
16. Every important interaction needs loading, success, error, empty, and retry behavior.
17. Verify mobile as a composition, not merely a smaller desktop layout.
18. Preserve accessibility: semantic headings, labels, focus states, keyboard alternatives, useful alt text, contrast, reduced motion, and focus management.
19. Do not claim browser coverage from typecheck, build, or route smoke alone.
20. Make the smallest coherent change. Prefer removal, consolidation, and clearer hierarchy over feature expansion.
```

## Tethyr-specific pre-implementation checklist

- What route owns this experience?
- Is the user signed out, signed in, owner, contributor, applicant, moderator, or visitor?
- Is this a project action, person action, skill action, or generic social action?
- Does the UI use canonical terms?
- Is there already a shared component or query for this?
- Who owns the header and action chrome?
- What happens during loading and when the data is empty?
- What happens on failure or permission denial?
- Which migration/RLS policy supports it?
- How does this create visible contribution evidence?
- Does it work on mobile and keyboard navigation?
- Can the feature be removed or simplified instead?

---

# 26. Recommended Implementation Order

This order is dependency-aware and intentionally favors coherence over new capability.

## Phase 0 — Evidence and release safety

1. Preserve the current landing-page public-only behavior.
2. Reproduce the profile/dashboard customization duplication in an authenticated browser environment.
3. Verify the current remote migration state and run RLS regression tests.
4. Build a route/feature state matrix for auth, owner, contributor, applicant, moderator, and private visitor.
5. Add a short release checklist for migrations, type generation, smoke tests, tests, build, and authenticated browser checks.

## Phase 1 — Fix trust and state clarity

1. Establish the one-header/module ownership contract.
2. Fix duplicate customize toolbar and Projects module header if reproduced.
3. Add explicit dashboard module state contracts to eliminate blank regions.
4. Verify role application, notification, poll, feedback, and challenge-review end-to-end flows.
5. Verify privacy boundaries for private projects, child resources, files, and community spaces.
6. Canonicalize skill and profile terminology.

## Phase 2 — Strengthen the flagship project experience

1. Inventory project first-view information hierarchy.
2. Compose README, identity, current work, people/roles, conversation, and evidence.
3. Move deep files/repos/resources/activity/timeline into secondary navigation without removing capability.
4. Add a concise “what is happening / how can I help?” project summary.
5. Ensure contribution evidence is visible and attributable.

## Phase 3 — Simplify personal surfaces

1. Reduce dashboard default hierarchy.
2. Make Studio projects and evidence dominant.
3. Consolidate duplicate stats/reputation presentations.
4. Make customization optional and reversible.
5. Share shell primitives between dashboard and authenticated routes where safe.

## Phase 4 — Connect supporting systems to work

1. Library ↔ project sharing with permissions.
2. Project context in messages and feedback.
3. Project/skill context for sessions and challenges where valuable.
4. Notification destination map and regression coverage.
5. Community feed prioritization around project updates, help, lessons, feedback, and open roles.

## Phase 5 — Type, test, and scale the seams

1. Convert high-risk Supabase casts around mutations and permissions.
2. Extract query adapters and view models from the largest routes/components.
3. Add tests for core hooks, selectors, mutations, permissions, and state transitions.
4. Add authenticated browser coverage for dashboard, profile customization, Explore, project People, project creation, and auth recovery.
5. Add performance measurements and paginate only where evidence requires it.

## Phase 6 — Only then consider depth

Evaluate video, calendar sync, push/email notifications, leaderboards, analytics, API, or mobile app only after the existing collaboration loop has usage evidence and the product can explain why the next capability is needed.

---

# Contradiction Report

| A                                              | vs B                                                                                  | Why it matters                                                   | Canonical direction                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Design constitution: tight panels/rules        | Markup: frequent rounded-xl/full, cards, gradients, blur                              | Visual language feels assembled from different eras              | Workspace primitives and restrained tokens for product surfaces; branded effects only in marketing/featured moments |
| Public landing should be simple                | Older shared navbar behavior exposed authenticated creation logic                     | Signed-out intent becomes unclear                                | Public-only header: Logo + Log in + Join Tethyr; authenticated creation elsewhere                                   |
| Projects are the center                        | Community, Library, Sessions, Challenges, and Messages can be standalone destinations | Core loop fragments                                              | Add project/person/skill context to supporting actions                                                              |
| “Profile”                                      | “Studio”                                                                              | User may not know whether this is settings or identity/work      | Choose Studio as product concept, keep Profile in URL if needed                                                     |
| “Skills I teach”                               | “Skills I share”                                                                      | Changes whether skill is framed as a claim or contribution offer | “Skills I share” with explanatory teaching/mentoring copy                                                           |
| “Skills I want to learn”                       | “Growing”                                                                             | One is clear, one is vague                                       | “Skills I’m growing”                                                                                                |
| Dashboard shell                                | Authenticated shell                                                                   | Duplicate navigation/layout ownership                            | Shared shell primitive or explicit documented exception                                                             |
| Stats card                                     | Reputation card                                                                       | Same numbers can occupy multiple surfaces                        | Raw counts once; reputation with evidence/trajectory once                                                           |
| Project updates                                | Project activity                                                                      | Authored progress and system events can be confused              | Keep separate semantics, present through one coherent timeline where useful                                         |
| Project workspace                              | Repository/file explorer                                                              | Code is one evidence surface, not project identity               | README/human/collaboration first; deep technical tools second                                                       |
| No followers / reputation over popularity      | Follow/connection-like code paths                                                     | Social mechanics can drift toward vanity                         | Keep concrete connections; remove popularity framing                                                                |
| Existing audit says missing create/reset flows | Current source contains create buttons and reset route/link                           | Stale documentation can cause duplicate work                     | Mark audits with date/status and evidence links                                                                     |

---

# Design Drift Report

## Drift pattern 1: feature-driven dashboard

The dashboard accumulates modules because each feature needs a surface. The result risks presenting the product’s internal feature map instead of the user’s next meaningful action.

## Drift pattern 2: cardification as default hierarchy

The repository’s own design constitution warns against this, yet many surfaces still use repeated rounded bordered containers. The solution is not a global card purge; it is stronger composition and canonical panel primitives.

## Drift pattern 3: decorative legacy language

Noise, grid, blur, gradients, glows, and animated accents are present alongside a restrained workspace token system. The product should decide where expressive marketing language ends and workspace language begins.

## Drift pattern 4: metadata before work

Profiles and dashboards can surface counts, skill labels, reputation, availability, and links before the visitor sees what the person has made. This contradicts “work before metadata.”

## Drift pattern 5: supporting products competing with projects

Community, sessions, challenges, library, and messages have enough depth to become separate products. Their next improvements should deepen project collaboration, not expand standalone feature sets.

---

# Final Reasoning Test

> If every recommendation in this audit were implemented, would Tethyr become a better version of itself, or simply a bigger application?

The recommendations intentionally favor the former:

- fewer duplicate surfaces;
- fewer contradictory terms;
- fewer blank regions;
- fewer equal-weight dashboard modules;
- fewer disconnected supporting systems;
- clearer project identity;
- more visible human contribution;
- stronger permissions and state contracts;
- deeper testing at the seams;
- no speculative feature expansion until the loop proves it needs it.

The target is not maximum capability. The target is:

> **People building things together and becoming known through what they make.**

---

# Audit limitations

- This was a source and documentation audit, not a full authenticated browser session.
- Browser automation coverage was unavailable in the current environment because the project does not have Playwright installed and no usable browser-agent capture was produced.
- Database production state was not independently queried during this read-only pass.
- Counts are approximate and command-dependent; they are evidence of patterns, not quality scores.
- Findings marked “needs verification” should be confirmed before implementation decisions.

**No application code was changed while producing this document.**
