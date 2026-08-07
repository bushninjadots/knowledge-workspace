# UI/UX Design Audit & Remediation Plan

> Created: 2026-07-25  
> Last audit: 2026-08-07  
> Status: ACTIVE (Phase 2 micro-font + tooltip remediation complete)  

---

## 2026-08-07 Phase 2 — Micro-font Remediation & Tooltips (COMPLETE)

### 8. Micro-font upgrades
- [x] **8.1:** All `text-[8px]` instances upgraded (sessions-calendar agenda weekday, today-schedule/upcoming-sessions participant avatars kept at 8px for 20px circles).
- [x] **8.2:** All `text-[9px]` instances upgraded → `text-[10px]` (sessions-calendar status badge, notification-dropdown badge, sessions-calendar "+N more").
- [x] **8.3:** 115+ `text-[10px]` instances upgraded → `text-[11px]` across ~35 component and route files, covering: session cards, badges, section headers, sidebar nav, timestamps, composer labels, project cards, profile labels, skill tags, route pages.

### 9. Truncation tooltips
- [x] **9.1:** Added `title` attributes to key truncated elements: suggested-projects (titles + descriptions), community-card (space names + descriptions), post-card (author names), profile-sections (project titles + goals), sessions-calendar (session titles), project-shelf-cover (spine titles).

### 10. Remaining open items
- [ ] **10.1:** ~20 remaining `text-[10px]` instances in face-view badges (project-shelf-cover, project-shelf-overlay) — these are on image overlays where smaller text is by design.
- [ ] **10.2:** Additional title attributes could be added to remaining truncated elements (explore route, skills pages, dashboard).
- [ ] **10.3:** Calendar redesign for better space utilization (sessions-calendar.tsx week/month views still use compact layouts).

---

## 2026-08-07 Audit — Project Shelf & Readability (COMPLETE)

### 6. Project Shelf Card Legibility
- [x] **Fix 6.1:** Minimum card width increased from 140px → 240px (+71%). Intermediate widths: 240px → 320px. Cards at distance 2 now render at ~293px (was ~207px).
- [x] **Fix 6.2:** Minimum card height increased from 180px → 280px to accommodate readable spine content.
- [x] **Fix 6.3:** Spine view redesigned from unreadable vertical text (`writing-mode: vertical-rl`) to a horizontal card layout showing: category icon, title, author, tags (up to 3), progress bar with percentage, and status label.
- [x] **Fix 6.4:** Shelf container dimensions increased: minHeight 320px → 400px, maxHeight 480px → 580px.
- [x] **Fix 6.5:** Spine progress bar now uses category-accent colours for better visual cueing.

### 7. Broader Audit Findings (Open)
- [ ] **7.1:** 114+ instances of `text-[10px]` across the codebase — many in badges, labels, and calendar components. Consider a systematic upgrade to `text-[11px]` or `text-xs` for readability.
- [ ] **7.2:** 136+ instances of `truncate`/`line-clamp-1` — information is frequently cut off. Consider expand-on-hover tooltips or wider card layouts where possible.
- [ ] **7.3:** Calendar components (`sessions-calendar.tsx`) use `text-[9px]` and `text-[8px]` — below minimum readable size.
- [ ] **7.4:** Notification badge uses `text-[9px]` (`notification-dropdown.tsx`).
- [ ] **7.5:** Several components still use hardcoded colour classes need design-token migration.

---

## Remediation Checklist (2026-07-25)

### 1. Typography & Legibility Enhancements
- [x] **Fix 1.1:** Upgrade micro-font sizes (`text-[10px]`) in `challenge-card.tsx`, `right-sidebar.tsx`, `post-card.tsx`, `composer-bar.tsx`, and `mobile-bottom-nav.tsx` to `text-xs` (12px) for improved legibility.
- [x] **Fix 1.2:** Enhance low contrast text classes (`text-muted-foreground/60`) on dark card surfaces to ensure full WCAG AA contrast compliance.

### 2. Design System & Color Standardization
- [x] **Fix 2.1:** Consolidate hardcoded Tailwind color fallbacks (`text-purple-400`, `text-blue-400`, `text-emerald-400`) to standardized design system tokens (`text-primary`, `text-secondary`, `text-brand-green`, `text-brand-purple`).

### 3. Mobile Touch Targets & Interaction
- [x] **Fix 3.1:** Increase button and filter chip touch target padding across mobile views (`min-h-[36px]` minimum for tap targets).

### 4. Interactive Sidebar & Empty State Upgrades
- [x] **Fix 4.1:** Upgrade passive sidebar empty states in `right-sidebar.tsx` ("No data yet") into interactive micro-cards with call-to-action buttons.

### 5. Sticky Workspace Headers & Micro-Animations
- [x] **Fix 5.1:** Add sticky backdrop-blur positioning (`sticky top-0 z-20 bg-background/85 backdrop-blur-md`) to community feed filter bars.
- [x] **Fix 5.2:** Add subtle tactile hover lift animations (`hover:-translate-y-0.5 hover:shadow-xl transition-all`) to challenge and post cards.

---

*All items successfully remediated and verified.*
