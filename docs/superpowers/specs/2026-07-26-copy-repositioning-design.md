# Copy Repositioning: Marketplace → Collaborative Network

**Date:** 2026-07-26
**Status:** Approved
**Scope:** Full UI copy refresh across all pages and shared components

## Goal

Reposition Tethyr from a skill-sharing marketplace to a collaborative network. Shift all user-facing copy, page names, section labels, meta descriptions, empty states, and CTAs to reflect the collaborative loop:

**Discover → Connect → Collaborate → Build → Share Knowledge → Earn Reputation → Unlock Opportunities → Repeat**

## Approach

**Bottom-up terminology replacement (Approach B):**
1. Build the definitive vocabulary mapping (this document)
2. Search the entire codebase for every instance of marketplace terms
3. Apply replacements file by file with contextual adjustments

## Constraints

- **DB schema unchanged** — `creator_title`, `profile_skills_teach/learn`, `skill_exchange`, `teaching_style`, `learning_goals` columns/tables stay as-is
- **Internal code unchanged** — variable names (`teachIds`, `learnIds`), component file names, query keys stay as-is
- **Achievement/reputation type keys unchanged** — `prolific_teacher`, `learner_journey`, etc. stay as-is
- **Community post types unchanged** — `lesson_learned`, `progress_update`, etc. stay as-is
- **README/ROADMAP/docs unchanged** — separate task
- **Layout structure unchanged** — no new pages, no route changes, no component restructuring

## Scope Boundaries

### In scope
- All user-facing UI text (labels, headings, descriptions, empty states, CTAs, fallback text)
- Page `<title>` tags and meta descriptions (og:, twitter:)
- Sidebar navigation labels and subtitles
- Footer copy
- Session type display labels
- Profile field labels and placeholders
- Skill page statistics labels

### Out of scope
- Database schema changes or migrations
- Internal variable/function/component renaming
- Structural UI changes (layout, routing, component hierarchy)
- README.md, ROADMAP.md, PHASE6_ROADMAP.md, docs/ files
- Code comments (can do separately)
- Achievement type keys and reputation system structure

---

## Vocabulary Mapping

### Page/Section Names

| Current | New |
|---------|-----|
| Reception | **Dashboard** |
| Creative Studios | **Explore** |
| Open Collaboration Space | **Community** |
| Workshop (profile page) | **Studio** |
| Sessions | Sessions (keep) |
| Library | Library (keep) |
| Messages | Messages (keep) |

### User Terminology

| Current | New | Context |
|---------|-----|---------|
| creator(s) | **person / people / member(s)** | All generic user references |
| "Untitled creator" | **"Untitled member"** | Fallback display name |
| "creator title" | **"role" or "title"** | Profile subtitle display |
| "creator catalog" | **"community"** | Dashboard discover subtitle |
| "No creator with that handle" | **"No member with that handle"** | Public profile 404 |

### Skill Framing

| Current | New | Context |
|---------|-----|---------|
| "Skills I teach" | **"Skills I Share"** | Profile skills tab |
| "Currently learning" | **"Growing"** | Profile skills tab |
| "Teachers" | **"Sharing"** | Skill page stats |
| "Learners" | **"Growing"** | Skill page stats |
| "No teachers yet" | **"No one sharing yet"** | Skill page empty state |
| "No learners yet" | **"No one growing yet"** | Skill page empty state |
| "Find teachers" | **"Find people sharing"** | Skill page CTA |
| "Teaching style" | **"How I Share"** | Profile edit field label |
| "Learning goals" | **"What I'm Growing"** | Profile edit field label |
| "teaching" / "learning" | **"sharing" / "growing"** | Reputation badges, achievements |
| "Prolific Teacher" | **"Prolific Sharer"** | Achievement label |
| "Learner's Journey" | **"Growth Journey"** | Achievement label |
| "Teaching" section | **"Sharing" section** | Reputation breakdown |
| "Learning" section | **"Growing" section** | Reputation breakdown |

### Hero / Tagline / Meta

| Current | New |
|---------|-----|
| "Where creators build together" | **"Where people build together"** |
| "Skills for skills" | **"Build together. Grow together."** |
| "A premium creative campus where creators discover, learn, collaborate, and grow" | **"A collaborative network where people discover, connect, and build together"** |
| "skills for skills, not money" | **Remove entirely** |
| "Connected by what you know" | Keep (good tagline) |
| "Claim your handle and join the first wave of creators building Tethyr together" | **"Claim your handle and join the people building Tethyr together"** |
| "Creators teach each other, learn from each other" | **"People share skills, grow together"** |

### Sessions

| Current | New |
|---------|-----|
| "Skill Exchange" (session type label) | **"Collaboration"** |
| "Trade skills with a peer" | **"Collaborate on skills with a peer"** |
| "Manage your skill exchanges, mentoring, and meetings" | **"Your sessions and collaborations"** |
| "Group teaching session" | **"Group session"** |
| "Skill Exchange" (sidebar label) | **"Collaboration"** |
| "completed skill exchanges" | **"completed sessions"** |

### Navigation / Sidebar

| Current | New |
|---------|-----|
| "Reception" → "Today's activity" | **"Dashboard" → "Today's activity"** |
| "Creative studios" (explore sub) | **"Projects & people"** |
| "Workshop" → "Your skills" | **"Studio" → "Your work"** |
| "Search the workshop…" | **"Search the studio…"** |
| "Campus" (section header) | **Remove or use "Navigation"** |
| "Leave the workshop" | **"Sign out"** |
| `creator_title` fallback "Workshop" | **"Studio"** |

### Dashboard

| Current | New |
|---------|-----|
| "Reception" title | **"Dashboard"** |
| "Your Tethyr reception" | **"Your Tethyr dashboard"** |
| Profile completion: "other creators can discover you and start exchanging knowledge" | **"other people can find you and start collaborating"** |
| "A few things to finish before other creators can find you" | **"A few things to finish before other people can find you"** |
| "Explore creators" | **"Explore people"** |
| "Browse workshops" | **"Browse studios"** |
| "Creators you match with" | **"People you connect with"** |
| "Discover skills" / "Trending across the creator catalog" | **"Discover skills" / "Trending across the community"** |
| `?? "creator"` fallback | **`?? "member"`** |

### Explore

| Current | New |
|---------|-----|
| "Creative Studios" title/header | **"Explore"** |
| `Tab = "projects" \| "creators"` display | **"People"** tab label |
| "Discover projects in progress and creators building them" | **"Discover projects in progress and the people behind them"** |
| "Browse active projects, find creators to collaborate with" | **"Browse active projects, find people to collaborate with"** |
| "Search projects, tags, or creators…" | **"Search projects, tags, or people…"** |
| "No creators match yet" | **"No people match yet"** |
| "Untitled creator" | **"Untitled member"** |
| "New creator" fallback | **"New member"** |

### Community

| Current | New |
|---------|-----|
| "Open Collaboration Space" | **"Community"** |
| "An open workshop floor where creators share ideas" | **"A space where people share ideas, ask for help, and collaborate"** |
| "workshop floor" references | **"community"** |
| "No workshops yet" / "Workshop spaces will appear here" | **"No studios yet" / "Studios will appear here"** |
| "The workshop is quiet" | **"The community is quiet"** |
| "Workshop Floor" feed filter | **"Community Feed"** |
| "Workshops" feed filter | **"Studios"** |
| "Community challenges give creators shared goals to learn and build together" | **"Community challenges give people shared goals to grow and build together"** |

### Profile / Studio

| Current | New |
|---------|-----|
| "Your Workshop" title | **"Your Studio"** |
| "Manage your skills, projects, and creative presence" | **"Your projects, contributions, and collaborative presence"** |
| "Workshop failed to load" | **"Studio failed to load"** |
| "Couldn't load your workshop" | **"Couldn't load your studio"** |
| "Setting up your workshop…" | **"Setting up your studio…"** |
| "Skills I teach" | **"Skills I Share"** |
| "Currently learning" | **"Growing"** |
| "Tell other creators who you are and what you make" | **"Tell people who you are and what you make"** |
| "Exchange Skills" CTA button | **"Collaborate"** |
| "No skills yet. Tap edit to pick from the catalog" | **"No skills yet. Tap edit to add from the catalog"** |
| "Search the catalog…" placeholder | Keep as-is |

### Public Profile (u.$handle)

| Current | New |
|---------|-----|
| "No creator with that handle" | **"No member with that handle"** |
| "Untitled creator" | **"Untitled member"** |
| "Skills They Teach" / "Skills they teach and can help you with" | **"Skills They Share" / "Skills they share and can help you with"** |
| "Not sharing any workshops yet" | **"Not sharing any skills yet"** |
| "Projects this creator has worked on" | **"Projects this person has worked on"** |
| "Currently learning" card | **"Growing"** card |
| `alt="...Creator banner"` | **`alt="...Member banner"`** |
| `alt="...Creator avatar"` | **`alt="...Member avatar"`** |
| `{/* Avatar — Creator Portrait */}` comment | **`{/* Avatar — Member Portrait */}`** |

### Skill Page (skills.$slug)

| Current | New |
|---------|-----|
| "Skills Workshop" title | **"Skills Studio"** |
| "Workshop" in h1 and labels | **"Studio"** |
| "Teachers" / "Learners" stats | **"Sharing" / "Growing"** |
| "No teachers yet" / "No learners yet" | **"No one sharing yet" / "No one growing yet"** |
| "Be the first to offer...teaching" | **"Be the first to share this skill"** |
| "Be the first to start learning" | **"Be the first to start growing"** |
| "What is the {name} Workshop?" | **"What is the {name} Studio?"** |
| "This is a dedicated learning space..." | **"This is a dedicated space for..."** |
| Tab labels "Teachers" / "Learners" | **"Sharing" / "Growing"** |
| `{/* Workshop divider */}` comment | **`{/* Studio divider */}`** |
| `{/* Tabs — Workshop sections */}` comment | **`{/* Tabs — Studio sections */}`** |
| "WORKSHOP_ICONS" code constant | Keep as-is (internal) |
| "WorkshopIcon" component | Keep as-is (internal) |

### Signup / Login

| Current | New |
|---------|-----|
| "Claim your handle and start trading skills" | **"Claim your handle and start building together"** |
| "Log in to continue teaching and learning" | **"Log in to continue building and growing"** |
| "credit your teachers" | **"credit the people who help you"** |
| "Join the Tethyr knowledge network for creators" | **"Join the Tethyr collaborative network"** |

### Footer

| Current | New |
|---------|-----|
| "The digital home where creators build together. Learn, teach, connect, and grow — skills for skills, not money." | **"The collaborative network where people build together. Connect, share, and grow."** |
| "Campus" section heading | **"Platform"** |
| "Reception" link | **"Dashboard"** |
| "Find Teachers" link | **"Find People Sharing"** |
| "A trusted knowledge network for creators" | **"A trusted collaborative network"** |

### Shared Components

| Component | Current | New |
|-----------|---------|-----|
| `suggested-creators.tsx` | "creators you match with" | **"people you connect with"** |
| `suggested-creators.tsx` | "Untitled creator" | **"Untitled member"** |
| `suggested-creators.tsx` | `creator_title \|\| "Creator"` | **`creator_title \|\| "Member"`** |
| `sessions-layout.tsx` | "Manage your skill exchanges" | **"Your sessions and collaborations"** |
| `sessions-sidebar.tsx` | "Skill Exchange" type label | **"Collaboration"** |
| `schedule-session-wizard.tsx` | "Skill Exchange" + "Trade skills" | **"Collaboration"** + **"Collaborate on skills"** |
| `schedule-session-wizard.tsx` | "Group teaching session" | **"Group session"** |
| `profile-layout.tsx` | "Exchange Skills" button | **"Collaborate"** |
| `profile-sessions-tab.tsx` | "completed skill exchanges" | **"completed sessions"** |
| `achievements.tsx` | "teaching on Tethyr" | **"sharing on Tethyr"** |
| `tethyr-ball.tsx` | "Entering the workshop…" | **"Entering the studio…"** |
| `discover-skills.tsx` | "skill catalog" | **"catalog"** |
| `right-sidebar.tsx` | "mentoring on a project" | **"helping on a project"** |
| `profile-reviews-tab.tsx` | "Reviews from collaborators" | Keep as-is |
| `availability-badge.tsx` | "Mentoring" | Keep as-is |
| `profile-completeness.ts` | "Write a creator title" | **"Write your title"** |
| `profile-completeness.ts` | "Pick a creator category" | **"Pick a category"** |
| `profile-completeness.ts` | "Add your first teaching skill" | **"Add your first skill to share"** |
| `profile-completeness.ts` | "Add a skill you're learning" | **"Add a skill you're growing"** |
| `profile-completeness.ts` | "Describe your teaching style" | **"Describe how you share"** |
| `profile-completeness.ts` | "Share your learning goals" | **"Share what you're growing"** |
| `reputation.ts` | "Prolific Teacher" label | **"Prolific Sharer"** |
| `reputation.ts` | "Learner's Journey" label | **"Growth Journey"** |
| `reputation.ts` | "Teaching" section | **"Sharing"** |
| `reputation.ts` | "Learning" section | **"Growing"** |
| `reputation.ts` | "Teaching 5+ skills" description | **"Sharing 5+ skills"** |
| `reputation.ts` | "Learning 5+ skills" description | **"Growing in 5+ skills"** |
| `community-data.ts` | "Verified Teacher" | **"Verified Sharer"** |
| `community-data.ts` | "Helpful Mentor" | Keep as-is (mentor is collaborative) |
| `community-data.ts` | "Learner" badge | **"Growing"** |
| `community-data.ts` | "Learning Progress" | **"Growth Progress"** |
| `community-data.ts` | "Lesson Learned" | **"Insight Shared"** |
| `community-data.ts` | "Learning" / "Teaching" filters | **"Growing" / "Sharing"** |
| `community-data.ts` | "Mentorship" / "Language Exchange" | Keep as-is |

### Root/Layout Meta (src/routes/__root.tsx)

| Current | New |
|---------|-----|
| `<title>` "Where creators build together" | **"Where people build together"** |
| `meta description` "A premium creative campus where creators discover, learn, collaborate, and grow. People become known through what they build together." | **"A collaborative network where people discover, connect, and build together. Become known through what you build."** |
| `og:title` / `twitter:title` | **Same as above** |
| `og:description` / `twitter:description` | **Same as above** |

---

## Files to Modify (28 files)

### Routes (13 files)
1. `src/routes/__root.tsx` — meta title, og, twitter tags
2. `src/routes/index.tsx` — landing hero, subtitle, CTA, meta
3. `src/routes/signup.tsx` — subtitle, fine print, meta
4. `src/routes/login.tsx` — subtitle
5. `src/routes/skills.$slug.tsx` — page title, stats, tabs, empty states, CTAs
6. `src/routes/u.$handle.tsx` — profile display, fallbacks, section headers
7. `src/routes/projects.$id.tsx` — **no changes needed** (the "Creator" role label here is a project role like "founder," not marketplace terminology)
8. `src/routes/_authenticated/dashboard.tsx` — title, headings, fallbacks, section labels
9. `src/routes/_authenticated/explore.tsx` — title, tabs, search, empty states
10. `src/routes/_authenticated/community.tsx` — title, header, filters, empty states
11. `src/routes/_authenticated/profile.tsx` — title, headings, field labels, empty states
12. `src/routes/_authenticated/profile.$userId.tsx` — meta, fallback text
13. `src/routes/_authenticated/sessions.tsx` — meta description

### Shared Components (13 files)
14. `src/components/tethyr/navbar.tsx` — if it references any marketplace terms
15. `src/components/tethyr/dashboard-sidebar.tsx` — nav labels, section header, fallbacks
16. `src/components/tethyr/footer.tsx` — all copy
17. `src/components/tethyr/suggested-creators.tsx` — display labels, fallbacks
18. `src/components/tethyr/sessions/sessions-layout.tsx` — description
19. `src/components/tethyr/sessions/sessions-sidebar.tsx` — type labels
20. `src/components/tethyr/sessions/schedule-session-wizard.tsx` — type labels, descriptions
21. `src/components/tethyr/profile/profile-layout.tsx` — CTA button
22. `src/components/tethyr/profile/profile-sessions-tab.tsx` — empty state
23. `src/components/tethyr/achievements.tsx` — descriptions
24. `src/components/tethyr/tethyr-ball.tsx` — loading text
25. `src/components/tethyr/discover-skills.tsx` — description
26. `src/components/tethyr/community/right-sidebar.tsx` — sidebar copy

### Library Files (3 files)
27. `src/lib/profile-completeness.ts` — field labels
28. `src/lib/reputation.ts` — achievement labels, section names
29. `src/lib/community-data.ts` — badge labels, filter labels, post type labels

---

## Verification

After all changes, run a final grep for these terms to confirm zero remaining user-facing instances:
- `creator` (should only appear in code/DB references, not UI text)
- `teach` / `teacher` / `teaching` (should only appear in code/DB references)
- `learn` / `learner` / `learning` (should only appear in code/DB references)
- `skill exchange` (should only appear in code/DB references)
- `workshop` (should only appear in code/DB references)
- `skills for skills` (should be zero)
- `Reception` (should be zero)
- `Creative Studios` (should be zero)
- `Open Collaboration Space` (should be zero)
- `marketplace` (should be zero)
