# UI/UX Design Audit & Remediation Plan

> Created: 2026-07-25  
> Last audit: 2026-08-07  
> Status: COMPLETE  

---

## 2026-08-07 — Phase 3: Dashboard Overhaul (Phase 8 roadmap)

### 11. Dashboard Redesign
- [x] **11.1:** Compact welcome bar with availability + reputation inline
- [x] **11.2:** "Today" focus grid — 4 prominent action cards (continue project, pending invites, find collaborators, today's opportunities)
- [x] **11.3:** Quick-start row for Explore, Community, Sessions, Start a project
- [x] **11.4:** 2-column layout: Your Work (projects, applications, challenges, connections) + Discover (suggested projects, creators, skills, weekly rep)
- [x] **11.5:** Full-width activity timeline + NextSteps for incomplete profiles

---

## 2026-08-07 Phase 2 — Micro-font Remediation & Tooltips (COMPLETE)

### 8. Micro-font upgrades
- [x] **8.1:** All `text-[8px]` instances upgraded (sessions-calendar agenda weekday). Participant avatars in 20px circles intentionally kept at 8px.
- [x] **8.2:** All `text-[9px]` instances upgraded → `text-[10px]` (sessions-calendar status badge, notification-dropdown badge, sessions-calendar "+N more", schedule-session-wizard fallback).
- [x] **8.3:** 115+ `text-[10px]` instances upgraded → `text-[11px]` across ~35 component and route files.

### 9. Truncation tooltips
- [x] **9.1:** `title` attributes added to truncated elements in: suggested-projects, community-card, post-card, profile-sections, sessions-calendar, project-shelf-cover, dashboard, explore, global-search, skills.$slug, connections-card, library-search-bar, item-card, profile-communities-tab, notification-card, challenge-card, suggested-creators.

### 10. Calendar redesign
- [x] **10.1:** Week view: hour labels text-[10px]→text-[11px], cell height 2.5rem→3.5rem
- [x] **10.2:** Month view: cell height 6rem→7rem, padding p-1→p-1.5
- [x] **10.3:** Agenda view weekday text-[8px]→text-[10px]

### Remaining intentionally small text (correct for context)
- 3× `text-[8px]` in 20px participant avatar circles (today-schedule, upcoming-sessions)
- 1× `text-[9px]` avatar fallback (schedule-session-wizard)
- 6× `text-[10px]` in tiny UI elements (calendar today indicator, "+N more", agenda weekday badge, empty state placeholder, notification count badge, event status badge)

---

## 2026-08-07 Audit — Project Shelf & Readability (COMPLETE)

### 6. Project Shelf Card Legibility
- [x] **Fix 6.1:** Minimum card width increased from 140px → 240px (+71%). Intermediate widths: 240px → 320px.
- [x] **Fix 6.2:** Minimum card height increased from 180px → 280px.
- [x] **Fix 6.3:** Spine view redesigned from unreadable vertical text to horizontal card layout.
- [x] **Fix 6.4:** Shelf container: minHeight 320px→400px, maxHeight 480px→580px.
- [x] **Fix 6.5:** Spine progress bar uses category-accent colours.

### 7. Broader Audit Findings
- [x] **7.1:** 115+ `text-[10px]` instances upgraded to `text-[11px]`
- [x] **7.2:** 136+ truncate/line-clamp instances — title attributes added to key elements
- [x] **7.3:** Calendar `text-[8px]`/`text-[9px]` upgraded
- [x] **7.4:** Notification badge `text-[9px]`→`text-[10px]`
- [ ] **7.5:** Hardcoded colour class migration (low priority — design tokens mostly adopted)

---

## Remediation Checklist (2026-07-25)

### 1. Typography & Legibility Enhancements
- [x] **Fix 1.1:** Micro-font sizes upgraded
- [x] **Fix 1.2:** Low contrast text fixed

### 2. Design System & Color Standardization
- [x] **Fix 2.1:** Hardcoded Tailwind colour fallbacks consolidated

### 3. Mobile Touch Targets & Interaction
- [x] **Fix 3.1:** Touch target padding increased

### 4. Interactive Sidebar & Empty State Upgrades
- [x] **Fix 4.1:** Sidebar empty states upgraded

### 5. Sticky Workspace Headers & Micro-Animations
- [x] **Fix 5.1:** Sticky backdrop-blur headers added
- [x] **Fix 5.2:** Hover lift animations added

---

*All critical items completed. One low-priority item remains (7.5) — hardcoded colour migration.*
