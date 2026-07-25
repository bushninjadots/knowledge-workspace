# Profile Page Redesign — Design Spec

## Summary

Redesign the Tethyr profile page from a single scrollable page into a tabbed, multi-user profile system with public viewing, sidebar, and 7 content tabs.

## Routes

- `/profile` — own profile (edit mode, all existing edit dialogs)
- `/profile/$userId` — public profile (view-only, action buttons: Connect, Message, Exchange Skills)

Both share `ProfileLayout` component. Own profile shows edit affordances; public profile shows action buttons.

## Layout

```
Navbar
Cover Banner (full-width)
Profile Header (avatar, name, handle, bio, location, availability, CTA)
Tabs Navigation: Overview | Skills | Projects | Communities | Activity | Sessions | Reviews
-----------------------------------------------
| Main Content (tab)           | Sidebar       |
|                              | Reputation    |
|                              | Verification  |
|                              | Stats         |
|                              | Quick Links   |
------------------------------------------------
```

Mobile: stack sidebar below content.

## Tabs

### 1. Overview

- Reputation card (score, tier, breakdown)
- Skills summary (top teach/learn skills)
- Projects preview (featured/last 3)
- Verification badges
- Activity preview (last 5 events)
- Achievement highlights

### 2. Skills

- Skills I teach (with verification/experience badges, proof)
- Skills I want to learn
- Skill Match card (when viewing another user: "You can teach X, they teach Y, 92% match")
- Edit dialogs (own profile only)

### 3. Projects

- Full project grid (reuse existing ProjectsCard)
- Create/edit/delete (own profile only)

### 4. Communities

- Community memberships (Reddit-style: role, karma, posts)
- **Stub for now** — empty state with "Coming soon"

### 5. Activity

- GitHub-style contribution graph (heatmap from activity_events + contribution_log)
- Full activity timeline (reuse existing ActivityTimeline)

### 6. Sessions

- Session history (completed exchanges with ratings)
- Stats: sessions completed, hours shared, people helped
- Connects to existing sessions feature

### 7. Reviews

- Airbnb-style reviews from exchanges
- **Stub for now** — empty state with "Coming soon"

## Sidebar (persistent across tabs)

- Reputation score + tier badge
- Verification badges (identity, skills, community)
- Stats: sessions completed, skills taught, projects, reputation
- Quick links: social links, portfolio

## Components

| Component             | File                          | Purpose                                |
| --------------------- | ----------------------------- | -------------------------------------- |
| ProfileLayout         | `profile-layout.tsx`          | Banner + header + tabs + sidebar shell |
| ProfileSidebar        | `profile-sidebar.tsx`         | Reputation, verification, stats        |
| ProfileOverviewTab    | `profile-overview-tab.tsx`    | Summary content                        |
| ProfileSkillsTab      | `profile-skills-tab.tsx`      | Teach/learn + match                    |
| ProfileProjectsTab    | `profile-projects-tab.tsx`    | Project grid                           |
| ProfileCommunitiesTab | `profile-communities-tab.tsx` | Stub                                   |
| ProfileActivityTab    | `profile-activity-tab.tsx`    | Contribution graph + timeline          |
| ProfileSessionsTab    | `profile-sessions-tab.tsx`    | Session history                        |
| ProfileReviewsTab     | `profile-reviews-tab.tsx`     | Stub                                   |
| ContributionGraph     | `contribution-graph.tsx`      | GitHub-style heatmap                   |
| SkillMatchCard        | `skill-match-card.tsx`        | Mutual exchange compatibility          |
| ProfileActions        | `profile-actions.tsx`         | Connect/Message/Exchange buttons       |

## Existing Code Reused

- `BannerStrip`, `HeaderCard` → adapted into `ProfileLayout`
- `ProjectsCard`, `ProjectDialog` → used in Projects tab
- `ChipListCard`, `VerificationBadge`, `ExperienceBadge` → used in Skills tab
- `ReputationCard`, `ReputationBreakdown`, `ReputationTierBadge` → sidebar + Overview
- `AchievementGrid` → Overview tab
- `ActivityTimeline` → Activity tab
- `SectionCard` → shared card shell

## Database

No new tables required for this phase. Tabs that need new data (Communities, Reviews) are stubbed with empty states.

Skill Match compatibility is computed client-side by comparing two users' teach/learn skills.

## Implementation Order

1. ProfileLayout shell (banner + header + tabs + sidebar)
2. Public profile route
3. Overview tab
4. Skills tab
5. Projects tab
6. Activity tab + ContributionGraph
7. Sessions tab
8. Communities + Reviews stubs
9. Profile actions (Connect/Message/Exchange)
10. Lint + typecheck
