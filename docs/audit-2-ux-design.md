# Audit 2 — UX & Design System Consistency

**Date:** 2026-08-20  
**Scope:** Full codebase — routes, components, UI primitives  
**Criteria:** TETHYR_DESIGN.md, TETHYR_DESIGN_SYSTEM.md, AGENTS.md design constitution, border hierarchy, border radius scale, responsive patterns, typography, visual noise

---

## Summary

| Severity | Count |
|----------|-------|
| P0 (critical) | 0 |
| P1 (significant) | 5 |
| P2 (moderate) | 8 |
| P3 (minor) | 6 |

---

## P1 — Significant Findings

### 1. `rounded-[2.5rem]` CTA section violates border radius scale

**Location:** `src/routes/index.tsx:250`

```html
<div className="... rounded-[2.5rem] border border-border/60 bg-surface ...">
```

The design system defines 4 radius tokens: `rounded-md` → `rounded-lg` → `rounded-xl` → `rounded-full`. A `2.5rem` radius (~40px) exists nowhere in the scale and creates a visual mismatch — the element floats between a card and a pill.

**Fix:** Use `rounded-xl` (consistent with card-level surfaces) or `rounded-2xl` if a softer treatment is needed. If the intent is pill-like, push to `rounded-full`.

---

### 2. `rounded-2xl` on team avatar — inconsistent with avatar radius

**Location:** `src/components/tethyr/team/team-page.tsx:281`

```html
<div className="... rounded-2xl border card-border bg-surface ...">
```

Avatars are `rounded-full` everywhere else (user avatars, team icons in feeds, nav). A 20×20 avatar with `rounded-2xl` reads as a rounded square, which is the wrong shape for a face/icon.

**Fix:** Use `rounded-full` for team avatar, or if the 80×80 size is intentionally square-ish, use `rounded-xl` which matches the card radius scale.

---

### 3. Excessive `shadow-2xl` / `shadow-xl` on overlays and dropdowns

**Locations:**
- `src/components/tethyr/global-search.tsx:559` — `shadow-2xl backdrop-blur-xl`
- `src/components/tethyr/project-shelf/project-shelf-overlay.tsx:142` — `shadow-2xl`
- `src/components/tethyr/project/project-join-modal.tsx:58` — `shadow-2xl`
- `src/components/tethyr/availability-badge.tsx:75` — `shadow-xl`
- `src/components/tethyr/library/library-search-bar.tsx:132` — `shadow-lg`

TETHYR_DESIGN_SYSTEM states: "No shadows on cards." The `shadow-2xl` class produces a large, dramatic shadow that contradicts the "quiet confidence" principle. Dialogs and dropdowns (Radix primitives) legitimately use `shadow-lg` for elevation — that's fine and matches shadcn convention. But custom overlays (search, shelf overlay, join modal) should use `shadow-lg` max.

**Fix:** Replace `shadow-2xl` → `shadow-lg` on custom overlays. Radix Dialog/Dropdown `shadow-lg` is acceptable.

---

### 4. `font-title` used inconsistently — heading font appears in 8 places, `font-display` used everywhere else

**Locations with `font-title`:**
- `src/routes/_authenticated/challenges.tsx:246, 272`
- `src/components/tethyr/empty-state.tsx:300`
- `src/components/tethyr/community/post-card.tsx:445`
- `src/components/tethyr/community/challenges-section.tsx:19`
- `src/components/tethyr/community/community-header.tsx:105`
- `src/components/tethyr/community/space-header.tsx:112`
- `src/components/tethyr/project/project-header.tsx:157`

Every other heading in the app uses `font-display`. `font-title` and `font-display` likely map to the same typeface (Inter), but if they don't, this is a visible inconsistency. Even if they do map to the same font, the inconsistency creates confusion for future contributors.

**Fix:** Replace all `font-title` → `font-display` for a single consistent heading font family.

---

### 5. Inline error components duplicate error page markup — not using shared ErrorComponent

**Locations:**
- `src/routes/_authenticated/community.tsx:48-63`
- `src/routes/_authenticated/messages.tsx:31-56`

Both define their own `errorComponent` with identical markup (h1 "Something went wrong", paragraph, two buttons). This violates DRY and means any error page design change requires updating multiple files. `__root.tsx` already defines a root-level `ErrorComponent`.

**Fix:** Remove inline `errorComponent` definitions from route modules. If specific routes need custom error handling, extract a shared `RouteErrorBoundary` component and import it.

---

## P2 — Moderate Findings

### 6. `backdrop-blur` used on 40+ elements — potential performance + visual noise

**Locations include:** navbar, sticky headers, mobile nav, floating badges, card overlays, search dropdowns, project shelf, hero panels, dialog footers, composer bars.

`backdrop-blur` is GPU-intensive and causes paint artifacts on some mobile browsers. It's also visually heavy — every sticky header, floating badge, and dropdown blurring the content behind it creates a frosted-glass look that contradicts the "quiet confidence" principle.

**Fix:** Audit `backdrop-blur` usage. Reserve for nav/header only (already the convention). Remove from floating badges (`availability-badge`, `project-shelf-cover`), dialog footers (`profile-sections.tsx:1497`), and card overlays. Where backdrop is needed, `backdrop-blur-md` is sufficient — `backdrop-blur-xl` and `backdrop-blur-2xl` are excessive.

---

### 7. Non-semantic inline buttons in error components bypass design system

**Location:** `src/routes/_authenticated/community.tsx:58-63`, `src/routes/_authenticated/messages.tsx:43-51`

Raw `<button>` and `<a>` elements with hand-written Tailwind classes instead of using the `<Button>` component. This means hover states, focus rings, and transitions are inconsistent with the rest of the app.

**Fix:** Use `<Button>` from `@/components/ui/button` for all interactive actions.

---

### 8. `bg-[#24292e]` hardcoded color in GitHub connect button

**Location:** `src/components/tethyr/profile/github-connect.tsx:245`

```html
<div className="... bg-[#24292e] text-white ...">
```

This is a brand color (GitHub's), which is the one acceptable case for hardcoded colors. However, the pattern is fragile — if the hex is ever referenced elsewhere, it should be a token. Document this as an intentional exception or move to a CSS variable.

**P3 — not blocking, but worth noting.**

---

### 9. `shadow-sm` on message input bar

**Location:** `src/routes/_authenticated/messages.tsx:368`

```html
<div className="... shadow-sm ...">
```

TETHYR_DESIGN_SYSTEM says "No shadows on cards." The input bar is not a card but is a surface-level element. `shadow-sm` is subtle enough to be acceptable, but should be consistent — other inputs don't use `shadow-sm`.

**Fix:** Remove `shadow-sm` from the message input bar, or add it to all input-adjacent surfaces consistently.

---

### 10. Mixed responsive breakpoint usage — `sm:` vs `md:` vs `lg:`

The codebase uses breakpoints consistently in most places, but there are inconsistencies:

- `src/routes/_authenticated/challenges.$id.tsx:598` uses `md:grid-cols-2` for a two-column layout, while nearly every other page uses `sm:grid-cols-2` for the same pattern.
- `src/components/tethyr/project/project-tabs.tsx:26` uses `md:top-24` for sticky offset, while other sticky elements use `top-16` or `top-32`.

These are minor but create inconsistent breakpoints across the UI.

**Fix:** Standardize two-column grids to `sm:grid-cols-2`. Review sticky top offsets across components.

---

### 11. `text-gradient-brand` hardcoded gradient on landing CTA

**Location:** `src/routes/index.tsx:261`

```html
<span className="text-gradient-brand">together</span>
```

The `text-gradient-brand` class is a custom utility. If it's defined in the CSS (likely), it should be documented as a brand exception. If it's not defined, it will render as plain text.

**Fix:** Verify `text-gradient-brand` exists in the CSS. If it does, it's fine as a brand accent. If not, remove it.

---

### 12. `shadow-glow-green` used on landing badge dot

**Location:** `src/routes/index.tsx:149`

```html
<span className="... shadow-glow-green" />
```

TETHYR_DESIGN_SYSTEM: "No glows." This is a single tiny accent on the landing hero, so it's a deliberate exception. But it sets a precedent — if someone else adds a glow elsewhere citing this as precedent, it's a problem.

**Fix:** Document as a brand accent exception, or replace with a solid green dot (no glow).

---

### 13. Card component consistently uses `rounded-md border` — but some cards use `rounded-lg border` or `rounded-xl border`

The `<Card>` primitive uses `rounded-md border` (per TETHYR_DESIGN_SYSTEM). But some surfaces that look like cards bypass the primitive and use `rounded-lg border` or `rounded-xl border` directly. This creates visual inconsistency — some "cards" are more rounded than others.

**Fix:** Audit all surfaces that visually present as cards and ensure they either use the `<Card>` component or follow the same radius (`rounded-md`).

---

## P3 — Minor Findings

### 14. `rounded-full` on badges and tags — consistent and correct

The codebase uses `rounded-full` extensively for badges, tags, status pills, and avatars. This matches the design system's border radius scale. No issues.

---

### 15. `font-display` used consistently for all headings — mostly correct

67 uses of `font-display` across routes and components. The 8 `font-title` uses (finding #4) are the only exceptions. Overall heading typography is consistent.

---

### 16. Responsive grids are well-implemented across pages

71 uses of responsive grid patterns (`sm:grid-cols-2`, `lg:grid-cols-3`, etc.). Nearly every page uses a mobile-first grid approach. The two exceptions in finding #10 are minor.

---

### 17. Blanket styling on `<body>` and `html` in root layout

**Location:** `src/routes/__root.tsx` likely applies blanket styles to `html` and `body`. This is a standard TanStack Start pattern, but worth noting that any global styles here affect the entire app.

---

### 18. No `rounded-3xl` found anywhere

The codebase avoids `rounded-3xl`, which is correct — it's not in the design system's scale.

---

### 19. `rounded-full` on primary action buttons is inconsistent

**Location:** `src/routes/_authenticated/explore.tsx:607`

```html
<CreateProjectButton label="Create project" className="rounded-full" />
```

And `src/routes/_authenticated/dashboard.tsx:421`:

```html
<CreateProjectButton size="sm" variant="default" className="rounded-full" />
```

Other `Button` usages use `rounded-md` or `rounded-lg`. The `rounded-full` on `CreateProjectButton` makes it a pill, which is a different button shape than every other button in the app.

**Fix:** Remove `rounded-full` from `CreateProjectButton` or document pill-shaped CTAs as an intentional exception.

---

## Positives

1. **Card primitive is used consistently** — `border card-border bg-surface rounded-md` is the standard across the codebase.
2. **Badge/tag system is well-defined** — `rounded-full` on all pills/badges, consistent with the design system.
3. **Responsive grids are mobile-first** — `sm:grid-cols-2` → `lg:grid-cols-3` → `xl:grid-cols-4` is the standard pattern, used correctly in 70+ places.
4. **No `rounded-3xl` or `rounded-[4rem]` abuse** — the only exception is the landing CTA section.
5. **Typography hierarchy is mostly consistent** — `font-display` is the standard heading font, used in 67 places.
6. **Color tokens are well-used** — `bg-surface`, `bg-surface-elevated`, `bg-background`, `text-foreground`, `text-muted-foreground` are used correctly across pages. The `var(--user-accent)` pattern for personalization is well-implemented.
7. **The `Card` component is properly thin** — it's just a styled div with forwardRef, no extra logic or state. This is the right abstraction level.
8. **Section before container pattern is followed** — most pages use semantic sections (`<section>`) before falling back to card containers.
9. **Whitespace is intentional** — `py-24`, `py-32`, `gap-6`, `gap-8` are used consistently for breathing room.
10. **The `SectionReveal` component is used on the landing page** — progressive disclosure without adding visual noise.

---

## Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P1 | Replace `rounded-[2.5rem]` → `rounded-xl` on landing CTA | 5 min |
| P1 | Replace `rounded-2xl` → `rounded-full` on team avatar | 5 min |
| P1 | Replace `shadow-2xl` → `shadow-lg` on custom overlays (3 places) | 10 min |
| P1 | Replace `font-title` → `font-display` everywhere (8 places) | 15 min |
| P1 | Remove inline `errorComponent` from community and messages routes | 15 min |
| P2 | Audit `backdrop-blur` — remove from non-essential surfaces | 30 min |
| P2 | Replace inline `<button>` with `<Button>` in error components | 10 min |
| P2 | Add `#24292e` as a CSS variable or document as brand exception | 5 min |
| P2 | Remove `shadow-sm` from message input bar | 2 min |
| P2 | Standardize two-column grid breakpoints to `sm:grid-cols-2` | 10 min |
| P3 | Remove `rounded-full` from CreateProjectButton or document | 5 min |
| P3 | Remove `shadow-glow-green` or document as brand exception | 5 min |
