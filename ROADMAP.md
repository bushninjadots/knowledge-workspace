# TETHYR MASTER ROADMAP

> **Every feature must strengthen the core loop.**
> Anything that doesn't strengthen this loop should either be postponed or rejected.

---

## The Core Loop

```
Discover
    ↓
Learn
    ↓
Collaborate
    ↓
Build Projects
    ↓
Earn Reputation
    ↓
Unlock Opportunities
    ↓
Repeat
```

---

## Design Principles (Non-Negotiable)

### 1. Projects are the centre of Tethyr
Every feature should connect back to projects.

### 2. Everything must strengthen the loop
Discover → Learn → Collaborate → Build → Share → Earn Reputation → Unlock Opportunities → Repeat

### 3. Avoid social media mechanics
Do NOT add: follower counts, like counts as primary metrics, vanity statistics, engagement bait, endless scrolling. Focus on meaningful contribution.

### 4. Reputation over popularity
Users become known for: helping others, finishing projects, mentoring, teaching, learning, collaborating — not for accumulating followers.

### 5. Every page needs a purpose
- **Home:** What should I do today?
- **Projects:** What are people building, and how can I contribute?
- **Community:** Where can I help or ask for help?
- **Skills:** What can I learn or teach?
- **Profile:** What have I contributed?
- **Dashboard:** What's my next meaningful action?

---

## The North Star

> Build Tethyr as the operating system for creators who learn together, build together, and earn trust through meaningful contribution. Every feature must encourage active collaboration, continuous learning, visible progress, and authentic reputation — not passive consumption or social popularity.

---

# PHASE 1 — Community Foundation ✅ DONE

Mobile access, visual polish, search & discovery, comments, user identity, rich composer (markdown, images, code blocks, draft autosave, edit flow).

---

# PHASE 2 — Living Projects (HIGHEST PRIORITY)

**Objective:** Turn projects from portfolio entries into collaborative workspaces.

## Step 2.1 — Redesign Project Model ✅ DONE

Current: Title, Description, Photo, Goal, Status

Expand to include:
```
Overview
Vision
Current Status
Progress
Milestones
Roadmap
Gallery
Resources
External Links
Skills Needed
Open Roles
Contributors
Weekly Updates
Discussion
```

Tasks:
- Redesign project schema (new DB columns/tables)
- Redesign project UI (`projects.$id.tsx`)
- Create reusable project components
- Responsive layouts
- Consistent design

## Step 2.2 — Project Timeline ✅ DONE

Timeline stages:
```
Planning → Building → Testing → Launch → Growing
```

- Users can update progress
- Community sees updates
- Timeline is visual and prominent on project page

## Step 2.3 — Milestones ✅ DONE

Each project has milestones:
```
Title
Description
Status (pending / in_progress / done)
Due Date
Owner
Progress
```

- Visual roadmap display
- Milestones are checkable/completeable
- Progress auto-calculates from milestone completion

## Step 2.4 — Weekly Updates ✅ DONE

Projects publish updates instead of random posts:
```
Week 8
- Finished UI redesign
- Need help with backend
- Looking for React developer
```

- Updates auto-appear in Community feed as `project_update` posts
- Updates are tied to the project timeline
- Composable from project page

## Step 2.5 — Open Roles ✅ DONE

Every project can advertise roles:
```
Looking For: Illustrator, React Dev, Writer, SEO, Music, 3D Artist, Tester
```

- Clickable roles
- Links to matching creators (filtered by skill match)
- Roles are part of the project schema
- Users can apply to open roles

## Step 2.6 — Contributors ✅ DONE

Every contributor gets:
```
Role (creator / contributor / mentor)
Joined Date
Contribution Score
Skills Used
```

- Contributor list is prominent on project page
- Contribution score is visible
- Skills used are tracked

## Step 2.7 — Project Discussions ✅ DONE

Instead of generic comments, project-specific discussion:
```
Questions
Ideas
Feedback
Pinned posts
Announcements
```

- Discussion is scoped to project
- Discussion categories
- Pinned/announcement posts
- Connected to project page, not generic feed

---

# PHASE 3 — Collaboration Engine ✅ DONE

The heart of Tethyr.

## Skill Matching ✅ DONE
Automatically suggest people, projects, mentors, learners based on:
- Teach skills
- Learn skills
- Projects
- Availability
- Interests

## Join Requests ✅ DONE
Users click "I'd Like To Help" → Owner reviews → Accept / Decline / Message

## Availability Status ✅ DONE
```
Available / Busy / Learning / Looking For Team / Mentoring
```
Visible everywhere — profile, cards, search results.

## Collaboration Recommendations ✅ DONE
Dashboard shows:
- Projects You May Like
- Creators You Match
- Communities You Fit
- Skills To Learn
- Projects Near Completion

---

# PHASE 4 — Reputation

No followers. No likes. Everything earned.

## Reputation Categories
```
Collaboration
Teaching
Learning
Reliability
Community
Project Impact
```

## Contribution History Timeline
```
Joined Project
Finished Milestone
Helped Someone
Published Tutorial
Mentored
Received Endorsement
```

## Achievements
```
First Mentor
100 Hours Helped
10 Projects
Reliable Collaborator
Top Teacher
Community Builder
```

---

# PHASE 5 — Skills Become Ecosystems

Each skill gets a full destination page:
```
Overview / Projects / People / Mentors / Learners
Challenges / Resources / Tutorials / Discussions / Trending
```

---

# PHASE 6 — Community Evolution

Current feed becomes purpose-driven. Post types:
```
Project Update / Looking For Help / Feedback Request
Tutorial / Lesson Learned / Showcase / Open Role
Challenge / Question
```

Every post belongs somewhere. No random social posting.

---

# PHASE 7 — Opportunity Layer

Browse by need instead of people:
```
Need Designer / Need Musician / Need Tester
Need Translator / Need Photographer / Need Mentor
```

---

# PHASE 8 — Dashboard

Everything actionable:
```
Continue Project / Open Invitations / Applications
Messages / Project Progress / Suggested Collaborators
Skill Suggestions / Challenges / Today's Opportunities
Weekly Reputation
```

---

# PHASE 9 — Knowledge Layer

Projects generate knowledge:
```
Documentation / Resources / Files / Guides
Lessons Learned / FAQ / Tutorials
```

---

# Completed Phases

- [x] Phase 1 — Community Foundation (Steps 1.1–1.6)
- [x] Phase 2 — Living Projects (Steps 2.1–2.7)
- [ ] Phase 3 — Collaboration Engine
- [ ] Phase 4 — Reputation
- [ ] Phase 5 — Skills Ecosystems
- [ ] Phase 6 — Community Evolution
- [ ] Phase 7 — Opportunity Layer
- [ ] Phase 8 — Dashboard
- [ ] Phase 9 — Knowledge Layer
