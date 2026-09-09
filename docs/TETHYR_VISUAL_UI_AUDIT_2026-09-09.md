# Tethyr Visual & UI Audit (2026-09-09) — Full-Site Re-Audit

> **Scope:** visual, layout, UI consistency, and interaction UX only — no functional/security
> findings. This is the full-site re-audit that supersedes the 2026-09-07 visual audit of the
> same scope. Every F01–F28 finding from that audit was re-checked against current source.
> Read alongside [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) and [`AGENTS.md`](../AGENTS.md).
> It identifies what **needs to be addressed**, evaluated against the current source — it is
> not a substitute for the canonical references.

## Verdict

**The 09-07 structural defects are resolved; the remaining gaps are inheritance + a few fresh introductions.**

The second pass is meaningfully healthier than the first. Badge semantics (F10), `transition-all`
(F24), the dead project-page renderer paths (F15), the two tab languages (F09), the four
hand-rolled modals (F08), and the second design system in `tethyr-main/g/` (F02) are all gone.
Dense rows landed for Connections and Challenges (F13), the Card primitive now has real adoption
(F06: 1 → 16 files), the shared `Skeleton` (F21) and `EmptyState` (F22) are now the norm, and the
explore filter loss below `lg` (F19) was fixed with a proper Drawer.

But three systemic problems are now the story: **(1)** decorative gradients/blur have crept back
onto the pages every new visitor sees first (auth orbs, hero blob); **(2)** the motion and
elevation policies are documented but _unenforced_ — 220 bare `transition`s, 75 non-lifted
shadows, raw `duration-200/300+`; and **(3)** the two flagship screens (dashboard, explore) still
answer "what needs me today" with more vertical stacked content than decision, and the profile
management page still refuses to let identity or evidence win. Plus one genuinely broken visual
bug: solid-token badges render same-color text on same-color fills (13+ sites, verified).

| Metric        | Count |
| ------------- | ----- |
| Findings      | 22    |
| Critical      | 1     |
| High          | 9     |
| Worth keeping | 10    |

## Contents

- [01 · Status of the 09-07 findings](#01--status-of-the-09-07-findings)
- [02 · New findings by category](#02--new-findings-by-category)
- [03 · Screen-by-screen](#03--screen-by-screen)
- [04 · What to do, in order](#04--what-to-do-in-order)
- [05 · What to keep](#05--what-to-keep)

---

## 01 · Status of the 09-07 findings

### Resolved

- **F02** — `tethyr-main/g/` legacy scaffold deleted (`5cc4c89`); the second design system is gone.
- **F03** — no-op glow/gradient/shadow tokens and utilities removed (`5cc4c89`).
- **F04** — `components.json` — no slate/gray classes remain anywhere in `src`; radius drift source eliminated (components are hand-owned, not generated).
- **F08** — the four hand-rolled modals (`project-join-modal`, `project-shelf-overlay`, `starter-picker`, `inline-inspector`) now sit on Radix `Dialog` (`c8a57a6`); project shelf is a Dialog variant with scroll properly locked.
- **F09** — `ui/tabs` retired; notifications uses the shared `SegmentedControl`. `0` imports of `ui/tabs` remain.
- **F10** — `warning` badge split onto the `caution` token; destructive is now reserved for real errors.
- **F13** — Connections and Challenges have proper dense row/table views (tabular-nums dates, `divide-y` rows); cards remain available. Not a literal `<table>`, but the comparable-list problem is addressed.
- **F15** — `projects.$id.tsx` is now one data-driven workspace; legacy header/pulse/sections are removed (~990 lines, section order driven by `presentation.sectionOrder`). The block renderer lives on the Studio routes instead; the project page is coherent.
- **F19** — explore filters lost below `lg` are fixed: sidebar content moved into a `Drawer` triggered by a "Discover" button, with search + category chips staying in flow at all sizes.
- **F21** — shared `Skeleton` now in ~30 files; `animate-gentle-pulse` is the loading norm.
- **F22** — `EmptyState` now used across 37+ files; list surfaces have real zero-states.
- **F24** — `transition-all` is gone (0 matches); the motion policy utilities (`transition-lift`/`-spatial`/`-fade`) exist and are used.
- **F26** — guaranteed `on-media-scrim` added to gallery-block, project-shelf, project-shelf-overlay, project-shelf-thumbnails.

### Partially addressed

- **F06** — Card primitive adoption grew 1 → 16 files, but **48 hand-rolled `rounded-xl border card-border bg-surface` divs remain** (spaces.reports, library.$id, sessions.$id, skills.$slug, projects-resources, post-card, etc.). The migration is half-done; the two patterns still coexist.
- **F07** — sidebar ↔ mobile-nav labels now match, and a test enforces it. **But there is still no shared nav manifest** (two independent arrays), and the icon already drifted (sidebar `User` vs mobile `UserRound` for "Your Studio"). Sidebar still has no collapse/rail.
- **F12** — dashboard gained a real priority zone (`Your next move` + welcome banner + weekly prompt above the grid) — the strongest hierarchy signal in the product. **But the 8-module grid below is still uniform-weight tiles**, and the stacked priority sections can push the grid entirely below the fold on 1080p.
- **F14** — public and private Studios now share one rendering model (blocks). **But `_authenticated/profile.tsx` (profile management) still stacks five equal-weight `card` sections with a 5× - repeated `grid gap-4 sm:grid-cols-2` field grid** — identity, bio, skills, links, projects all at identical weight.
- **F17** — the old 4-button intent picker is gone (relocated to dashboard onboarding). **But the explore Opportunities tab now stacks five control layers** (search+sort, "Needs now," "Browse by need," applied-filter tags, category chips) before any results.
- **F20** — Teams roster was rebuilt (`team-page.tsx`) with per-role sections and a real hierarchy. **But the Shipped-work grid never densifies past 2 columns** (`grid gap-3 sm:grid-cols-2`, no `lg:` step).
- **F16** — nine oversized routes remain (explore 1198, profile 1004, projects.$id 990, dashboard 925, spaces.settings 923, challenges.$id 779, skills.$slug 726, sessions.$id 650, library.$id 569). No splitting happened at route level.

### Unchanged / WAI

- **F18, F23, F27, F01, F05** — landing progressive loading, reduced-motion handling (global zeroing + `useReducedMotion` + marquee static fallback), 362+ aria attributes, the token system, and the global focus ring all remain strengths.

---

## 02 · New findings by category

### 02a · Gradients & decoration (the "generic SaaS" drift)

> The constitution bans "huge gradients or decorative glows" and "glassmorphism/blur as default."
> Three decorative floaters have slipped back onto the surfaces every new user meets first. All
> three fail the Aesthetic Decision Test.

**G01 — [Critical] Solid-token badges render same-color text on same-color fills — invisible labels**

- Verified: `badge.tsx:13` (`outline` = `bg-transparent text-muted-foreground`) then `cn(
badgeVariants, className)` — user `className` wins. `challenges.$id.tsx:230` `bg-ai text-ai`,
  `:235` `bg-teaching text-teaching`, `:240` `bg-trust text-trust`, `:247/:263` teaching,
  `:628/:630`; also `challenge-card.tsx:34-35`, `project-discussions.tsx:24,90`,
  `project-shelf-overlay.tsx:20`.
- **Impact:** difficulty, challenge type, pass/review and announcement labels are token-colored
  text on the identical token-colored pill — low-to-zero contrast in both themes. This is on the
  challenge showcase surface. The correct tinted form (`bg-<token>/10 text-<token>`) sits a few
  lines away (`:256`, `:436`, `:692`), so the file is visibly inconsistent with itself.
- **Fix:** add one `TintedBadge` variant (`bg-<token>/10 border-<token>/30 text-<token>`), replace
  the 13 solid sites. Needs a browser contrast check afterwards.

**G02 — [High] Animated gradient orbs behind the auth shell**

- `auth-shell.tsx:59-73` — three `blur-3xl` radial-gradient orbs (green + purple) at
  opacity 10–20%, drifting on an inline-defined `orb-drift` keyframe (`:95-101`).
- **Impact:** this is the first visual any new user sees when signing up — the constitution's
  explicit "generic AI-generated app" warning embodied. Also an inline `<style>` tag in a
  component, which belongs in `styles.css`.
- **Fix:** remove the orbs; keep the `bg-grid` texture + `bg-noise`, which already give the shell
  character without decoration.

**G03 — [High] Decorative gradient blobs on the landing hero and CTA**

- `routes/index.tsx:141-145` — 900×600 `blur-[120px]` radial orb (green→purple) at opacity-40
  behind the hero; `:244-250` — a second dual-gradient overlay behind the final CTA.
- **Impact:** the landing page is Tethyr's showcase. The hero is strong typographically
  (`text-5xl→8xl`, `font-display`) and doesn't need the glow; the blob reads as template SaaS
  polish and directly contradicts "hierarchy before decoration."
- **Fix:** remove both; the `bg-grid` texture already provides depth.

**G04 — [Low] Decorative gradient dividers on skills page**

- `skills.$slug.tsx:181` (`bg-gradient-to-r from-primary/20 via-border to-brand-purple/20`) and
  `:703` (`from-primary/20 to-transparent`).
- **Impact:** minor, but the guardrail is explicit and the tokens exist to make these unnecessary.

### 02b · Motion & elevation policy — documented but unenforced

> `styles.css:18` states "color/opacity transitions only, 120–180ms" and "shadows are
> dialog-only." The utility layer (120ms `transition-lift/spatial/fade`) exists. The feature
> layer has drifted back out of it.

**G05 — [High] 220 bare `transition`s bypass the motion policy**

- Grep: `transition(\s|$)` → 220 matches across ~40 files: `teams.tsx:210,226`, `explore.tsx:
697,827,993`, `connections.tsx:277,320`, `challenges.tsx:83`, `skills.$slug.tsx:157,340,353,
372,398`, `settings-page.tsx:318-340`, `workspace-grid.tsx:496-801`, `project-resources.tsx:
93,170,390`, `project-files-explorer.tsx:138,463`, `navbar.tsx:75`, `mobile-primary-nav.tsx:45`,
  `dashboard.tsx:222,712-814,879`.
- **Impact:** bare `transition` = "transition every property" at Tailwind's 150ms — including
  `transform` where `group-hover:translate-x-0.5` is combined. Hover feel is looser than the rest
  of the product, and layout-ish properties animate unintentionally.
- **Fix:** lint-replace bare `transition` with `transition-colors`/`transition-lift` (mechanical,
  ~40 files).

**G06 — [High] Conflicting transition utilities and raw durations on one element**

- 14 `transition-shadow` sites (`item-card.tsx:133`, `collection-card.tsx:27`,
  `library-search-bar.tsx:104`, `notification-card.tsx:164`, `community-card.tsx:69`,
  `challenge-card.tsx:64`, `project-shelf-cover.tsx:39`, `messages.tsx:354`, `templates.tsx:145`,
  `composer-bar.tsx:541`, `community-header.tsx:182`, `sessions-layout.tsx:106`,
  `sessions-calendar.tsx:82,94`) plus raw `duration-200/300` in 9 files.
- **Impact:** two `transition-property` utilities on one class list can't both author the list
  (one silently loses), and raw durations override the 120ms base — exactly the unpredictability
  F24 was supposed to kill.
- **Fix:** pair one motion utility with `duration-<120|180>` at most, or codify
  `transition-shadow duration-200` as one utility.

**G07 — [High] Shadow policy drift: 75 non-lifted shadows**

- Grep `shadow-(sm|md|lg|xl|2xl|\[)` → 75 instances: `spaces.settings` cards, `library.$id`,
  `sessions.$id`, post-cards, `messages.tsx:354` (a `[0_0_12px_-3px_var(--user-accent)]` fantasy
  step shadow), scroll-to-top (`shadow-sm`), segmented toggles (`shadow-sm` active states).
- **Impact:** `--shadow-lifted` is supposed to be the only elevation token, for dialogs. Cards
  that rely on shadow instead of border start to float; the "neutral by default" principle erodes.
- **Fix:** audit each shadow: either swap to `panel`/`card` borders or fold into a documented
  token. Keep at most one subtle elevation per surface.

### 02c · The shell: one inaccessible mobile overlay + a nav manifest that still doesn't exist

**G08 — [High] Authenticated mobile overlay has no Escape, no focus trap, no dialog semantics**

- `authenticated-shell.tsx:57-73` — the mobile sidebar overlay is a `fixed inset-0 z-50` custom
  div: backdrop click-to-close + close button, but no `role="dialog"`, no `aria-modal`, no Escape
  handler, no focus management. The transition classes present (`duration-200`) are non-functional
  — no transform start state, so the panel pops in/out instead of sliding.
- **Impact:** this is the primary authenticated mobile navigation gateway. Keyboard users who open
  it can't Escape-close and tab past the backdrop into unseen content (WCAG 2.4.3). The marketing
  navbar's equivalent handles Escape correctly (`navbar.tsx:20-27`), so the shell is the odd one
  out — and 15 lines further down `:121-127` the scroll-to-top button uses `hover:scale-105`,
  another motion-policy violation.
- **Fix:** either port to the existing `Drawer` primitive (used on explore/community/library) or
  add Escape + focus trap + `role="dialog"`/`aria-modal` and a real slide transform.

**G09 — [High] No shared navigation manifest; icon drift already visible**

- `dashboard-sidebar.tsx:33-66` (12-item `groups` array) vs `mobile-primary-nav.tsx:6-11`
  (4-item `ITEMS` array) are independent. Labels are aligned (test-enforced), but the icon for
  "Your Studio" already differs (sidebar `User` vs mobile `UserRound`). The other 8 sidebar
  destinations have no mobile-surface test.
- **Impact:** every future nav addition has to be edited twice; drift (icon or eventually label)
  is one careless edit away. Also: "Connections" exists only in the sidebar — on mobile it's two
  taps deep inside the overlay's Network group.
- **Fix:** one manifest (label, icon, href, badge, mobileVisible) consumed by both renderers.
  Then decide whether Connections earns the mobile surface.

**G10 — [Medium] Sidebar has no collapse/rail mode**

- `dashboard-sidebar.tsx:88` — always-`w-60` on desktop, no rail. On the widest-content screens
  (studio canvas, project workspace) the chrome permanently eats 240px.
- **Impact:** the 09-07 recommendation (rail for studio/project routes) still isn't in. Not a
  bug, but it's the single most visible "chrome vs. content" trade the shell loses.

**G11 — [Medium] Legal pages are navigation dead-ends**

- `privacy.tsx` / `terms.tsx` — bare `mx-auto max-w-3xl px-4 py-16` with no navbar, footer, logo,
  or outbound link. Both are linked from the signup footer and site footer.
- **Impact:** a visitor arriving from search/social has no way out except the back button — a
  dead-end public page.

**G12 — [Medium] Mobile stack order on auth: five OAuth buttons push the form below the fold**

- `oauth-buttons.tsx:21-27` + `login.tsx:158` / `signup.tsx:141` — Google/GitHub/Apple/GitLab/
  Discord render as five full-width stacked buttons before the email separator. Signup additionally
  has name/handle/email/password/craft fields beneath.
- **Impact:** first-time mobile signup = scroll through five near-identical buttons to reach the
  primary form. Five same-style buttons also dilute which action is "the" action.
- **Fix:** 2-column grid under `sm`, or a collapsed "More sign-in options" disclosure.

### 02d · The two focus screens still don't decide

**G13 — [High] Dashboard: priority zone stacks ~550px above the grid; grid modules stay uniform**

- `dashboard.tsx` — above the grid: welcome banner + "Your next move" + (conditional) return
  shelf + weekly prompt + (conditional) next-steps, then `:909` the 8-module grid where every
  module uses the identical `SectionCard` (`rounded-xl bg-surface-elevated/30 p-5`). On 1080p the
  grid can start below the fold.
- **Impact:** the "Your next move" module is genuinely good hierarchy. But the modules it links to
  still compete equally, and re-entry into work is pushed ever further down the page. The
  dashboard would rather close its grid early and reveal one primary panel than preview everything.
- **Fix:** keep the priority zone but tighten it (weekly prompt + next-steps can fold into one
  band); give the primary module (active project) a 2-col, larger-type treatment; demote the rest
  to a compact rows list.

**G14 — [High] Explore Opportunities: five control layers before results**

- `explore.tsx:627-928` — search+sort toggle, "Needs now" urgent-asks, "Browse by need" chip row,
  applied-filter tags, category chip row, _then_ role listings.
- **Impact:** the intent-picker removal was correct, but the tab it relocated to over-compensated.
  Discovery should start with content; every control here asks for a decision before offering one.
- **Fix:** fold "Browse by need" into the search selector; collapse applied filters into one row;
  show results immediately under the urgent-asks band.

**G15 — [Medium] Dashboard renders a blank page when the profile row is missing**

- `dashboard.tsx:77` — `if (!data) return null`. Explore has proper `EmptyState`s; the dashboard
  just vanishes.
- **Impact:** a logged-in user with a missing/broken profile row sees a white screen with no
  explanation or recovery path.

**G16 — [Medium] Loading skeletons don't match the layouts they stand in for**

- `dashboard.tsx:62-75` — skeleton is a flat banner + 4 rows + 6 cards, but the real page is
  conditional bands + priority zone + grid. `library.$id`, `sessions.$id`, `challenges.$id`,
  `spaces.*` gate on full-page `Loader2 animate-spin` instead (visible spinner flash, then a jump
  into place).
- **Impact:** layout-shift on load and a spinner where a calmer skeleton is the house pattern.
- **Fix:** co-locate skeletons with surfaces (dashboard priority zone + modules), swap spin gates
  to `Skeleton`.

### 02e · Consistency debt (inherited, not new)

**G17 — [Medium] 48 hand-rolled cards still parallel the Card primitive (F06 residue)**

- `spaces.$slug.reports.tsx:385`, `library.$id.tsx:367,372,395,409`, `sessions.$id.tsx:315,491,579`,
  `connections.tsx:320`, `explore.tsx:993`, `skills.$slug.tsx:398/502/576/666`, communities-section,
  schedule-session-wizard, post-card, project-resources.
- **Impact:** the two card authorship styles still coexist; radius/hover/token drift continues
  wherever a hand-rolled copy is edited instead of the primitive.

**G18 — [Medium] Three "selected" dialects**

- Shared `SegmentedControl` (notifications, project page) vs. pill toggles with `shadow-sm` active
  states (connections, explore sort, community-header) vs. hand-rolled `bg-surface-elevated` pills
  (`library.tsx` view toggle, `library.$id.tsx:340-362` Docs/Code/Preview, `templates.tsx:72-103`
  with _two different_ active styles).
- **Impact:** the product speaks three "this is selected" languages. Pick one active treatment.

**G19 — [Medium] Hand-rolled inputs/selects bypass the primitives**

- `library.$id.tsx:450-457` (project `<select>`), `github-link-dialog` (raw `<select>`),
  `composer-poll.tsx` (raw input), `challenges.$id.tsx:484-497,703-709` (raw inputs with custom
  `focus:ring-1`).
- **Impact:** inconsistent focus-ring coverage, sizing, and error affordance vs. `ui/input`/
  `ui/select`. Small mechanical swaps.

**G20 — [Medium] Legacy `brand-green`/`brand-purple` names in ~40 fresh sites**

- `library.$id.tsx:281,328,330,402,415`, `messages.tsx:154,235`, `space-chat-message.tsx`,
  `composer-poll.tsx`, `availability-settings`, `project-role-applications.tsx:192,332`, post-card,
  library `TYPE_COLORS`. They're aliases for trust/ai (`styles.css:97-98`) "kept so existing
  markup keeps compiling."
- **Impact:** naming-consistency debt only — but every new site that reaches for the legacy name
  extends F02's two-color-languages confusion.

**G21 — [Medium] Custom focus/aria gaps on interactive rows**

- `messages.tsx:354` — `focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0),0_0_12px_-3px_var(--user-accent)]`
  reinvents the ring and leaks a 12px accent shadow; `file-upload-zone` remove-pending button,
  `challenges.$id.tsx:402-417` progress-step buttons have no accessible name; `text-[var(--user-accent-foreground,white)]`
  in 3+ places should fall back to `var(--background)` — white-on-light custom accent fails contrast.
- **Impact:** inconsistent keyboard feedback and low-contrast accent-on-white in edge cases.

### 02f · Small stuff

- **G22 — [Medium] Unreachable/dead code blocks the project page maintains:** `ProjectPulse`
  ships a full season/brief/lineage editor with `save()` but is always `editing={false}` with a
  no-op `onEditingChange` (`projects.$id.tsx:571`) — it can never activate; `project-main-content.tsx`
  survives by type-import only (~400 lines, `projects.$id.tsx:47`). Delete or wire them.
- **G23 — [Low] On-media treatment inconsistent:** the guaranteed `on-media-scrim` is everywhere
  except `project-resources.tsx:506`, which captions with `bg-background/80` — the page where
  visual work matters most inherits the weakest overlay.
- **G24 — [Low] Buttons: `size="lg"` is 36px and the mobile hamburger is 32px** — below the 44px
  touch-target recommendation on the most important CTAs (`button.tsx:29`, `navbar.tsx:96-104`).
- **G25 — [Low] `discover-skills.tsx:10` loads with a raw `Loading trending skills...` text line**
  while every other landing section uses a skeleton; `reset-password.tsx:66-70` enforces a
  1500ms artificial wait with no matching spinner; `footer.tsx:17-20` shows an unconditional
  pulsing "Active community" dot.
- **G26 — [Low] `team-page.tsx:118` Shipped grid maxes at 2 columns; `header-block.tsx:123`
  avatar ring uses `border-surface` not the canonical user-accent ring; `connection-card`/
  `today-row` headers sometimes `font-display text-lg` where siblings are `text-sm font-semibold`
  (`connections-card.tsx:48`).**
- **G27 — [Low] `collection-dialog.tsx` hardcodes 10 OKLCH values + a `scale-110` swatch that
  belong in tokens.**

---

## 03 · Screen-by-screen

> Line counts as of this audit; bold = over 500 (six route files).

| Route                                    | Lines              | Layout shape                                                         | Flags                                                                         |
| ---------------------------------------- | ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/`                                      | 296                | Hero (gradient blob), lazy sections                                  | G03 gradients; **strength**: progressive loading                              |
| `/login` · `/signup` · `/reset-password` | 237/257/194        | AuthShell + TethyrBall                                               | G02 gradient orbs; G12 5 OAuth buttons; duplicated raw error markup           |
| `/privacy` · `/terms`                    | 85/84              | Bare prose                                                           | G11 navigation dead-ends                                                      |
| `/projects/$id`                          | **990**            | Workspace: header → README → work → people → conversation → evidence | G01 solid-token badges in discussions; G22 dead pulse-editor / main-content   |
| `/u/$handle`                             | 249                | Block-based public Studio                                            | **strength**: shared rendering with private Studio; avatar ring misses accent |
| `/skills/$slug`                          | **726**            | Workshop page, SegmentedControl tabs                                 | G04 gradient dividers; skeletons                                              |
| `/teams/$slug`                           | 83                 | Thin route → team-page                                               | **strength**: per-role hierarchy; G26 2-col grid cap                          |
| `/dashboard`                             | **925**            | Welcome + priority zone + 8-module WorkspaceGrid                     | G13 stacked-then-uniform; G15 blank page; G16 skeleton mismatch               |
| `/explore`                               | **1198**           | Search + discover drawer + 3 tabs                                    | G14 five control layers; G18 sort-toggle dialect; filter drawer fixed         |
| `/community`                             | 195                | Sidebar + feed + mobile bottom nav                                   | – (EmptyState present)                                                        |
| `/spaces/$slug/settings`                 | **923**            | max-w-2xl form sections                                              | G07 shadows; G16 spin gate                                                    |
| `/spaces/$slug/reports`                  | 458                | max-w-3xl list                                                       | G17 hand-rolled cards                                                         |
| `/connections`                           | 454                | Dense rows                                                           | **strength**: table-like rows landed; G18 toggle dialect                      |
| `/messages`                              | 386                | Seating-chart workspace                                              | **strength**: flagship-crafted; G21 custom focus ring                         |
| `/notifications`                         | 103                | SegmentedControl tabs                                                | **strength**: resolved F09                                                    |
| `/profile`                               | **1004**           | Banner + five equal `card` sections                                  | F14 persists (G) — no hero/evidence/metadata order                            |
| `/studio`                                | 73                 | Thin route → CreationStudio                                          | sidebar rail still missing                                                    |
| `/teams`                                 | 242                | Rows                                                                 | G05 bare transitions                                                          |
| `/library` + `/$id`                      | 341/569            | Grid/list → detail (skeleton)                                        | G16 spin gate; G17 hand-rolled cards; G18 view toggle dialect                 |
| `/sessions` + `/$id`                     | 58/650             | Layout → detail                                                      | G16/17                                                                        |
| `/challenges` + `/$id`                   | 431/779            | Rows → roadmap detail                                                | **G01 solid-token badges**; G16 spin gate; G18 chips                          |
| `/templates` + `/$id`                    | 204/323            | Grid → detail                                                        | only route pair using shared Skeleton properly (strength)                     |
| `/settings`                              | 15 → settings-page | Thin route → form sections                                           | G18; G05                                                                      |

---

## 04 · What to do, in order

### P0 · Fix what is wrong or unreadable

1. **Replace the 13 solid-token badges** with a tinted variant (`bg-<token>/10 border-<token>/30
text-<token>`) — the only true _broken_ visual in the build (G01).
2. **Remove the auth orbs and the hero/CTA gradient blobs** — the first-impression surfaces that
   contradict the constitution (G02, G03, G04).
3. **Make the authenticated mobile overlay keyboard-usable** — Escape, focus trap, dialog
   semantics, real slide motion; the Drawer primitive is right there (G08).
4. **Give the dashboard a real zero-state** instead of a blank page (G15).

### P1 · Enforce the two already-written policies

5. **Motion:** lint-replace bare `transition` (220×) with `transition-colors`/`transition-lift`;
   resolve the conflicting-utilities sites; cap raw `duration-*` at 120–180ms (G05, G06).
6. **Elevation:** audit the 75 non-lifted shadows; borders should carry structure, shadow is
   dialog-only (G07).
7. **Cards/inputs:** finish the Card codemod (48 sites) and swap hand-rolled inputs/selects to
   `ui/input`/`ui/select` (G17, G19).
8. **One nav manifest** for sidebar + mobile nav, and a decision on how Connections surfaces on
   mobile (G09).
9. **One nav chrome on legal pages:** wrap privacy/terms in the shared page frame (G11).

### P2 · Decide what each screen is for

10. **Dashboard:** tighten the priority zone and let one module win (2-col, larger type); demote
    the rest to rows (G13).
11. **Explore Opportunities:** one control row that includes search scope, results immediately,
    filters collapsed (G14).
12. **Profile management (`_authenticated/profile`):** apply the hero → evidence → metadata order
    the constitution specifies (F14 residue / G).
13. **Split the six >500-line routes** into thin data routes + section components as you touch
    them — explore, dashboard, profile first.
14. **Delete or wire the dead project-page branches** (pulse editor, `project-main-content`) (G22).

---

## 05 · What to keep

- **The token system** — dual-theme OKLCH, semantic status palette, `--user-accent` identity
  wiring at real scale. Protect it; everything else hangs off it.
- **Landing progressive loading** — hero + lazy `Suspense` sections is the pattern the app routes
  still haven't fully copied (G16).
- **The dashboard priority zone** — "Your next move" is the strongest hierarchy signal in the app;
  the grid should take its cue from it.
- **The project page as one data-driven workspace** — the flagship is coherent again; don't reintroduce renderer forks.
- **The ProjectShelf carousel and the Messages seating-chart workspace** — bespoke, crafted,
  on-brand. Studio-quality baselines, not templates.
- **Reduced-motion handling** — global zeroing + `useReducedMotion` + static marquee fallback.
- **The a11y floor** — skip link, global focus-visible ring, 362+ aria attributes, named form
  errors. Hold the line.

---

_Audit of `tethyr` (Base44) — full-site visual, layout, and UI/UX consistency re-audit.
Supersedes `TETHYR_VISUAL_UI_AUDIT_2026-09-07.md` for the same scope._
_22 findings · 1 critical · 9 high · 8 medium · 4 low · 10 strengths · 23 route groups._
