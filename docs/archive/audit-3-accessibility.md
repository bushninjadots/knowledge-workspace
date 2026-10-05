# Audit 3 — Accessibility

**Date:** 2026-08-20
**Scope:** WCAG 2.2 AA compliance — ARIA, keyboard navigation, focus management, color contrast, screen reader patterns, form labels, semantic HTML, landmarks, skip links, reduced motion.

---

## Summary

| Severity      | Count  |
| ------------- | ------ |
| P0 — Critical | 5      |
| P1 — Serious  | 5      |
| P2 — Moderate | 6      |
| P3 — Minor    | 3      |
| **Total**     | **19** |

---

## P0 — Critical

### 1. No skip navigation link

**Files:** `src/routes/__root.tsx:125`
**Issue:** The root `<html>` layout has no skip link. Keyboard-only users must Tab through the entire navbar on every page load before reaching main content. On authenticated pages, this means navigating 10+ links (logo, nav items, search, notifications, mobile toggle) on every page visit.
**WCAG:** 2.4.1 Bypass Blocks
**Recommendation:** Add a visually hidden (sr-only) skip link as the first focusable element inside `<body>` that anchors to `<main id="main-content">`.

### 2. Follow button has no toggle state for assistive tech

**Files:** `src/components/tethyr/follow-button.tsx:63`
**Issue:** The follow/unfollow button uses a plain `<Button>` with only a visual label (`isFollowing ? "Following" : "Follow"`). There is no `aria-pressed` attribute, so screen readers announce it as a generic button with no indication of its current toggle state.
**WCAG:** 4.1.2 Name, Role, Value
**Recommendation:** Add `aria-pressed={isFollowing}` to the button element.

### 3. Radix Progress bar has no accessible value

**Files:** `src/components/ui/progress.tsx:13`
**Issue:** The Radix `Progress.Root` is rendered without `aria-label`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, or visible text. Screen readers announce "progress" with no value, label, or context. Used in dashboard profile completeness, dashboard loading, and workspace grid.
**WCAG:** 1.1.1 Non-text Content, 4.1.2 Name, Role, Value
**Recommendation:** Pass `aria-label` or `aria-labelledby` to the Radix Progress component, and ensure visible helper text is always present alongside the bar.

### 4. Multiple unlabeled `<nav>` landmarks

**Files:** `src/components/tethyr/community/left-sidebar.tsx:39`, `src/components/tethyr/dashboard-sidebar.tsx:124` (has label), `src/components/tethyr/navbar.tsx:41` (has label)
**Issue:** The community left sidebar `<nav>` at line 39 has no `aria-label`. When multiple `<nav>` elements exist on a page without unique labels, screen readers cannot distinguish between them, announcing them all as "navigation".
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Add `aria-label="Community sidebar"` (or similar) to every `<nav>` that lacks one. The navbar and dashboard sidebar already have labels — bring all others to parity.

### 5. Create Challenge dialog form inputs missing labels

**Files:** `src/components/tethyr/community/create-challenge-dialog.tsx:129-183`
**Issue:** The challenge title input, description Textarea, and urgency select group all lack programmatic labels. The inputs use `placeholder` text ("Challenge title…", "What's the challenge about?") but no `<label htmlFor>` or `aria-label`. Screen readers announce these as unlabeled fields.
**WCAG:** 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions
**Recommendation:** Add `<Label htmlFor="...">` elements connected to each input, or add `aria-label` attributes.

---

## P1 — Serious

### 6. Dashboard has duplicate `<h1>` headings

**Files:** `src/routes/_authenticated/dashboard.tsx:54` and `:391`
**Issue:** The dashboard renders two `<h1>` elements: one for the greeting ("Good morning, Bender") and one for the featured project title ("OSD-W"). Multiple `<h1>` elements create confusing heading hierarchy for screen reader users navigating by headings.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Demote the second heading to `<h2>` or restructure so only one `<h1>` exists per page.

### 7. Trophy icon uses `aria-label` on non-interactive element

**Files:** `src/components/tethyr/project/project-header.tsx:175`
**Issue:** An inline `<svg>` icon has `aria-label="Featured"` but no `role="img"`. The `aria-label` attribute is only announced on interactive elements or elements with an explicit `role`. Without `role="img"`, screen readers ignore the label entirely.
**WCAG:** 1.1.1 Non-text Content
**Recommendation:** Add `role="img"` to the `<svg>`, or wrap it in a `<span>` with the `aria-label`.

### 8. Signup "Your main craft" label disconnected from buttons

**Files:** `src/routes/signup.tsx:110-128`
**Issue:** The `<Label>Your main craft</Label>` is rendered above a group of toggle buttons, but has no `htmlFor` attribute and is not wrapped in a `<fieldset>`/`<legend>` pattern. Screen readers do not associate the label text with the skill buttons below it.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Wrap the skill buttons in a `<fieldset>` with `<legend>Your main craft</legend>`, or use `aria-labelledby` on the button group pointing to the label's id.

### 9. Multiple `<main>` landmarks on authenticated pages

**Files:** `src/components/tethyr/navbar.tsx:54` and `src/components/tethyr/authenticated-shell.tsx:122`
**Issue:** The public navbar wraps its links in a `<main>` element (line 54), and the authenticated shell also renders a `<main>` element (line 122). When both are mounted, the page has two `<main>` landmarks. Screen readers rely on a single `<main>` to identify primary content.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Remove `<main>` from the navbar component (it should use `<nav>` only). Keep `<main>` exclusively in the shell layout.

### 10. Messages textarea missing label

**Files:** `src/routes/_authenticated/messages.tsx:407-414`
**Issue:** The message composition `<Textarea>` has no associated `<Label>` or `aria-label`. It relies entirely on a placeholder ("Type a message…") which disappears on input and is not announced by screen readers as a label.
**WCAG:** 3.3.2 Labels or Instructions
**Recommendation:** Add `aria-label="Message text"` or a visually hidden `<Label>` connected via `htmlFor`.

---

## P2 — Moderate

### 11. Heading hierarchy skips levels in several pages

**Files:** `src/routes/skills.$slug.tsx:166→333` (h1→h3, skipping h2), `src/routes/_authenticated/explore.tsx:530→1047` (h1→h3)
**Issue:** Several pages skip heading levels (e.g., h1 directly to h3). Screen reader users navigating by heading level expect sequential hierarchy. Skipped levels break the outline and make content harder to scan.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Ensure headings follow a strict h1→h2→h3 sequence without skipping levels.

### 12. Form inputs using placeholder-only labels in settings and messages

**Files:** `src/routes/_authenticated/settings.tsx:136-141`, `src/routes/_authenticated/messages.tsx:407`
**Issue:** Custom URL input in settings and message textarea in messages use placeholder text as their only visible label. Placeholder text disappears on focus/input, is not announced as a label by screen readers, and fails contrast requirements in some browsers.
**WCAG:** 3.3.2 Labels or Instructions
**Recommendation:** Add visible or visually hidden `<Label>` elements with `htmlFor` pointing to each input's `id`.

### 13. Loading state announcements inconsistent

**Files:** `src/components/tethyr/dashboard-state-boundary.tsx:96` (good: `role="status"` + `aria-label`), `src/components/tethyr/notifications/notification-dropdown.tsx:78` (missing), `src/components/tethyr/project/project-workbench.tsx:162` (good: `role="status"`)
**Issue:** Some loading states use `role="status"` with descriptive `aria-label` (dashboard), while others just render "Loading..." text in a plain `<div>` (notification dropdown line 78). Screen readers may not announce the notification loading state.
**WCAG:** 4.1.3 Status Messages
**Recommendation:** Apply `role="status"` consistently to all loading indicators so screen readers announce them as live regions.

### 14. Sessions page uses div-based cards instead of semantic list

**Files:** `src/routes/_authenticated/sessions.tsx:177-186`
**Issue:** The sessions list renders session cards as `<div>` elements inside a container `<div>`. A list of similar items (sessions) should use `<ul>`/`<li>` so screen readers announce the list count ("5 items") and allow navigation by list item.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Wrap session cards in `<ul>` and each card in `<li>`.

### 15. Join Project modal close button has redundant `aria-label`

**Files:** `src/components/tethyr/project/project-join-modal.tsx:65`
**Issue:** The dialog close button has `aria-label="Close"`, but the Dialog component already renders a visually hidden `<span className="sr-only">Close</span>` inside its close button (see `src/components/ui/dialog.tsx:49`). This creates duplicate "Close" announcements for screen readers.
**WCAG:** (Usability — not a strict WCAG failure, but causes redundant announcements)
**Recommendation:** Remove the redundant `aria-label="Close"` from `project-join-modal.tsx`, or remove the `<span>` from the dialog base component.

### 16. Community sidebar `<nav>` missing accessible name

**Files:** `src/components/tethyr/community/left-sidebar.tsx:39`
**Issue:** Same as finding #4, specifically for the community page's left sidebar navigation. Multiple nav elements exist on the community page without distinguishing labels.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Add `aria-label="Community navigation"` to this `<nav>`.

---

## P3 — Minor

### 17. Decorative SVG illustrations in empty state could use `role="img"` with labels

**Files:** `src/components/tethyr/empty-state.tsx:26-28`
**Issue:** The illustration `<svg>` elements have `aria-hidden="true"`, which is correct for purely decorative images. However, the empty state card has no visible heading or descriptive text, so screen reader users hear nothing — they don't know the page has no content.
**WCAG:** 1.1.1 Non-text Content
**Recommendation:** Add a visible heading like "No projects yet" inside the EmptyState component so screen reader users get context. The `aria-hidden` on the SVG is correct.

### 18. Landing page sections rely on heading-only structure for screen readers

**Files:** `src/routes/index.tsx:260` (h2 "Why Tethyr exists"), `src/routes/index.tsx:314` (h2 "How it works")
**Issue:** The landing page sections use `<h2>` headings but the surrounding content sections are plain `<div>` elements without `<section>` or `aria-labelledby`. Screen readers can navigate by heading, but landmark-based navigation won't surface these sections.
**WCAG:** 1.3.1 Info and Relationships
**Recommendation:** Wrap each landing section in `<section aria-labelledby="...">` with matching heading ids for landmark navigation.

### 19. Sonner toast notifications lack explicit ARIA attributes

**Files:** `src/components/ui/sonner.tsx:5-21`
**Issue:** The Sonner `Toaster` component is rendered without explicit `role` or `aria-live` attributes. Sonner internally manages this, but the wrapper adds no explicit accessibility attributes. If Sonner's internal implementation changes, toasts could silently lose screen reader announcement support.
**WCAG:** 4.1.3 Status Messages
**Recommendation:** Verify Sonner's internal ARIA handling. Consider adding `aria-live="polite"` and `role="status"` as a defensive measure on the Toaster wrapper.

---

## Positives

The following accessibility patterns are implemented well:

- **`<html lang="en">`** — Document language is correctly set in `__root.tsx:125`.
- **Reduced motion support** — Framer Motion's `useReducedMotion()` is used in `section-reveal.tsx`, `project-shelf.tsx`, `cover-gradient.tsx`, `project-shelf-overlay.tsx`, and `data.tsx`. Additionally, `styles.css` has `@media (prefers-reduced-motion: reduce)` rules, and `confetti.ts` and `index.tsx` check the preference before animating.
- **SegmentedControl** — Implements proper ARIA tabs pattern with `role="tablist"`, `role="tab"`, `aria-selected`, roving `tabIndex`, and arrow key navigation (`segmented-control.tsx`).
- **Mobile primary nav** — Uses `aria-label="Primary mobile navigation"`, `aria-current="page"`, and proper nav semantics (`mobile-primary-nav.tsx`).
- **Radix UI primitives** — Dialog, DropdownMenu, and Drawer use Radix/Vaul which handle focus trapping, Escape key dismissal, and return focus automatically.
- **Theme toggle** — Uses `aria-label` describing the current state (`theme-toggle.tsx:38`).
- **Search dialog** — Radix Dialog with sr-only title, proper result list with `role="listbox"` and `aria-activedescendant` (`global-search.tsx`).
- **OAuth buttons** — Each button has a descriptive `aria-label="Continue with {provider}"` (`oauth-buttons.tsx:61`).
- **Notification dropdown** — Unread count is visible text inside the bell button (not just a color indicator), so non-sighted and color-blind users both get the information.
- **Escape key handling** — Mobile nav menu closes on Escape (`navbar.tsx:38-40`), global search closes on Escape.
- **`role="status"` usage** — Dashboard loading states and workspace grid undo status use `role="status"` correctly for live region announcements.
- **`sr-only` headings** — Dashboard and project pages use screen-reader-only headings (`sr-only`) to provide landmark context where visual headings would be redundant (`dashboard.tsx:639`, `projects.$id.tsx:568`).
- **Consistent `aria-label` usage** — Back buttons, action buttons, form controls, and navigation landmarks throughout the app use `aria-label` appropriately (100+ instances across the codebase).
