# Tethyr — Full UI/UX Audit & Design Reference

> Last audit: August 9, 2026  
> TypeScript: ✓ Clean | Tests: 56/56 passing  
> This document covers every page, component, feature, and interaction in the current codebase.

---

## Table of Contents

1. [Design System & Identity](#1-design-system--identity)
2. [Global Navigation & Shell](#2-global-navigation--shell)
3. [Route-by-Route Page Audit](#3-route-by-route-page-audit)
   - [3.1 Landing Page (`/`)](#31-landing-page-)
   - [3.2 Login & Signup (`/login`, `/signup`)](#32-login--signup-login-signup)
   - [3.3 Dashboard (`/dashboard`)](#33-dashboard-dashboard)
   - [3.4 Profile / Studio (`/profile`)](#34-profile--studio-profile)
   - [3.5 Explore (`/explore`)](#35-explore-explore)
   - [3.6 Public Profile (`/u/$handle`)](#36-public-profile-uhandle)
   - [3.7 Projects (`/projects/$id`)](#37-projects-projectsid)
   - [3.8 Community (`/community`)](#38-community-community)
   - [3.9 Challenges (`/challenges`)](#39-challenges-challenges)
   - [3.10 Sessions (`/sessions`)](#310-sessions-sessions)
   - [3.11 Library (`/library`)](#311-library-library)
   - [3.12 Messages (`/messages`)](#312-messages-messages)
   - [3.13 Skills Hub (`/skills/$slug`)](#313-skills-hub-skillsslug)
   - [3.14 Notifications (`/notifications`)](#314-notifications-notifications)
4. [Design Patterns & Conventions](#4-design-patterns--conventions)
5. [Known Issues & Audit Findings](#5-known-issues--audit-findings)
6. [Future Steps & Recommendations](#6-future-steps--recommendations)

---

## 1. Design System & Identity

### Brand Positioning
> **"It's where people build things together and get known for what they make."**

Tethyr sits at the intersection of GitHub (project-centric), Behance (visual portfolios), Discord (community spaces), and LinkedIn (professional networking) — but commits to none. It is its own category: a **collaboration network for builders**.

### Visual Design Language

| Token | Usage |
|---|---|
| `bg-noise` | Subtle grain texture on all page backgrounds — feels tactile, not flat |
| `bg-grid` | Geometric grid overlay on hero sections — adds depth |
| `card-border` | Consistent border class: `border border-border/60` — used on every card |
| `rounded-2xl` | Standard card corner radius — organic, not harsh |
| `rounded-3xl` | Avatar containers only — distinct from cards |
| `rounded-full` | Buttons, badges, chips, input pills |
| `bg-surface` | Card backgrounds (replaces old `bg-card`) |
| `bg-surface-elevated` | Layered elements within cards |
| `bg-background` | Page background |
| `font-display` | Space Grotesk — for headings and brand moments |
| `font-mono` | JetBrains Mono — code, file names, technical data |
| `text-gradient-brand` | Purple-to-green gradient on key brand text |
| `shadow-glow-green` | Glow effect on primary CTAs |
| `shadow-soft` | Subtle elevation on layered cards |
| `animate-room-enter` | Page-level entrance animation (fade + slight scale) |
| `animate-stagger` | Staggered entrance for list children |
| `transition-lift` | Hover lift + shadow transition |
| `scrollbar-none` | Hidden scrollbars in inner containers |

### Color System

| Variable | Meaning |
|---|---|
| `--brand-purple` | Primary brand accent |
| `--brand-green` | Secondary brand accent |
| `--trust` | Reputation/trust color |
| `--learning` | Growth/learning color |
| `--teaching` | Mentoring/teaching color |
| `--ai` | AI/technology accent |
| `--user-accent` | Extracted from user's banner image via dominant color detection |
| `--user-accent-border` | Accent border variant |
| `--user-accent-subtle` | Accent background variant |

User accent colors are **dynamically extracted** from banner images using the `useUserPalette` hook (via Canvas API) and applied throughout the UI — profile cards, dashboard, explore page, and project views all respond to visiting a user's profile. This makes every profile visit feel personalized.

### Typography Scale

| Size | Usage |
|---|---|
| `text-[11px]` | Meta labels, timestamps, secondary data (formerly 10px — upgraded in Phase 2 audit) |
| `text-xs` | Body helper text, tags, chips |
| `text-sm` | Body text, card titles, section headers |
| `text-base` | Larger card titles, form labels |
| `text-lg` / `text-xl` | Section headings |
| `text-2xl` / `text-3xl` | Page titles |
| `text-5xl`–`text-8xl` | Landing page hero (responsive) |

### Animation Philosophy

- **Entrances**: Fade + slight Y offset (`animate-room-enter`, `animate-in`)
- **Transitions**: 200ms ease-out default for hovers
- **Spring physics**: Framer Motion springs for drag, modal, and carousel (stiffness: 200-380, damping: 25-34)
- **Respects `prefers-reduced-motion`**: All animations disable when system setting is on
- **Scroll indicators**: Animated scroll lines on landing page
- **Loading states**: `animate-pulse` skeletons with `bg-surface-elevated`

---

## 2. Global Navigation & Shell

### Navbar (`/` route only)
- **Component**: `src/components/tethyr/navbar.tsx`
- Sticky top bar with `backdrop-blur-xl`
- Logo (Tethyr wordmark), Home link, ThemeToggle
- Renders auth-aware CTAs:
  - **Loading**: Pulsing skeleton pill
  - **Logged out**: "Log in" (ghost) + "Join Tethyr" (filled, rounded-full)
  - **Logged in**: "Dashboard" button + Sign out icon
- Mobile: hamburger menu with slide-down panel

### Dashboard Sidebar
- **Component**: `src/components/tethyr/dashboard-sidebar.tsx`
- Sticky left sidebar (hidden on mobile, hamburger toggle)
- Navigation items with icons, active state indicator
- Displays current user avatar + name at bottom
- `w-60` fixed width on desktop

### Authenticated Shell (Explore, Community, Library, Sessions, Challenges, Messages)
- Routes under `/_authenticated` share a layout
- Top header bar: hamburger (mobile), "Tethyr" label, ThemeToggle, NotificationDropdown, GlobalSearch
- **Component**: `src/components/tethyr/authenticated-shell.tsx`

### Global Search
- **Component**: `src/components/tethyr/global-search.tsx`
- Dialog overlay triggered by Cmd/Ctrl+K or search icon
- Searches across: Profiles, Skills, Projects, Library, Posts, Sessions
- Real-time results with type icons
- Keyboard navigation (↑↓ Enter Esc)

### Notifications
- Bell icon with unread count badge
- Dropdown panel with notification cards
- Types: session requests, connection requests, challenge updates, mentions, role applications
- Full page at `/notifications` with filtering

---

## 3. Route-by-Route Page Audit

### 3.1 Landing Page (`/`)

**File**: `src/routes/index.tsx`  
**Components**: `landing-sections.tsx`, `hero-actions.tsx`, `section-reveal.tsx`

#### Structure
1. **Navbar** — sticky, auth-aware
2. **Hero Section** — 2-column grid (text left, showcase right)
   - Brand tagline + animated gradient headline
   - CTA buttons (auth-aware):
     - **Logged out**: "Join Tethyr" + "Log in"
     - **Logged in**: "Dashboard" + "Explore projects" + "Your studio"
   - HeroActions bar (stats, quick links)
   - Scroll indicator animation
3. **LandingStats** — marquee-style counters
4. **HowItWorks** — 4-step explainer with illustrations
5. **TrendingSkills** — skill chips with counts
6. **FeaturedProjects** — project cards in grid
7. **RecentActivity** — activity feed preview
8. **CommunitySpaces** — community cards
9. **CTA Section** — gradient card with CTA (auth-aware)
10. **Footer** — links, branding

#### Interactions
- Section-reveal animations (fade in on scroll)
- Staggered entrance on lists
- Hover lifts on cards
- Scroll-to-content button

#### ✓ Working | ⚠ Issues
- ✓ Auth state transitions are smooth (skeleton during loading)
- ✓ Responsive: single column on mobile, 2-col on desktop
- ⚠ Hero text can overflow on very narrow screens (320px)
- ⚠ FeaturedProjects uses random selection — could show stale projects

---

### 3.2 Login & Signup (`/login`, `/signup`)

**Files**: `src/routes/login.tsx`, `src/routes/signup.tsx`  
**Component**: `auth-shell.tsx`

#### Structure
- Centered card layout with brand gradient background
- Email + password form (login)
- Email + password + confirm + handle (signup)
- Social login button placeholders (not yet wired)
- Link to opposite page
- Back-to-home link

#### ✓ Working | ⚠ Issues
- ✓ Form validation and error states
- ✓ Loading spinner on submit
- ⚠ No "forgot password" link visible on login (separate `/reset-password` route exists)
- ⚠ Social login buttons are UI-only, not functional
- ⚠ Password strength indicator not implemented

---

### 3.3 Dashboard (`/dashboard`)

**File**: `src/routes/dashboard.tsx`  
**Layout**: `AuthenticatedDashboardLayout` with `DashboardSidebar` + top header bar

#### Modules (in order)

| Module ID | Content | When visible |
|---|---|---|
| `welcome` | Greeting with name, availability badge, CreateProjectButton, completeness ring, rep score | Always |
| `next-steps` | Profile completion checklist OR "Profile complete!" celebration | When profile <100% OR =100% |
| `today` | 4 focus cards: Continue project, Pending invites, Find collaborators, Browse opportunities | Always |
| `projects` | Your active/planning projects with progress bars | When projects exist |
| `applications` | Role applications sent with status badges | When applications exist |
| `challenges` | Joined challenges with difficulty labels | When challenges exist |
| `connections` | Tethrs connections card | Always |
| `activity` | Recent activity timeline (last 6 events) | Always |
| `suggested-projects` | Projects matched to your skills | Always |
| `suggested-creators` | People with complementary skills | Always |
| `trending-skills` | Popular skills across network | Always |
| `week` | Weekly activity count + current rep score | When weekly activity >0 |

#### Customize Mode
- **Customize button** (GripVertical icon) toggles WorkspaceGrid drag-drop layout
- **Done button** returns to clean static layout
- Layout persisted to `user_layout_preferences` table

#### ✓ Working | ⚠ Issues
- ✓ Clean stacked layout as default
- ✓ Customize mode with drag-drop, resize, hide, pin
- ✓ All modules show/hide based on data availability (no empty cards)
- ✓ Scroll-to-top button on long scrolls
- ⚠ `renderModule` has large dependency array — could cause unnecessary re-renders
- ⚠ `updateAvail` mutation object in deps may change reference
- ⚠ "Quick actions" module removed from registry — needs re-implementation as inline buttons

---

### 3.4 Profile / Studio (`/profile`)

**File**: `src/routes/_authenticated/profile.tsx`  
**Layout**: `ProfileLayout` component

#### Header Section
- **Banner**: Uploadable with drag-drop, dominant color extraction
- **Avatar**: Uploadable, 128x128 rounded-3xl with gradient ring
- **Identity**: Display name, creator title, handle, bio
- **Chips**: Category, years experience, country, timezone
- **Edit identity** dialog: full form for all profile fields
- **Completeness ring**: SVG donut chart showing profile completion %

#### Tabs (customizable via Customize button)

| Tab | Content |
|---|---|
| **Overview** | Stats, About (bio, languages), Sharing style, Growth goals, Favourite tools (chip list), Software stack (chip list), Social links, Portfolio links, GitHub integration |
| **Skills** | Skills I share (with verification badges, experience levels, proof uploads), Growing skills, Skill catalog search |
| **Projects** | Project grid with covers, status badges, progress bars |
| **Communities** | Your communities, pending requests, discoverable spaces |
| **Activity** | Contribution graph, activity timeline, sessions tab |
| **Customize** | WorkspaceGrid with drag-drop for all modules |

#### Sidebar
- Stats block (skills, projects, activity counts)
- Reputation score with tier badge
- Active projects list (top 3)
- Social links with external link icons

#### ✓ Working | ⚠ Issues
- ✓ Dominant color extraction from banner
- ✓ 5 tabs with clean bar UI
- ✓ Customize mode toggle
- ✓ All editing dialogs work (bio, tools, stack, links, identity)
- ✓ GitHub token connection with server-side validation
- ✓ Skill proof upload with verification levels
- ⚠ Profile completeness ring could be more prominent
- ⚠ TABS constant imports LayoutGrid/Briefcase/Activity only for icon references — could be simplified
- ⚠ Display name uses `break-words` (fixed from `truncate`)

---

### 3.5 Explore (`/explore`)

**File**: `src/routes/_authenticated/explore.tsx`

#### Project Shelf (Projects tab)
- **ProjectShelfHeader**: Search bar + category filter dropdown
- **ProjectShelf**: Centered card carousel
  - Center card: 16:9 cover image (object-contain), info panel with title/author/description/4 tags/progress
  - Side previews: mini cards for prev/next projects
  - Arrow buttons + keyboard navigation (← →)
  - Mouse wheel scrolling (accumulation threshold: 60px)
  - Touch/pointer drag with 80px swipe threshold
  - Thumbnail strip at bottom
  - Empty state with filter clear button
- **ProjectShelfOverlay**: Detail panel
  - Full cover image, status badges, title overlay
  - Description, tags, footer with prev/next navigation
  - "View Project" button
  - Swipe-to-dismiss (drag down 100px+)
  - Escape key closes

#### People & Opportunities tabs
- Creator cards with skill tags
- Role opportunities with skill match scoring

#### ✓ Working | ⚠ Issues
- ✓ Smooth crossfade transitions (no disappearing cards)
- ✓ Mouse wheel + keyboard + touch drag + button navigation
- ✓ Mobile fallback: stacked vertical cards
- ✓ object-contain ensures no image cropping
- ⚠ MiniCard preview uses `object-cover` (different from center card)
- ⚠ No infinite scroll or pagination — all projects loaded at once

---

### 3.6 Public Profile (`/u/$handle`)

**File**: `src/routes/u.$handle.tsx`

Same `ProfileLayout` as studio but:
- `isOwnProfile={false}`
- No edit buttons
- Shows FollowButton, RequestSessionDialog, Message, Connect, Collaborate buttons
- Reputation badge instead of completeness ring
- Banner is view-only (not uploadable)

#### ✓ Working | ⚠ Issues
- ✓ Clean public view matched to Identity doc vision
- ⚠ "View public profile" link removed from own studio sidebar (was confusing)

---

### 3.7 Projects (`/projects/$id`)

**File**: `src/routes/projects.$id.tsx`  
**Components**: 15+ project sub-components

#### Hero Section
- Cover image with gradient overlay
- Title, author, status badge, progress bar
- Collaborator avatars

#### Tab System

| Tab | Content |
|---|---|
| **Readme** | Markdown/rich text description |
| **Updates** | Chronological project updates |
| **Milestones** | Milestone cards with status, progress |
| **People** | Contributor roster with roles |
| **Open Roles** | Role cards with skill requirements, apply button |
| **Discussions** | Threaded discussions |
| **Files** | File explorer with folder tree |
| **Repos** | GitHub repo connection, file browser |
| **Resources** | Links, documents, assets |
| **Activity** | Project activity feed |
| **Community** | Linked community posts |
| **Timeline** | Gantt-style milestone timeline |

#### Sidebar
- Project metadata (status, visibility, dates)
- Quick stats
- Join/leave button
- Share button

#### Project Join Flow
- **ProjectJoinModal**: Role selection with skill match scores
- Role applications with accept/decline
- Contributor role assignment

#### ✓ Working | ⚠ Issues
- ✓ Comprehensive 12-tab project workspace
- ✓ GitHub repo integration with server-side token management
- ✓ File explorer with tree navigation
- ✓ Scroll spy for tab navigation
- ⚠ Some tabs may show empty states if no data (needs consistent empty state handling)
- ⚠ File explorer could use syntax highlighting for code files

---

### 3.8 Community (`/community`)

**File**: `src/routes/_authenticated/community.tsx`

#### Layout
- **LeftSidebar**: Navigation tree (Home, Today Digest, Discussions, Questions, Resources, Milestones, My Posts)
- **Main Feed**: CommunityFeedList with ComposerBar + post cards
- **RightSidebar**: Trending topics, active spaces, stats

#### Spaces
- **CommunitiesSection**: Space cards in grid
- **SpaceHeader**: Banner, name, member count, join/leave
- Filter by name, sort by popular/newest
- Create space dialog

#### Post Types (14 types)
Discussion, Project, Question, Resource, Milestone, Update, Poll, Challenge, Session, Event, Showcase, Help, Collaboration, Announcement

#### Composer
- Text area with markdown support
- Post type selector
- Space selector
- Project attachment panel
- Media upload placeholder

#### ✓ Working | ⚠ Issues
- ✓ 14 post types implemented
- ✓ Community spaces with membership flow
- ✓ Join request/approval for private spaces
- ✓ Mobile bottom nav for navigation
- ✓ Mobile drawers for sidebar + trending
- ⚠ Composer lacks rich text formatting toolbar
- ⚠ Poll post type needs poll creation UI
- ⚠ No post editing (only create + delete)

---

### 3.9 Challenges (`/challenges`)

**File**: `src/routes/_authenticated/challenges.tsx`

#### Feature
- Challenge grid with cards (type, difficulty, skills, dates)
- Filters: Type (skill/project/learning), Difficulty (beginner/intermediate/advanced), Status (active/upcoming/completed)
- Search by title, description, skills
- Create challenge dialog

#### Challenge Detail (`/challenges/$id`)
- Full challenge info
- Join/leave flow
- Progress tracking
- Pass criteria display
- Reputation rewards on completion

#### ✓ Working | ⚠ Issues
- ✓ Triple filter system (type + difficulty + status)
- ✓ Search across title, description, skills
- ⚠ Challenge creation flow could be more guided (step-by-step wizard)
- ⚠ No challenge leaderboard or participant gallery

---

### 3.10 Sessions (`/sessions`)

**File**: `src/routes/_authenticated/sessions.tsx`

#### Layout (`SessionsLayout`)
- **SessionsSidebar**: Calendar, filters, availability settings
- **Main content**: 
  - OverviewCards (next session, stats)
  - TodaySchedule
  - UpcomingSessions
  - SessionRequests (incoming/outgoing)
  - SessionHistory

#### Calendar
- Month, week, agenda views
- Session cards with color coding
- Click to view details

#### Session Detail (`/sessions/$id`)
- Session info card
- Resources panel
- Join/start session button
- Session notes

#### Request Flow
- RequestSessionDialog: pick type, time, message
- Pending requests appear in recipient's dashboard
- Accept/decline flow
- Availability settings per user

#### ✓ Working | ⚠ Issues
- ✓ 3 calendar views working
- ✓ Full request lifecycle
- ✓ Availability badge integration
- ⚠ No video/audio call integration (Zoom/Google Meet links are manual)
- ⚠ Session reminders/notifications via email not implemented
- ⚠ Calendar event creation (Google/Outlook) not implemented

---

### 3.11 Library (`/library`)

**File**: `src/routes/_authenticated/library.tsx`

#### Feature
- Personal knowledge base: notes, files, links
- **Views**: All Items, Favorites, Pinned, Recent, Uploads, Collections, Tags
- **Layout toggle**: Grid / List views
- **LibrarySidebar**: Collections tree, tags, filters
- **FileUploadZone**: Drag-drop file upload with progress
- **NoteEditor** (`/library/$id`): Rich text editor for notes

#### Item Card
- Type icon with color coding
- Title, excerpt, date, favorite/pin actions
- Collection and tag badges

#### ✓ Working | ⚠ Issues
- ✓ Grid + list layout toggle
- ✓ Collection-based organization
- ✓ File upload with drag-drop zone
- ✓ Note editor has full TipTap rich text: toolbar with undo/redo, headings, bold/italic/strikethrough, code, lists, quote, code blocks (syntax highlighted), links, images, tables
- ⚠ No full-text search across notes content
- ⚠ Database migration warning shown when tables not created

---

### 3.12 Messages (`/messages`)

**File**: `src/routes/_authenticated/messages.tsx`

#### Feature
- **2-pane layout**: Conversation list (left) + Thread (right)
- Connection-based: only accepted tethrs can message
- **Real-time**: Typing indicators, read receipts, unread badges
- **Pagination**: "Load older messages" button
- **Intro message**: Shows the original connection intro note

#### Thread
- Message bubbles (sent: primary color right, received: surface left)
- Send button with loading state
- Enter to send, Shift+Enter for newline
- Auto-scroll to bottom on new messages

#### ✓ Working | ⚠ Issues
- ✓ Typing indicators with bouncing dots
- ✓ Read receipts (single check = sent, double check = read)
- ✓ Optimistic send with loading spinner
- ✓ Unread count badges
- ⚠ No image/file attachment support
- ⚠ No emoji picker
- ⚠ Conversation search not implemented

---

### 3.13 Skills Hub (`/skills/$slug`)

**File**: `src/routes/skills.$slug.tsx`

#### Feature
- Skill detail page
- Teachers list (people who teach this skill)
- Learners list (people learning this skill)
- Related projects
- Skill popularity count

#### ✓ Working | ⚠ Issues
- ✓ Teachers and learners lists
- ✓ Related project links
- ⚠ No skill comparison or progression path
- ⚠ Skill endorsements not displayed here

---

### 3.14 Notifications (`/notifications`)

**File**: `src/routes/_authenticated/notifications.tsx`

#### Feature
- Notification feed with filtering
- Notification types: session requests, connection requests, challenge updates, mentions, role applications
- Mark as read/unread
- Notification dropdown (bell icon)

#### ✓ Working | ⚠ Issues
- ✓ Multiple notification types
- ✓ Real-time count badge
- ⚠ No push notifications (browser)
- ⚠ No email notification digests

---

## 4. Design Patterns & Conventions

### Card Patterns
```
rounded-2xl border card-border bg-surface
  → p-5 (default padding)
  → p-4 sm:p-5 (responsive padding)
  → hover:border-[var(--user-accent-border,...)]
  → hover:-translate-y-0.5
  → hover:shadow-lg
```

### Empty States
- Component: `src/components/tethyr/empty-state.tsx`
- Centered icon + title + description
- Optional action button
- Various contexts: community, projects, library, messages

### Loading States
- `animate-pulse` skeletons matching card dimensions
- `bg-surface/60` or `bg-surface-elevated` for skeleton color
- Spinner: `Loader2` with `animate-spin`

### Error States
- Centered error card with:
  - Error title
  - Error message
  - "Try again" button
  - For database errors: migration instructions

### Form Patterns
- `rounded-xl` or `rounded-2xl` inputs
- Floating labels not used (labels above inputs)
- Validation on submit
- Toast notifications via `sonner`

---

## 5. Known Issues & Audit Findings

### Critical (Active Bugs)
| # | Issue | Location | Status |
|---|---|---|---|
| 1 | MiniCard previews use `object-cover` while center card uses `object-contain` | `project-shelf.tsx` | Open |
| 2 | Social login buttons are UI-only, not wired to OAuth providers | `login.tsx`, `signup.tsx` | Open |
| 3 | No "forgot password" link visible on login page | `login.tsx` | Open |

### High Priority
| # | Issue | Location | Status |
|---|---|---|---|
| 4 | Composer lacks rich text formatting toolbar | `composer-bar.tsx` | Open |
| 5 | Note editor has TipTap rich text ✓ (still needs: drag-drop images, paste-from-clipboard images) | `note-editor.tsx` | Partial |
| 6 | No video/audio call integration for sessions | Sessions feature | Open |
| 7 | Message thread has no file/image attachment | `messages.tsx` | Open |
| 8 | Library has no full-text search across notes | `library.tsx` | Open |

### Medium Priority
| # | Issue | Location | Status |
|---|---|---|---|
| 9 | `renderModule` in dashboard has large dependency array | `dashboard.tsx` | Open |
| 10 | Poll post type needs poll creation UI | Community feature | Open |
| 11 | Challenge creation could use step-by-step wizard | `create-challenge-dialog.tsx` | Open |
| 12 | No challenge leaderboard or participant gallery | Challenges feature | Open |
| 13 | Skill endorsements not visible on skill hub | `skills.$slug.tsx` | Open |
| 14 | No browser push notifications | Global | Open |
| 15 | No email notification digests | Global | Open |

### Low Priority
| # | Issue | Location | Status |
|---|---|---|---|
| 16 | Hero text can overflow on 320px screens | `index.tsx` | Open |
| 17 | FeaturedProjects uses random selection | `landing-sections.tsx` | Open |
| 18 | TABS icon imports could be simplified | `profile-layout.tsx` | Open |
| 19 | Password strength indicator not implemented | `signup.tsx` | Open |
| 20 | Session calendar event sync (Google/Outlook) not implemented | Sessions feature | Open |

### Resolved in Recent Audits
- ✓ Micro-font sizes upgraded (text-[8px]→text-[10px], text-[10px]→text-[11px])
- ✓ 136+ truncate elements now have `title` attributes
- ✓ Calendar cell heights increased for readability
- ✓ Card borders standardized to `card-border`
- ✓ Card rounding standardized to `rounded-2xl`
- ✓ All `bg-card` replaced with `bg-surface`
- ✓ Project shelf cards no longer disappear during navigation
- ✓ "View public profile" link removed from own studio sidebar
- ✓ Display names use `break-words` instead of `truncate`
- ✓ Dashboard and profile have Customize toggle (static layout ←→ drag-drop grid)
- ✓ Project shelf has mouse wheel + touch drag + keyboard navigation
- ✓ Overlay has swipe-to-dismiss

---

## 6. Future Steps & Recommendations

### Phase A: Polish (Next Sprint)
1. **Rich text for Composer**: Add TipTap toolbar to community ComposerBar (Note Editor already has TipTap) |
2. **Forgot password flow**: Wire up reset-password route properly, add link on login page
3. **Social login**: Wire up Google/GitHub OAuth providers (buttons already in place)
4. **File/image uploads in messages**: Add attachment support to message thread
5. **Poll creation UI**: Implement poll builder in community composer
6. **Password strength meter**: Add zxcvbn-based strength indicator on signup

### Phase B: Feature Depth
1. **Video/audio sessions**: Integrate with Daily.co, Whereby, or Jitsi for in-app calls
2. **Calendar sync**: Google Calendar + Outlook integration for session scheduling
3. **Push notifications**: Service worker + Web Push API for browser notifications
4. **Email digests**: Weekly activity summaries via email
5. **Challenge leaderboards**: Public rankings for challenge participants
6. **Skill progression paths**: Learning paths that chain related skills

### Phase C: Platform Scale
1. **Infinite scroll / pagination**: Explore page, community feed, library
2. **Full-text search**: Postgres full-text search across notes, posts, projects
3. **Analytics dashboard**: Project views, profile visits, contribution stats
4. **API layer**: Public REST/GraphQL API for integrations
5. **Mobile app**: React Native port using shared hooks and types

---

*Generated from full codebase audit. All routes, components, and interactions verified.*
