# Tethyr UX Audit

> Last updated: August 7, 2026

---

## Priority Scale

| Level | Meaning |
|-------|---------|
| 🔴 Critical | Blocks the core promise — user can't do something they should |
| 🟠 High | Confusing or missing — impacts daily use |
| 🟡 Medium | Polish — would noticeably improve the experience |
| 🟢 Low | Nice-to-have — would be better but not urgent |

---

## 1. Landing Page (`/`)

| # | Issue | Priority |
|---|-------|----------|
| 1.1 | ✅ Hero copy updated to identity | Done |
| 1.2 | ✅ Marquee stats, animated counters, scroll indicator | Done |
| 1.3 | ✅ Section reveal animations | Done |
| 1.4 | ✅ Featured project card + live activity panel | Done |
| 1.5 | ✅ HeroActions — "What you can do here" cards aligned with the pillars | Done |
| 1.6 | 🟡 Landing sections order: How It Works → Skills → Projects → Activity → Spaces. Could move Spaces before Activity for better flow. | Medium |
| 1.7 | ✅ QuickMatch search removed (feature retired) — replaced with HeroActions pillar cards | Done |

---

## 2. Sign Up (`/signup`)

| # | Issue | Priority |
|---|-------|----------|
| 2.1 | ✅ Copy updated to identity | Done |
| 2.2 | 🟠 Craft picker limited to 10 options. Doesn't cover many creative disciplines (e.g. game dev, 3D, architecture, research). Should pull from skills catalog. | High |
| 2.3 | 🟡 No onboarding flow after signup — user lands on dashboard with no guidance | Medium |

---

## 3. Dashboard (`/dashboard`)

| # | Issue | Priority |
|---|-------|----------|
| 3.1 | ✅ Today cards with actionable focus | Done |
| 3.2 | ✅ Two-column layout with Your Work / Discover | Done |
| 3.3 | ✅ Welcome bar with banner, availability, rep | Done |
| 3.4 | 🟡 "Start a project" quick-link goes to explore, not to a create-project flow. Where do you actually create a project? | Medium |
| 3.5 | 🔴 No "Create Project" button or flow anywhere obvious. Users need to go to Profile → Projects tab to create one. | Critical |
| 3.6 | 🟡 Dashboard doesn't show project progress in a glanceable way beyond the Today card | Medium |

---

## 4. Explore (`/explore`)

| # | Issue | Priority |
|---|-------|----------|
| 4.1 | ✅ Wider layout with sidebar | Done |
| 4.2 | ✅ Staggered animations | Done |
| 4.3 | 🟡 Projects tab uses the 3D shelf — beautiful but keyboard-only users may struggle. Could add a grid/list toggle. | Medium |
| 4.4 | 🟡 "Start a project" CTA missing from this page — this is where people go to find projects, but can't create one here | Medium |
| 4.5 | 🟢 Opportunities tab shows roles but doesn't filter by user's skills by default — requires clicking "Best match" | Low |

---

## 5. Community (`/community`)

| # | Issue | Priority |
|---|-------|----------|
| 5.1 | ✅ Three-column layout with left sidebar, feed, right sidebar | Good |
| 5.2 | 🟠 Composer bar takes significant vertical space. New users may not realize they can create content here. | High |
| 5.3 | 🟡 No way to filter by "projects I'm involved in" — all posts shown | Medium |

---

## 6. Project Detail (`/projects/$id`)

| # | Issue | Priority |
|---|-------|----------|
| 6.1 | 🔴 Gallery only accepted URLs (no uploads) — **FIXED** — now supports drag-and-drop upload | Done |
| 6.2 | 🔴 No way to upload project files directly — **FIXED** — Files section with drag-and-drop added | Done |
| 6.3 | 🔴 No "Create Project" button anywhere obvious on the platform | Critical |
| 6.4 | 🟠 10+ sections in scroll-spy creates cognitive overload. Sections should be grouped or collapsed. | High |
| 6.5 | 🟠 Stage timeline appears in BOTH the main content AND the sidebar — redundant | High |
| 6.6 | 🟠 The hero is full-viewport-height (100vh) — looks stunning but pushes all content below the fold. On mobile especially, users may not realize there's content below. | High |
| 6.7 | 🟡 Sidebar "Join Project" and "Request to Join" appear twice (top and bottom of sidebar) | Medium |
| 6.8 | 🟡 Milestones, updates, discussions, contributors are all separate sections. Could be tabs or accordions. | Medium |
| 6.9 | ✅ Linked repos section added | Done |

---

## 7. Profile (`/profile` and `/u/$handle`)

| # | Issue | Priority |
|---|-------|----------|
| 7.1 | ✅ GitHub connect added | Done |
| 7.2 | 🟠 Profile page has 7 tabs (Overview, Skills, Projects, Communities, Activity, Sessions, Reviews). Too many. Sessions and Reviews could be merged into Activity. | High |
| 7.3 | 🟡 "Create Project" flow lives in Profile → Projects tab. Should be accessible from dashboard and explore too. | Medium |
| 7.4 | 🟡 No way to reorder profile sections or customize layout | Medium |
| 7.5 | 🟢 Social links section includes GitHub but the "Connect GitHub" card (new) duplicates functionality | Low |

---

## 8. Messages (`/messages`)

| # | Issue | Priority |
|---|-------|----------|
| 8.1 | 🟡 Messages page feels disconnected from the rest of the app — no project context, no quick actions | Medium |
| 8.2 | 🟡 No way to start a conversation from a project page or profile — must navigate to Messages separately | Medium |

---

## 9. Sessions (`/sessions`)

| # | Issue | Priority |
|---|-------|----------|
| 9.1 | 🟠 Session creation flow is complex — calendar, availability, request system. Could be simplified. | High |
| 9.2 | 🟡 No way to schedule a session directly from a project page or profile | Medium |

---

## 10. Library (`/library`)

| # | Issue | Priority |
|---|-------|----------|
| 10.1 | 🔴 Library is private — files uploaded here can't be shared to projects. No project-to-library linking. | Critical |
| 10.2 | 🟡 Library is a personal space but feels disconnected from the rest of the platform | Medium |

---

## 11. Skills (`/skills/$slug`)

| # | Issue | Priority |
|---|-------|----------|
| 11.1 | 🟡 Skill hub pages are well-structured but hard to discover — only accessible via search or links | Medium |
| 11.2 | 🟢 No "related skills" section on profile pages to cross-link skill hubs | Low |

---

## 12. Challenges (`/challenges/$id`)

| # | Issue | Priority |
|---|-------|----------|
| 12.1 | 🟡 Challenge participation is tracked but there's no challenge discovery page — challenges only appear in community feed | Medium |

---

## 13. Notifications (`/notifications`)

| # | Issue | Priority |
|---|-------|----------|
| 13.1 | ✅ Categorized tabs, real-time updates | Good |
| 13.2 | 🟡 Notification dropdown in navbar shows count but clicking goes to full page — could show recent items inline | Medium |

---

## 14. Navigation & Global

| # | Issue | Priority |
|---|-------|----------|
| 14.1 | 🔴 No "Create" button in the navbar. Every major platform has one. Users shouldn't have to hunt for how to start a project. | Critical |
| 14.2 | 🟠 Nav items are: Dashboard, Explore, Community, Messages, Sessions, Library, Profile. That's 7 items. Could be grouped. | High |
| 14.3 | 🟡 Search (Ctrl+K) is good but only searches content — could also be a command palette ("Create project", "New note", etc.) | Medium |

---

## Priority Fix List

### Immediate (this session or next)
1. 🔴 Add "Create Project" button to navbar
2. 🔴 Add "Create Project" to dashboard and explore
3. 🔴 ✅ ~~Add project file uploads~~ (Done)
4. 🔴 ✅ ~~Gallery accepts uploads~~ (Done)
5. 🟠 Remove duplicate stage timeline from main content
6. 🟠 Collapse/group project detail sections

### This week
7. 🟠 Simplify profile tabs (merge Sessions + Reviews into Activity)
8. 🟠 Expand sign-up craft picker
9. 🟡 Add onboarding flow after signup
10. 🟡 Link library to projects

### This month
11. 🟡 Challenge discovery page
12. 🟡 Command palette for search
13. 🟡 Session scheduling from project/profile pages
14. 🟡 Message from project/profile pages
