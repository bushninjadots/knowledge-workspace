# Project Detail Page — Design Spec

## Goal

Transform the existing project detail page (`/projects/$id`) from a functional tabbed layout into a premium, immersive single-scroll experience that matches the visual bar set by the Project Shelf.

## Architecture

Full-viewport hero → two-column layout (sticky sidebar + scrollable main content). No tabs. Anchored sections with scroll-spy navigation. Join/collaborate CTA as the primary interaction.

## Tech Stack

- React 19 / TypeScript / TanStack Router
- TanStack React Query (existing data hooks)
- Tailwind CSS 4 / shadcn-style components
- framer-motion (scroll-driven opacity/parallax, section entrance)
- Existing sub-components: `ProjectTimeline`, `MilestonesTimeline`, `ProjectUpdatesJournal`, `ProjectDiscussions`, `OpenRolesSection`, `GallerySection`, `ResourcesSection`, `ProjectCommunityPosts`
- Supabase storage (cover signed URLs, avatar signed URLs)

## Layout

```
┌──────────────────────────────────────────┐
│          HERO (100vh → 60vh mobile)       │
│  cover image (parallax) + dark gradient    │
│  bottom-aligned: title, creator, badges    │
│                  |  Join/Share buttons      │
├──────────────────┬───────────────────────┤
│                  │                        │
│   SIDEBAR        │   MAIN CONTENT         │
│   (sticky)       │   (scrollable)         │
│   w: 280px       │                        │
│                  │   • Vision             │
│  • Status        │   • About              │
│  • Stage steps   │   • Goals              │
│  • Skills        │   • Contributors       │
│  • Links         │   • Gallery            │
│  • Open Roles    │   • Resources          │
│  • Meta          │   • Activity/Journal   │
│  ─────────────── │   • Discussions        │
│  • JOIN CTA      │   • Community Posts    │
│                  │                        │
└──────────────────┴────────────────────────┘
```

## Components

### `ProjectPage` (route component)

- Route: `/projects/$id`
- Data fetching: existing `useQuery` for project, contributors, skills, cover/avatar signed URLs
- Sub-queries: `useMilestones`, `useProjectUpdates`, `useDiscussions`, `useOpenRoles`, `useProjectCommunityPostCount`
- Renders Shell → Hero → ContentSplit → CommunityPosts → Footer

### `ProjectHero`

- **Props:** `project`, `coverSigned`, `creator`, `avatarSigned`, `accent`
- Full viewport (`h-screen`), minimal `60vh` on mobile
- Cover image: full-bleed `<img>` with `object-cover`, scaled up 110% with `scale` transform tied to scroll via framer-motion `useScroll` + `useTransform` (parallax: 0 → -20px offset over scroll range)
- Dark gradient overlay: `bg-gradient-to-t from-background via-background/40 to-transparent`
- Content bottom-aligned with `mt-auto p-8 sm:p-12`:
  - Title (`font-display text-4xl sm:text-5xl font-semibold`)
  - Creator row: avatar + name, linked to `/u/$handle`
  - Badge row: status pill, featured trophy, category tag, "Looking for collaborators" / "Looking for feedback" pills
  - Goal summary: single-line lighter text
  - Right-aligned buttons: "Join / Contribute" (primary gradient), Share (icon button), Bookmark (toggle icon)
- Bottom edge: progress bar (`h-1`) spanning full width + stage label overlay
- `prefers-reduced-motion`: no parallax, no scroll-driven transforms

### `ProjectContentSplit`

- **Props:** `project`, `contributors`, `skills`, `milestones`, `updates`, `discussions`, `openRoles`, `avatarSigned`, `isOwner`, `isContributor`, `communityPosts`
- Two-column grid: `grid-cols-[1fr_280px]` on desktop, single column on mobile
- Wraps in a `<section>` with `id` anchors for each section

### `ProjectSidebar`

- Sticky: `sticky top-20 self-start`
- Sections:
  - **Status card** — colored pill + progress
  - **Stage** — `ProjectTimeline` component, vertically oriented compact
  - **Skills** — compact tag cloud, max 6 with "+N more" expand
  - **Links** — icon+label list, clickable
  - **Open Roles** — each role: title, brief description, "Apply" button
  - **Meta** — created date, milestone count, contributor count
- **Join CTA** — sticky bottom within sidebar (`mt-auto sticky bottom-0 bg-surface pt-4`)
  - Contextual text: "Request to Join" / "Apply as Mentor" / "Contributing ✓" / "Own Project"
  - Opens a dialog/modal with role selection
- Sections collapse under accordion headers when viewport < 900px (mobile + tablet)

### `ProjectMainContent`

- Single scroll column, `space-y-16` between sections
- Each section gets a `section` element with:
  - `id` attribute for scroll-spy and anchor links
  - Section eyebrow: small uppercase label in `text-muted-foreground` (e.g., "01 — Vision")
  - Section title in `font-display text-xl`
  - Content body

#### Sections (in order):

1. **Vision** — `project.vision` as markdown, blockquote-style with `border-l-2 border-primary` accent bar
2. **About** — `project.description` as markdown with prose styling
3. **Goals** — Array from `project.goals` (new DB column or structured field), each with icon + title + description. If empty, show "No goals set yet" empty state
4. **Contributors** — Horizontal avatar row (overlap, `-ml-2`), each with name, role badge, skill tags. Click expands inline detail. "Join the team" prompt if user is not a contributor
5. **Gallery** — Existing `GallerySection` component
6. **Resources** — Existing `ResourcesSection` component
7. **Activity / Journal** — Existing `ProjectUpdatesJournal`, but rendered as inline feed (not tabbed). "New update" button for contributors
8. **Discussions** — Existing `ProjectDiscussions`, thread previews with reply count. "Start discussion" button
9. **Community Posts** — Existing `ProjectCommunityPosts`

### `JoinProjectModal`

- **Props:** `projectId`, `openRoles`, `isOwner`, `isContributor`, `onClose`
- Dialog/vaul drawer with:
  - Role selection (pre-selected if coming from an Open Role)
  - Optional message to creator
  - "Request to Join" submit button
  - Success state: "Request sent! The creator will review your request."
- Integrates with existing contributor request flow (or creates one if missing)

### `ScrollSpyNav`

- Thin vertical indicator on the left edge of main content
- Renders section dots/numbers, highlights the one in view
- Clickable: scrolls to the corresponding `section` id
- Uses `IntersectionObserver` on section elements with `rootMargin: -40% 0px -55% 0px`
- Hidden on mobile

### `Shell`

- Already exists as a wrapper in the current page
- Updates: sticky header uses backdrop-blur, subtle border, animated on scroll (adds shadow when scrolled past hero)

## Data Flow

### Query Dependencies

- Project ID from route params
- `useQuery("project-detail", id)` — fetches project row + contributors + skills in one loader
- Cover URL resolved to signed URL inside loader (existing pattern)
- Separated queries: `useMilestones(id)`, `useProjectUpdates(id)`, `useDiscussions(id)`, `useOpenRoles(id)`, `useProjectCommunityPostCount(id)` (all existing)

### New Data Requirements

- `project.goals` — if the DB doesn't have this column yet, extend `projects` table with a `goals` JSONB column `[{ icon: string, title: string, description: string }]`
- Join flow — requires `project_join_requests` table or similar (or reuse existing contributor request flow). If neither exists, placeholder the modal with a "coming soon" state

### Loading / Error / Empty

- **Loading:** Skeleton hero (full-width) + two-column skeleton with pulsing blobs
- **Error:** Inline error banner with retry button
- **Empty sections:** Each section shows a tasteful empty state matching the section's icon/theme
- **Unpublished / deleted project:** Route's `notFoundComponent` handles this (already exists)

## Responsive

| Breakpoint | Layout                                                                |
| ---------- | --------------------------------------------------------------------- |
| > 1024px   | Hero + two-column sidebar/main                                        |
| 768–1024px | Hero + stacked (sidebar collapses to accordion sections in main flow) |
| < 768px    | Hero at 60vh, single column, buttons stack vertically, no scroll-spy  |

## Accessibility

- `prefers-reduced-motion`: no parallax, no scroll-driven animations, standard fade-in entrance
- All interactive elements focusable and keyboard-navigable
- Scroll-spy nav: `aria-current="location"` on active section
- Join modal: focus trap inside, `aria-labelledby` on heading
- Hero image: `alt` text from project title + "cover"
- Section anchors: `tabindex="-1"` so they're skip-navigable via heading navigation but not tab stops

## Global Constraints

- No new third-party animation libraries beyond framer-motion (already installed)
- Existing sub-components (`ProjectTimeline`, `MilestonesTimeline`, etc.) reused without modification where possible
- Tailwind CSS 4 design tokens from project: `font-display`, `card-border`, `bg-surface`, `bg-surface-elevated`, `text-muted-foreground`, `text-primary`, `border-border/60`, shadow/lift utilities
- All copy uses sentence case, plain verbs, no filler
- `cn()` utility for conditional class merging
- TypeScript strict, no `any`
- No dynamic Tailwind class interpolation

## File Changes

### New Files

- `src/components/tethyr/project/project-hero.tsx` — Full-bleed hero with parallax/gradient/overlay
- `src/components/tethyr/project/project-content-split.tsx` — Two-column layout orchestrator
- `src/components/tethyr/project/project-sidebar.tsx` — Sticky sidebar with meta/skills/roles/join CTA
- `src/components/tethyr/project/project-main-content.tsx` — Scrollable main content with all sections
- `src/components/tethyr/project/project-join-modal.tsx` — Join/collaborate request dialog
- `src/components/tethyr/project/project-scroll-spy.tsx` — Section nav indicator
- `src/hooks/use-project-scroll-spy.ts` — IntersectionObserver hook for active section tracking

### Modified Files

- `src/routes/projects.$id.tsx` — Swap tab-based layout for hero + split layout, keep data loading
- `src/components/tethyr/project/project-timeline.tsx` — Add compact vertical variant for sidebar
- `src/components/tethyr/project/project-milestones.tsx` — Verify compatibility with inline rendering (not tab-scoped)
- `src/components/tethyr/project/project-updates.tsx` — Verify inline feed compatibility
- `src/styles.css` — Add any new scroll-driven or parallax keyframes if needed

### Potentially New DB

- `goals` column on `projects` table (JSONB) — optional, can be deferred if column doesn't exist
- `project_join_requests` table — optional, can be placeholder UI if flow not implemented
