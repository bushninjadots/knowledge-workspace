# Tethyr Redesign — Phase 1 Audit Report

> **Created: 2026-08-23**
> **Status: Audit complete. Awaiting approval before Phase 2 (block foundation).**
> **References:** `TETHYR_REDESIGN_SPEC.md`, `TETHYR_REDESIGN_ARCHITECTURE.md`, `TETHYR_PRODUCT.md`, `TETHYR_ARCHITECTURE.md`

## 1. Scope and Method

This audit covers the entire Tethyr codebase as of 2026-08-23. Every route, component, hook, lib utility, database migration, and design token has been inventoried. The goal is to understand what exists, what can be preserved, what needs to change, and how to safely migrate to the block/page/template architecture.

**Baseline:** TypeScript typecheck passes. 350 Vitest tests pass. 47 test files. Route smoke passes.

---

## 2. What Tethyr Is Today

Tethyr is a **creative collaboration network** with:

- **29 routes** (5 public, 24 authenticated)
- **~216 Tethyr components** across 7 domains
- **29 hooks** managing data fetching, mutations, and state
- **55 lib files** providing utilities, validation, and shared logic
- **124+ database migrations** building a rich schema with RLS

The product is **materially complete** in its current form — profiles, projects, skills, community, sessions, challenges, library, messages, connections, notifications, dashboard, and explore all work end to end.

### Architecture at a Glance

```
Public routes           Authenticated routes
─────────────────       ─────────────────────
/ (landing)             /dashboard
/projects/$id           /explore
/u/$handle              /profile (private studio)
/skills/$slug           /community
/teams/$slug            /challenges
/login, /signup,        /sessions, /sessions/$id
/reset-password         /library, /library/$id
/privacy, /terms        /messages
                        /connections
                        /notifications
                        /settings
                        /spaces/$slug/settings
                        /spaces/$slug/reports
```

---

## 3. Route Inventory

### 3.1 Public Routes

| Route                                  | Purpose                                                                     | Auth Boundary                          | Composition Pattern                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/` (index)                            | Landing page — hero, featured projects, trending skills, activity, spaces   | Public                                 | Large hero + sections as page flow                                                                 |
| `/projects/$id`                        | Public project workspace — README, workbench, people, discussions, evidence | Public (with signed-out join state)    | Header → workbench → tabs (files/activity) → inline sections (people, discussions, needs, credits) |
| `/u/$handle`                           | Public studio — identity header + customizable workspace                    | Public (with connection-gated actions) | Fixed identity header → PublicStudioWorkspace (WorkspaceGrid)                                      |
| `/skills/$slug`                        | Public skill hub — people, projects, workshops                              | Public                                 | Header → tabs (sharing, growing, projects, workshops)                                              |
| `/teams/$slug`                         | Public team page                                                            | Public                                 | Team identity → members → projects                                                                 |
| `/login`, `/signup`, `/reset-password` | Auth entry flow                                                             | Signed-out only                        | Centered forms with validation                                                                     |
| `/privacy`, `/terms`                   | Legal pages                                                                 | Public                                 | Static content                                                                                     |

### 3.2 Authenticated Routes

| Route                    | Purpose                                    | Composition Pattern                                                                        |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/dashboard`             | Priority flow + WorkspaceGrid              | Welcome header → next-steps → WorkspaceGrid (12 modules, drag/drop/hide/pin)               |
| `/explore`               | Discover projects, creators, opportunities | Intent bar → SegmentedControl tabs → filters → card grids/project shelf                    |
| `/profile`               | Private Studio (identity management)       | ProfileLayout → tabs (Overview, Skills, Projects, Activity, Sessions, Communities, GitHub) |
| `/community`             | Community feed with spaces                 | Left rail + feed + right rail + mobile drawers                                             |
| `/challenges`            | Challenge discovery + detail               | List with filters → detail page with progress/submission/review                            |
| `/sessions`              | Sessions management                        | Sidebar tabs (upcoming, calendar, history, requests, availability)                         |
| `/sessions/$id`          | Session detail                             | Session info + participants + notes + resources                                            |
| `/library`               | Personal library                           | Sidebar + grid/list + search                                                               |
| `/library/$id`           | Library item detail                        | Note editor (TipTap) or file viewer                                                        |
| `/messages`              | Direct messages                            | Conversation list + thread + composer                                                      |
| `/connections`           | Connection management                      | Incoming requests + accepted list                                                          |
| `/notifications`         | Notification feed                          | Category tabs → filtered feed                                                              |
| `/settings`              | Account hub                                | Settings page component (delegated)                                                        |
| `/spaces/$slug/settings` | Space moderation                           | Space settings                                                                             |
| `/spaces/$slug/reports`  | Space reports inbox                        | Report queue                                                                               |

---

## 4. Component Inventory

### 4.1 UI Primitives (`src/components/ui/`)

20 files — standard Radix/Tailwind primitives: Avatar, Badge, Button, Card, Dialog, Drawer, DropdownMenu, HoverCard, Input, Label, Progress, ScrollArea, Select, Separator, Skeleton, Sonner, Tabs, Textarea. All well-established.

### 4.2 Tethyr Components by Domain

#### Community (23 files)

Post cards, feed, composer, poll composer, comment system, left/right sidebars, community header, space header, space chat, mobile bottom nav, challenge card, create challenge/space dialogs, share space dialog, space settings dialog, attach project panel, project card inline, communities section, challenges section.

**Pattern:** Heavily card-based. Feed + sidebar navigation. Deeply composed but many cards within cards. Mobile has its own separate navigation system.

#### Project (28 files)

Project header, workbench, pulse, tabs, README editor, README display, files explorer, activity, community posts, discussions, milestones, open roles, role applications, files, repos, resources, timeline, updates, needs, credits, main content, people, link picker, search, join modal.

**Pattern:** This is Tethyr's strongest composition. README-first with workbench and inline sections. Already structured like block-like sections (each section component = near-block). Some lazy-loaded.

#### Profile / Studio (28 files)

Profile layout, overview tab, skills tab, projects tab, activity tab, sessions tab, communities tab, reviews tab, public studio workspace, studio direction, section card, chip list card, projects card, project dialog, project library add dialog, timeline card, badges, contribution graph, banner overlay, banner strip, background picker, about card, text card, links card, skill editing, credits, GitHub connect.

**Pattern:** Private Studio uses tabbed interface. Public Studio uses WorkspaceGrid. Repeated SectionCard wrapping pattern (SectionCard → content). Identity header is fixed; workspace is customizable.

#### Sessions (13 files)

Sessions layout, sidebar, overview cards, upcoming sessions, sessions calendar, session history, session requests, session resources, today schedule, availability settings, schedule session wizard, request session dialog, session filters.

**Pattern:** Card-heavy. Sidebar + content area. Many cards within cards.

#### Library (9 files)

Library layout, sidebar, item card, collection card, collection dialog, note editor, file upload zone, search bar, signed image, GitHub link dialog.

**Pattern:** Sidebar + grid/list. Rich note editor (TipTap). File upload zone.

#### Workspace (2 files)

WorkspaceGrid + tests. React Grid Layout with drag/drop, resize, hide, pin, reorder, presets.

**Pattern:** Core interaction primitive. Used by dashboard, public studio, and private studio. 12-column grid. Module registry drives available modules.

#### Notifications (5 files)

Notification feed, card, header, dropdown, empty state.

**Pattern:** Feed-based list with category tabs. Shared category model with settings.

#### Top-Level (43 files)

Dashboard shell (authenticated shell, sidebar, navbar, footer, mobile nav), shared components (empty state, follow button, connect button, profile link, reputation display, activity timeline, achievements, badges, theme toggle, global search, segmented control, auth shell, oauth buttons, first session onboarding, welcome modal, next steps, suggested creators/projects, discover skills, drag-drop file input, connections card, background layer, settings page).

**Pattern:** Well-organized. Several reusable primitives (EmptyState, ProfileLink, SegmentedControl). Some one-off compositions.

### 4.3 Key Reusable Primitives Worth Preserving

- `WorkspaceGrid` — drag/drop grid; the most sophisticated interaction component
- `SegmentedControl` — ARIA tabs pattern
- `EmptyState` — consistent empty state with action CTAs
- `ProfileLink` — handle-safe profile linking
- `SectionCard` — used extensively but may need reconsideration
- `ActivityTimeline` — evidence/activity display
- `ProjectShelf` — 3D carousel
- `NoteEditor` — TipTap-based rich editor
- `SignedImage` — auth-aware image loading

---

## 5. Hook Inventory

### 5.1 Data Hooks (by domain)

| Hook                         | Domain        | Pattern                                     |
| ---------------------------- | ------------- | ------------------------------------------- |
| `useCurrentUser`             | Identity      | Single query, widely invalidated            |
| `useSkillsCatalog`           | Skills        | Catalog query + trending aggregation        |
| `useProjects`                | Projects      | Detail query + multiple list/mutation hooks |
| `useCommunity`               | Community     | Infinite query feed + CRUD mutations        |
| `useCommunitySpaces`         | Spaces        | Spaces CRUD + member count                  |
| `useSpaceChat`               | Chat          | Messages + send + realtime                  |
| `useSpaceJoinRequests`       | Moderation    | Join request management                     |
| `useSpaceReports`            | Moderation    | Report queue                                |
| `useSpaceSettings`           | Moderation    | Space settings CRUD                         |
| `useSpaceMembers`            | Membership    | Member list                                 |
| `useSpaceTyping`             | Realtime      | Typing indicators                           |
| `useSpaceReadState`          | Realtime      | Read receipts                               |
| `useChallenges`              | Challenges    | List + detail + join/progress/submit/review |
| `useSessions`                | Sessions      | CRUD + calendar + requests                  |
| `useConnections`             | Connections   | List + accept/decline                       |
| `useMessages`                | Messages      | Threads + send + typing + read              |
| `useNotifications`           | Notifications | Feed + realtime subscription                |
| `useNotificationPreferences` | Settings      | Mute categories                             |
| `useFollow`                  | Social        | Follow/unfollow                             |
| `useLibrary`                 | Library       | Items + collections CRUD                    |
| `useTeams`                   | Teams         | Team CRUD                                   |
| `useCredits`                 | Credits       | Credits roll                                |
| `usePublicStudioLayout`      | Layout        | Public studio layout persistence            |
| `useLayoutPreferences`       | Layout        | Private layout persistence                  |
| `useProjectLoop`             | Loop          | Return changes + evidence shelf             |
| `useProjectRepos`            | Repos         | GitHub repository integration               |
| `useProjectScrollSpy`        | UI            | Scroll position tracking                    |
| `useSignedUrl`               | Storage       | Signed URL generation                       |
| `useSkillEndorsements`       | Skills        | Endorse/unendorse                           |

### 5.2 Pattern Analysis

**Strong patterns:**

- React Query throughout (useQuery, useMutation, useInfiniteQuery)
- Consistent query key conventions
- Query invalidation after mutations
- Supabase client used consistently (direct access in hooks)

**Areas to improve:**

- Several hooks use `select("*")` — broad queries
- Some hooks mix query logic with component-level concerns
- Layout preference hooks duplicate patterns between public/private
- No abstraction layer between Supabase client and hooks (direct calls)

---

## 6. Lib Inventory

### 6.1 Core Utilities

| File               | Purpose                      |
| ------------------ | ---------------------------- |
| `utils.ts`         | General utilities (cn, etc.) |
| `validators.ts`    | URL validation, safe href    |
| `error-message.ts` | Friendly error extraction    |
| `error-capture.ts` | Server error reporting       |
| `error-page.ts`    | Safe error rendering         |
| `seo.ts`           | Metadata, canonical links    |
| `sitemap.ts`       | Sitemap generation           |
| `time.ts`          | Time formatting              |
| `timezones.ts`     | Timezone utilities           |
| `confetti.ts`      | Confetti effect              |

### 6.2 Domain Logic

| File                           | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `reputation.ts`                | Reputation tier math, achievement checks |
| `profile-completeness.ts`      | Profile completeness calculation         |
| `skill-match.ts`               | Skill matching scoring                   |
| `notification-categories.ts`   | Type→category map, view definitions      |
| `notification-destinations.ts` | Notification click destinations          |
| `project-presentation.ts`      | Project section visibility presets       |
| `project-seasons.ts`           | Project season definitions               |
| `workspace-layouts.ts`         | Module registry, presets, grid config    |
| `community-data.ts`            | Post type labels, community constants    |
| `community-validation.ts`      | Post validation                          |
| `file-tree.ts`                 | File tree data structure                 |
| `line-diff.ts`                 | Diff display                             |
| `library-excerpt.ts`           | Library content excerpt                  |
| `content-format.ts`            | Content format detection                 |
| `credits.ts`                   | Credits roll data                        |
| `background-themes.ts`         | Background theme definitions             |
| `dominant-color.ts`            | Image color extraction                   |
| `category-colors.ts`           | Skill category colors                    |

### 6.3 Auth & Security

| File                  | Purpose                      |
| --------------------- | ---------------------------- |
| `auth-error.ts`       | Auth error message mapping   |
| `auth-token.ts`       | Auth token management        |
| `security-headers.ts` | Response security headers    |
| `account-server.ts`   | Server-side account deletion |
| `sentry.ts`           | Error monitoring             |

### 6.4 External Integrations

| File               | Purpose                       |
| ------------------ | ----------------------------- |
| `github.ts`        | GitHub client-side operations |
| `github-server.ts` | GitHub server-side operations |
| `github-source.ts` | GitHub source linking         |
| `lowlight.ts`      | Syntax highlighting           |

---

## 7. Database Schema

### 7.1 Core Tables

| Table                  | Purpose            | Key Columns                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | User identity      | handle, display_name, bio, avatar, banner, skills, availability, reputation_score, background, notification_preferences, public_studio_layout, evidence_shelf                                                                                                     |
| `projects`             | Project workspaces | title, description, goal, vision, status, stage, visibility, progress_percent, cover_url, gallery, resources, links, tags, readme, tools, looking_for_feedback, looking_for_collaborators, is_featured, presentation_preset, season, collaboration_brief, lineage |
| `skills`               | Skill catalog      | slug, name, category, description, tools                                                                                                                                                                                                                          |
| `profile_skills_teach` | Teaching skills    | profile_id, skill_id, verification_level, experience_level, proof_url                                                                                                                                                                                             |
| `profile_skills_learn` | Learning skills    | profile_id, skill_id                                                                                                                                                                                                                                              |

### 7.2 Collaboration Tables

| Table                       | Purpose                                     | Status |
| --------------------------- | ------------------------------------------- | ------ |
| `project_contributors`      | Project team (creator, contributor, mentor) | Active |
| `project_milestones`        | Project milestones                          | Active |
| `project_updates`           | Weekly project updates                      | Active |
| `project_discussions`       | Project-scoped discussions                  | Active |
| `project_open_roles`        | Open project roles                          | Active |
| `project_role_applications` | Role applications                           | Active |
| `project_needs`             | Immediate project needs                     | Active |
| `project_files`             | Project file storage                        | Active |
| `project_repositories`      | Linked external repos                       | Active |
| `project_activity`          | Project activity feed                       | Active |
| `project_watchers`          | Project watching                            | Active |
| `teams`                     | Teams/crews                                 | Active |
| `team_members`              | Team membership                             | Active |

### 7.3 Community Tables

| Table                 | Purpose                    | Status |
| --------------------- | -------------------------- | ------ |
| `posts`               | Community posts (14 types) | Active |
| `comments`            | Nested comments            | Active |
| `polls`               | Polls with options         | Active |
| `poll_votes`          | Poll voting                | Active |
| `community_spaces`    | Community spaces           | Active |
| `space_members`       | Space membership           | Active |
| `space_join_requests` | Space join requests        | Active |
| `space_bans`          | Space bans                 | Active |
| `space_messages`      | Space chat messages        | Active |
| `follows`             | User follows               | Active |
| `post_reports`        | Post reporting             | Active |
| `moderation_log`      | Moderation actions         | Active |

### 7.4 Collaboration Tables

| Table                    | Purpose                 | Status |
| ------------------------ | ----------------------- | ------ |
| `sessions`               | Collaboration sessions  | Active |
| `session_participants`   | Session attendance      | Active |
| `session_availability`   | Availability slots      | Active |
| `session_resources`      | Session resources       | Active |
| `challenges`             | Community challenges    | Active |
| `challenge_participants` | Challenge participation | Active |
| `connections`            | User connections        | Active |
| `messages`               | Direct messages         | Active |
| `notifications`          | Notification feed       | Active |

### 7.5 Support Tables

| Table                      | Purpose                          |
| -------------------------- | -------------------------------- |
| `library_items`            | Library notes, files, links      |
| `library_collections`      | Library collections              |
| `library_item_collections` | Item-collection junction         |
| `connected_accounts`       | GitHub OAuth tokens              |
| `user_layout_preferences`  | Dashboard/private studio layouts |
| `user_github_tokens`       | GitHub personal tokens           |
| `reputation_events`        | Reputation change log            |
| `achievements`             | Achievement definitions          |
| `user_achievements`        | Earned achievements              |
| `skill_endorsements`       | Skill endorsements               |

### 7.6 Key Observations

1. **Rich schema.** 50+ tables with comprehensive RLS. The schema supports the entire collaboration loop.
2. **Profiles is the center.** Most data radiates from profiles (identity) and projects (work).
3. **No page/layout/block tables yet.** Current layout persistence uses `user_layout_preferences` (private) and `profiles.public_studio_layout` (public) — JSONB columns, not normalized.
4. **Project page sections are hard-coded components,** not data-driven blocks. The `presentation_preset` column controls which sections are visible, but section order and layout are fixed.
5. **No template/fork tables.** These are entirely new concepts.

---

## 8. Design System

### 8.1 Token Architecture (`src/styles.css`, 872 lines)

- Semantic color language: trust (green), learning (blue), teaching (amber), ai (purple), warning (red)
- Tight radius scale: 2px–8px (md=3px, lg=4px, xl=5px)
- Typography: Inter (sans/display), JetBrains Mono (mono), Space Grotesk (titles)
- Surface hierarchy: background → surface → surface-elevated → surface-sunken
- Shadows intentionally minimal (`shadow-lifted` for dialogs only, no decorative shadows)
- Dark theme support via CSS variables
- Reduced motion support
- User accent colors via CSS custom properties (`--user-accent`, `--user-accent-border`)

### 8.2 Current vs. Redesign Needs

| Aspect            | Current State                          | Redesign Needs                                    |
| ----------------- | -------------------------------------- | ------------------------------------------------- |
| Theme system      | Single light/dark with semantic tokens | Need multi-theme architecture with token exchange |
| Radius scale      | Tight (2–8px)                          | Good; keep as foundation                          |
| Typography        | Good hierarchy with 4 font families    | Keep; extend with theme-variable fonts            |
| Surface hierarchy | Well-defined levels 0–4                | Keep; blocks will target specific levels          |
| Color system      | Semantic + user accent                 | Extend with theme color palettes                  |
| Shadows           | Minimal intentionally                  | Keep the restraint                                |
| Motion            | Restrained, reduced-motion aware       | Keep                                              |

### 8.3 Existing Primitives That Map to Blocks

The project page already has block-like sections. These are the clearest candidates:

| Current Component                   | Maps to Block Type                |
| ----------------------------------- | --------------------------------- |
| `ProjectHeader`                     | Hero + identity block (composite) |
| `ProjectReadmeTab` / `ReadmeEditor` | Markdown/README block             |
| `MilestonesTimeline`                | Roadmap/Timeline block            |
| `ProjectNeeds`                      | Current work / needs block        |
| `ProjectPeopleTab`                  | Team block                        |
| `ProjectFilesExplorer`              | Files block                       |
| `ProjectActivityTab`                | Activity block                    |
| `ProjectDiscussions`                | Discussions block                 |
| `ProjectCredits`                    | Credits block                     |
| `ProjectCommunityPosts`             | Community posts block             |
| `ProjectOpenRoles`                  | Open roles block                  |
| `ProjectUpdates`                    | Updates block                     |
| `ProjectRepos`                      | Repositories block                |
| `ProjectTimeline`                   | Timeline block                    |
| `ProjectResources`                  | Resources block                   |

The profile also has block-like sections:

- `ProfileHeader` (identity) → Profile header block
- Skills display → Skills block
- Projects display → Featured projects block
- Activity → Activity block
- Contribution graph → Contributions block
- Evidence shelf → Evidence block

---

## 9. What Can Be Preserved

### 9.1 Strongly Preserved (Reuse As-Is)

- **All hooks** — they encapsulate data access correctly. Blocks will consume the same hooks.
- **UI primitives** — the Radix/Tailwind component set should not change.
- **Design tokens** — the semantic color system, radius scale, and surface hierarchy.
- **Auth system** — Supabase auth works well.
- **RLS policies** — comprehensive and tested.
- **Supabase client patterns** — consistent.
- **React Query infrastructure** — solid foundation.
- **WorkspaceGrid** — the interaction model is good; may need to coexist with or be replaced by the block editor.

### 9.2 Preserved but Adapted

- **Project page components** — these become block renderers. The data fetching stays in hooks; the presentation becomes a registered block.
- **Profile components** — same treatment. SectionCards become blocks that happen to use card presentation only when appropriate.
- **Public Studio Workspace** — currently uses WorkspaceGrid with module definitions. These modules become blocks in the new system.
- **Dashboard modules** — same treatment as public studio modules.

### 9.3 Retired or Replaced

- **SectionCard** wrapper — blocks have their own surface treatment rules per the design system; no universal wrapper needed.
- **WorkspaceGrid** (potentially) — if the block editor provides drag/drop reordering natively, the grid may be superseded. Decision deferred.
- **Tab interfaces** (private Studio, Sessions, Community nav) — these may remain as navigation patterns within specific blocks, not as page-level architectures.

---

## 10. What Needs to Change

### 10.1 Architectural Changes

1. **Page model** — create `pages` table linking owners to layouts and themes.
2. **Block registry** — create a typed registry so blocks are discovered, not enumerated.
3. **Layout model** — move from hard-coded JSX section order to data-driven layouts.
4. **Theme model** — move from hard-coded CSS variables to swappable theme tokens.
5. **Template model** — new tables for templates, forks, and lineage.
6. **Editor mode** — add edit overlay to view mode (no separate editor page).

### 10.2 Data Changes

1. **New tables:** `pages`, `layouts`, `themes`, `templates`, `forks`
2. **Migration:** map existing `project_presentation_preset` values, `public_studio_layout` JSONB, and `user_layout_preferences` JSONB into the new page/layout model.
3. **Existing data preserved:** all project data, profile data, community data remain in their current tables. Only the _presentation layer_ changes.

### 10.3 Component Changes

1. **Project page** — `projects.$id.tsx` becomes `PageShell` wrapping project-owned block renderers.
2. **Public profile** — `u.$handle.tsx` becomes `PageShell` wrapping profile-owned block renderers.
3. **Private profile** — `profile.tsx` may become a block-based page or remain a tabbed editor (decision deferred).
4. **Dashboard** — may become a block-based page or remain as-is (decision deferred).
5. **Other routes** — Explore, Community, Sessions, Library, Messages, Challenges, Connections, Notifications, Settings remain unchanged in Phase 2–7 (they are not profile/project pages).

### 10.4 Hook Changes

- **New hooks:** `usePage`, `usePageEditor`, `useBlockRegistry`, `useTemplates`, `useFork`, `useTheme`
- **Existing hooks:** unchanged. Blocks consume existing data hooks.
- **Query invalidation:** pages invalidate when layout/theme changes; content queries remain independent.

---

## 11. Architectural Risks

### 11.1 Data Migration Risk

**Risk:** Existing profiles and projects have complex customization data (WorkspaceGrid layouts, presentation presets, public studio arrangement). Mapping these into the block model without data loss requires careful design.

**Mitigation:** Two-phase migration: (1) generate default page/layout for every existing profile/project, preserving current appearance; (2) allow users to customize from there. Never delete existing customization data until the new system is verified.

### 11.2 WorkspaceGrid Coexistence

**Risk:** WorkspaceGrid provides drag/drop, resize, hide, pin, and preset functionality. The block editor will also need reordering and visibility controls. Having two systems creates confusion.

**Mitigation:** Decide early whether WorkspaceGrid is replaced or extended. Recommendation: replace WorkspaceGrid on profile/project pages with the block editor; keep WorkspaceGrid on the dashboard (which remains a separate concern).

### 11.3 Performance with Block Rendering

**Risk:** Rendering a page as a composition of dynamic blocks (each fetching its own data) could increase waterfall requests compared to the current monolithic page queries.

**Mitigation:** Use React Query's suspense/integration. Prefetch block data where possible. Keep the block registry lazy-loaded. Each block should be independently suspendable.

### 11.4 Template Safety

**Risk:** Templates must never expose private project data, member lists, files, discussions, or activity. The serialization boundary between "structural template" and "user content" must be watertight.

**Mitigation:** Templates store block _types_ and _positions_ plus _default configs_ only. When a template is applied, blocks query the user's own data. Template serialization explicitly strips content fields. RLS prevents cross-tenant data access at the database level regardless of template structure.

### 11.5 Public/Private Distinction

**Risk:** Private projects already have RLS policies preventing unauthorized access. The block system must not accidentally bypass these by caching data in page layouts.

**Mitigation:** Blocks always fetch data through existing hooks which go through Supabase RLS. Page layouts are structural only and never contain queried data. Published pages for private projects are viewable only by authorized users.

### 11.6 Test Coverage During Migration

**Risk:** Major structural changes could break existing collaboration flows (project creation, role applications, challenge review, etc.).

**Mitigation:** Run full test suite (350 tests) after every phase. Add new tests for page/layout/template/fork operations. Run authenticated browser smoke tests.

---

## 12. Open Design Questions

These must be answered before Phase 2 begins:

1. **Should the block system replace or coexist with WorkspaceGrid?**
   - _Recommendation:_ Replace WorkspaceGrid on profile and project pages with the block editor. Keep WorkspaceGrid on the dashboard. The dashboard is a tool surface; profiles and projects are public destinations.

2. **How does `profiles.public_studio_layout` map into the new page/block model?**
   - _Recommendation:_ One `page` per profile with `owner_type=profile`. The current public_studio_layout JSONB maps into the initial `layout` for that page. Users can customize from there.

3. **Should the project README be a block or remain a first-class concept?**
   - _Recommendation:_ The README is special — it defines the project. Make it a required, always-visible block at the top of every Project Space. It can be a "markdown" block type with project-specific defaults.

4. **Should the dashboard become a block-based page?**
   - _Recommendation:_ Not in Phase 2–5. The dashboard is a tool, not a public destination. It already has a good customization system (WorkspaceGrid). Revisit after profile/project pages are migrated.

5. **What is the minimal viable block set for Phase 2?**
   - _Recommendation:_ Text, Heading, Markdown, Divider, About (project description), Status, Team, Files, Activity, Roadmap, Tech Stack, Skills. That covers 100% of current profile and project sections. Add more blocks incrementally.

6. **How should the theme token system evolve?**
   - _Recommendation:_ The current CSS variable system in `styles.css` becomes the "default" theme. Additional themes define alternative token sets. A `theme` table stores token JSONB. A ThemeProvider applies tokens as CSS custom properties at runtime.

7. **Should the template table live in Supabase or a separate service?**
   - _Recommendation:_ Supabase. Templates are closely coupled with the page/layout model and benefit from the same RLS, migrations, and realtime features. No complexity overhead from a separate service.

---

## 13. Recommended Architecture (Post-Redesign)

```
┌─────────────────────────────────────────────────────────────────┐
│                        TETHYR APPLICATION                       │
├─────────────────────────────────────────────────────────────────┤
│  Public Routes          │  Authenticated Routes                 │
│  /projects/$id ──┐      │  /dashboard (unchanged)               │
│  /u/$handle ─────┤      │  /explore (unchanged)                │
│                  ▼      │  /profile ──> Block Editor            │
│            PageShell    │  /community (unchanged)               │
│            ├─ Theme     │  /sessions (unchanged)                │
│            ├─ Layout    │  /library (unchanged)                 │
│            └─ Blocks    │  /messages (unchanged)                │
│               ├─ Hero   │  /connections (unchanged)             │
│               ├─ About  │  /notifications (unchanged)           │
│               ├─ Team   │  /settings (unchanged)                │
│               ├─ Files  │  /challenges (unchanged)              │
│               ├─ ...    │                                       │
│               └─ Custom │  Template Routes (Phase 7+)           │
│                         │  /templates                           │
│  Edit Mode (overlay)    │  /templates/$id                       │
│  ├─ Block Picker        │  /templates/$id/fork                  │
│  ├─ Drag/Reorder        │                                       │
│  ├─ Config Panel        │                                       │
│  └─ Publish Controls    │                                       │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                               │
│  pages ◄── layouts ◄── templates ◄── forks                     │
│  themes                                                         │
│  (existing tables unchanged: projects, profiles, skills, etc.)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Phased Implementation Plan (Refined)

### Phase 1 — Audit ✅ COMPLETE

This document. Awaiting approval.

### Phase 2 — Block Foundation

**Scope:** Page model, block registry, block renderer, layout model, theme model, draft/publish workflow.
**Data:** `pages`, `layouts`, `themes` tables. Migration to create them.
**Components:** `PageShell`, `PageLayout`, `LayoutSection`, `BlockRenderer`, `BlockRegistry`.
**Blocks:** Text, Heading, Markdown, Divider — content-only blocks to prove the architecture.
**No migration of existing pages yet.**
**Gate:** Typecheck, full tests, authenticated browser smoke, no regression on existing routes.

### Phase 3 — Project Space

**Scope:** Migrate `projects.$id.tsx` to block-based rendering.
**Blocks:** Hero/Header, About/Markdown, Status, Team, Files, Activity, Roadmap, Tech Stack, Updates, Needs, Credits, Discussions, Community Posts.
**Migration:** Generate default layouts for all existing projects. `presentation_preset` values inform initial block visibility.
**Gate:** All existing project functionality works. Full test suite passes. Browser smoke.

### Phase 4 — Personal Profile

**Scope:** Migrate `u.$handle.tsx` to block-based rendering. Migrate private Studio.
**Blocks:** Profile Header, Skills, Featured Projects, Experience, Contributions, Activity, About, Links, Evidence.
**Migration:** `public_studio_layout` JSONB → layout. Generate defaults for all existing profiles.
**Gate:** All existing profile functionality works. Public/private distinction preserved.

### Phase 5 — Visual Editor

**Scope:** Edit mode overlay, block picker, drag/drop reorder, config panel, preview, publish.
**Gate:** Non-technical users can customize a page. Tests pass. Mobile editor works.

### Phase 6–11 — As specified in `TETHYR_REDESIGN_SPEC.md`.

---

## 15. Verification

- `npm run typecheck` — passed (before audit)
- `npm test` — 350 tests passed (before audit)
- No code changes were made during this audit
- This report is a read-only assessment of the current state

---

## 16. Approval Required

Before Phase 2 implementation begins, confirm:

1. The block/page/theme architecture described in `TETHYR_REDESIGN_ARCHITECTURE.md` is approved.
2. WorkspaceGrid should be replaced on profile/project pages, kept on dashboard.
3. The README remains a first-class required block at the top of every Project Space.
4. The minimal Phase 2 block set (Text, Heading, Markdown, Divider) is acceptable as a proving ground.
5. Phase 2 does not touch existing routes — it builds the foundation in parallel.

**Awaiting approval to proceed to Phase 2.**
