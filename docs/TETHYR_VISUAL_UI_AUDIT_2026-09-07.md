# Tethyr Visual & UI Audit (2026-09-07)

> Dated audit of visual, layout, and UI consistency only — no functional/security
> findings. Read alongside [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) (the binding
> workflow) and [`AGENTS.md`](../AGENTS.md) (the binding constitution). This is an
> audit findings record: it identifies what **needs to be addressed**, evaluated
> against the current source, not a substitute for the canonical references.

## Verdict

**The foundations are stronger than the surfaces built on them.**

Tethyr has a genuinely good token system — dual-theme OKLCH, semantic colours, and
almost no palette drift. The problems are one layer up: primitives exist but the
feature layer routes around them, and almost every screen defaults to an even grid of
equal-weight cards instead of deciding what the user came for.

| Metric        | Count |
| ------------- | ----- |
| Findings      | 28    |
| Critical      | 5     |
| High          | 9     |
| Worth keeping | 4     |

## Contents

1. [Foundations & tokens](#01-foundations--tokens)
2. [Component consistency](#02-component-consistency)
3. [Hierarchy & layout](#03-hierarchy--layout)
4. [Density & progressive disclosure](#04-density--progressive-disclosure)
5. [Responsive behaviour](#05-responsive-behaviour)
6. [Loading, empty & error states](#06-loading-empty--error-states)
7. [Motion](#07-motion)
8. [Contrast & accessibility](#08-contrast--accessibility)
9. [Screen-by-screen](#09-screen-by-screen)
10. [What to do, in order](#10-what-to-do-in-order)

---

## 01 · Foundations & tokens

The healthiest layer in the codebase. The token system is coherent, dual-theme, and
genuinely used — the problems are dead weight around it, not the system itself.

### F01 · Token system is real and actually consumed — *Strength*

- `src/styles.css:29` — Tailwind v4 CSS-first `@theme inline`, no JS config in the live app
- `src/styles.css:116-277` — light `:root` and `.dark` palettes fully parallel, OKLCH
- Semantic tokens beyond neutrals: `trust` / `learning` / `teaching` / `ai` / `warning` /
  `caution`, each with `-foreground` and `-subtle`
- Zero raw Tailwind palette classes (`slate-500`, `blue-600`, `gray-900`) found across
  `src/**/*.tsx`

**Impact.** Theming, dark mode, and future rebrands are a one-file change. Most codebases
this size have visible drift here; this one does not.

**Recommendation.** Nothing to fix. Protect it — the remaining findings in this section are
about what surrounds it.

### F02 · A second, contradicting design system ships in the repo — *High*

- `tethyr-main/g/` contains a legacy v3 `tailwind.config.js` + `index.css`
- Different fonts (Geist), different naming (`brand-green`, `brand-purple`), and active
  glow shadows — all things `styles.css` deliberately turned off

**Impact.** Anyone (human or AI) grepping for "the theme" can land in `g/` and build a
screen in the wrong visual language. This is the single most likely source of future
inconsistency.

**Recommendation.** Delete `g/`, or move it to a clearly-dated `/archive` with a README
stating it is not the design system.

### F03 · Dead tokens advertise effects the design refuses — *Medium*

- `--shadow-glow-*`, `--shadow-card`, `--shadow-soft` all resolve to `none`; only
  `--shadow-lifted` is real
- Utilities `glow-green` / `glow-purple` / `inner-glow` are defined with `box-shadow: none`
- `text-gradient-brand` / `bg-gradient-brand` neutralised to non-gradients

**Impact.** The flat, structural aesthetic is a good and deliberate call. But leaving named
glow and gradient hooks in place invites someone to "turn them back on" and break it.

**Recommendation.** Remove the no-op glow/gradient/shadow tokens and utilities entirely.
Keep `--shadow-lifted` for dialogs and document that shadows are dialog-only.

### F04 · shadcn config points somewhere the app never goes — *Medium*

- `components.json` — style `new-york`, baseColor `slate`, `cssVariables true`
- No slate/gray classes exist in `src`, so `baseColor` is inert; the tight radius scale in
  `styles.css` also overrides shadcn defaults

**Impact.** Every newly-generated shadcn component arrives with slate defaults and shadcn
radii, and has to be hand-corrected. That is how radius drift (F05) got in.

**Recommendation.** Align `components.json` to the real token names so `shadcn add` output
lands on-system on the first pass.

### F05 · Heading scale is hardcoded in a base layer, not a type scale — *Medium*

- `src/styles.css:279-337` — `h1` 22px/600, `h2` 17px/600, `h3` 15px/600 set in `@layer base`

**Impact.** Dense and appropriate for an app, but it means marketing and app surfaces share
one cramped scale, and a hero cannot be big without opting out of semantics.

**Recommendation.** Expose the scale as tokens (`text-display`, `text-title`,
`text-section`) so the landing page can breathe without fighting `@layer base`.

---

## 02 · Component consistency

The primitives exist. The feature layer mostly ignores them. This is where the product
visibly loses coherence.

### F06 · The Card primitive is imported by exactly one file — *Critical*

- `src/components/ui/card.tsx` exists; only `community/challenge-card.tsx:22` imports it
- ~54+ hand-rolled `rounded-xl border card-border bg-surface` divs stand in for it —
  `community-card.tsx:68`, `collection-card.tsx:25`, `item-card.tsx:68/132`,
  `project-repos.tsx:45`, `session-history.tsx:17`, `today-schedule.tsx:35`,
  `overview-cards.tsx:45`, `team-page.tsx:123`
- Radius drift: hand-rolled cards use `rounded-xl` while Card uses `rounded-md` and the
  token scale caps at 8px
- Hover drift: some use `hover:-translate-y-0.5`, some `hover:shadow-md`, most nothing

**Impact.** Cards are the most repeated object in the product, so this is the inconsistency
users feel first: corners, borders, and hover behaviour change as they move between
Explore, Library, and Sessions.

**Recommendation.** Rebuild `ui/card` on top of the existing `panel` utility, codemod the 54
call sites to it, then add a lint rule banning `rounded-xl border` in
`components/tethyr/**`.

### F07 · Four navigation implementations, no shared source of truth — *High*

- `navbar.tsx` — marketing header with its own hamburger + slide-down panel
- `dashboard-sidebar.tsx` — fixed w-60, desktop only, no collapse or rail mode
- `mobile-primary-nav.tsx` — separate 5-col bottom bar with its own icons and labels
- `authenticated-shell.tsx:57,65-121` — a fourth `fixed inset-0` mobile drawer for
  search/notifications

**Impact.** The same destination can carry a different label and icon depending on viewport,
and the sidebar cannot get out of the way on the widest-content screens (studio, project
workspace).

**Recommendation.** One nav manifest (label, icon, href, badge) consumed by all three
renderers. Add a collapsed rail state to the sidebar for studio and project routes.

### F08 · Two modal systems with different behaviour — *High*

- Radix Dialog used in 21 files
- Hand-rolled `fixed inset-0 z-50` modals with manual `role`/`aria-modal`:
  `project-join-modal.tsx:51-55`, `project-shelf-overlay.tsx:124-138`,
  `studio/starter-picker.tsx:31-34`, `studio/inline-inspector.tsx:114`

**Impact.** Focus trapping, Escape, scroll lock, and enter/exit motion differ between the
two, so some dialogs are keyboard-hostile and none of them animate alike.

**Recommendation.** Port the four hand-rolled modals onto Dialog. Where the overlay is
genuinely a full-bleed canvas (`project-shelf`), build it once as a Dialog variant.

### F09 · Two tab languages for one interaction — *Medium*

- `notifications.tsx:7,89-95` is the only route using shadcn `Tabs`
- Everywhere else uses the custom `SegmentedControl` — `explore.tsx:648`,
  `skills.$slug.tsx:185`

**Impact.** Users learn one tab affordance, then meet a different one on a single screen.

**Recommendation.** Pick `SegmentedControl` (it is the majority and fits the flat aesthetic),
convert notifications, and delete `ui/tabs`.

### F10 · Two badge semantics render identically — *Medium*

- `ui/badge.tsx:19-20` — `destructive` and `warning` variants carry the same classes

**Impact.** "Needs attention" and "something is wrong" become indistinguishable at a glance.

**Recommendation.** Give `warning` the `caution` token and reserve the red for destructive
only.

### F11 · 284 raw buttons versus the Button primitive — *Medium*

- 284 `<button>` matches across ~70 files; `Button` is largely reserved for primary CTAs
- `Button` already covers 8 variants and 4 sizes including `icon` (`ui/button.tsx:8-38`)

**Impact.** Most are small icon actions and most do carry aria-labels, but they bypass
Button's focus ring and active state, so keyboard users get inconsistent feedback on
secondary actions.

**Recommendation.** Sweep icon-only actions onto `<Button variant="ghost" size="icon">`.
Leave genuinely bespoke canvas controls (studio) alone and document them as an exception.

---

## 03 · Hierarchy & layout

The recurring failure: equal-weight card grids used as a default layout, so no screen tells
the user what matters. **No screen in the app has decided what wins.**

### F12 · The dashboard is a filing cabinet, not a workspace — *Critical*

- `dashboard.tsx:64-67` — loading skeleton is 6 identical h-44 tiles in a 1/2/3-col grid
- `WorkspaceGrid` renders `DASHBOARD_MODULES` at uniform weight inside `max-w-7xl` (line 594)
- 921 lines in one route file

**Impact.** A builder opening Tethyr has one question — *what needs me today*. Six same-size
tiles answer it no faster than a nav menu would.

**Recommendation.** Promote one module to a 2-column, larger-type primary panel (active
project or today's commitments). Demote the rest to a compact single-column list of rows,
not tiles.

### F13 · Not a single table exists in the app — *High*

- `<table` returns 0 matches across all of `src/routes`
- Challenges (`challenges.tsx:204/261/277/299`), templates, connections
  (`connections.tsx:125/139`), and library all use `grid sm:grid-cols-2 lg:grid-cols-3` cards

**Impact.** Card grids are for browsing a handful of visually-distinct things. These are
filterable, comparable lists with 4+ attributes each, so users cannot scan or compare — they
have to read every card.

**Recommendation.** Add a dense row/table view as the default for Connections, Library, and
Challenges, with the card grid kept as an optional gallery toggle. Right-align and
tabularise the numerics using the existing `numeric` utility.

### F14 · Profile stacks five different content types at identical weight — *High*

- `profile.tsx:548, 609, 623, 638, 827` — the same `grid gap-4 sm:grid-cols-2` block repeated
  for info, skills, availability, and more
- 1005 lines, with upload and mutation logic inline

**Impact.** A profile is a pitch. Rendering identity, skills, and availability as five
interchangeable blocks means nothing about the person leads.

**Recommendation.** Establish one hero band (identity + what they are looking for), one wide
evidence band (projects/contributions), then a quiet metadata rail. Extract each band into
`components/profile/*`.

### F15 · Dead visual paths still live inside the project workspace — *High*

- `projects.$id.tsx:541` — "Legacy header — hidden when blocks render the page"
- `projects.$id.tsx:599` — "Legacy pulse", `:620` — "Legacy sections remain available only
  as the data-backed fallback"
- 1048 lines total, old and new renderers coexisting

**Impact.** The most important public page in the product has two designs in one file, and
which one a visitor sees depends on data state. That is untestable visually.

**Recommendation.** Commit to the block renderer, backfill the fallback data, and delete the
legacy header/pulse/sections in the same change.

### F16 · Nine route files over 500 lines — *Medium*

- explore **1227** · projects.$id **1048** · profile **1005** · spaces.$slug.settings **924**
  · dashboard **921** · challenges.$id **780** · skills.$slug **727** · sessions.$id **651**
  · library.$id **570**

**Impact.** Not a visual bug in itself, but it is why the inconsistencies above persist: no
one can see a whole screen at once, so each section gets styled locally.

**Recommendation.** Split each into a thin route (data + layout) plus section components.
Explore, profile, and dashboard first — they carry the most repeated markup.

---

## 04 · Density & progressive disclosure

Explore is the clearest case of shipping the feature list instead of designing the screen.

### F17 · Explore competes with itself above the fold — *Critical*

- `explore.tsx:574-667` — a 4-button intent picker, a segmented control, and a create button
  all render before any results
- `explore.tsx:1071` — a persistent w-64 filter aside on top of that
- 1227 lines

**Impact.** Three separate control clusters ask the user to make three decisions before they
see anything to react to. Discovery should start with content.

**Recommendation.** Fold the intent picker into the search field as a scope selector, show
results immediately with a sensible default scope, and let filters be a collapsible panel
that remembers its state.

### F18 · Landing page is the only surface using progressive loading well — *Strength*

- `routes/index.tsx` — 317 lines: hero + stats, then lazy sections behind `Suspense` with
  `SectionSkeleton`

**Impact.** Fast first paint and a clear reading order. This is the pattern the app routes
should copy.

**Recommendation.** Reuse the `SectionSkeleton` + lazy-section approach on dashboard and
explore.

---

## 05 · Responsive behaviour

Most screens adapt. Two do not, and one of them silently removes functionality instead of
relocating it.

### F19 · Filters disappear entirely below `lg` — *Critical*

- `explore.tsx:1071` — `<aside className="hidden w-64 shrink-0 lg:block">`

**Impact.** Tablet and phone users lose all filtering on the discovery screen. This is a
functional gap dressed as a responsive rule.

**Recommendation.** Move filters into a Drawer triggered by a Filters button below `lg`,
with an active-filter count on the trigger.

### F20 · Teams is a mobile stack served to desktop — *High*

- `teams.tsx` — zero `md:`/`lg:` classes in the entire file
- `teams.tsx:128-171` — single-column `<ul className="space-y-2">` inside `max-w-5xl`
  (line 63)

**Impact.** Crews carry name, members, and activity — multi-attribute data rendered as one
narrow column, wasting the width it already reserved.

**Recommendation.** Rebuild as a row layout with columns for members and last activity,
aligning with the table view proposed in F13.

---

## 06 · Loading, empty & error states

A shared `Skeleton` exists and two routes use it. Everything else improvises.

### F21 · Five different loading treatments across the app — *High*

- Only `templates.tsx:9,107-110` and `templates.$id.tsx:10,44-49` use the shared `Skeleton`
- `challenges.$id`, `sessions.$id`, `library.$id`, `skills.$slug`, `teams.$slug`,
  `u.$handle` use ad-hoc `isLoading` branches or spinners
- 55+ `animate-pulse` hits use the Tailwind default, not the custom `animate-gentle-pulse`
  token
- `dashboard.tsx:64-67` skeleton (6 equal h-44 tiles) does not match the modules it stands
  in for

**Impact.** Perceived speed and stability vary route to route, and a skeleton that lies
about the layout causes a visible jump on load.

**Recommendation.** Co-locate a `Skeleton` with each surface component so the two cannot
drift, standardise on `animate-gentle-pulse`, and delete per-route pulse divs.

### F22 · Empty states are inconsistently reached for — *Medium*

- An `EmptyState` component exists in `components/tethyr`
- `community.tsx:53` only mentions empty states in a comment; dashboard, profile, and the
  Explore people tab do not use it at route level

**Impact.** A network product is empty for every new user. Those first screens are the
onboarding, and right now some of them are blank regions.

**Recommendation.** Audit each list surface for a zero-state with one clear action, and
require `EmptyState` wherever a collection can be length 0.

---

## 07 · Motion

A written motion policy exists in `styles.css` and the code partly ignores it.
Reduced-motion handling, though, is better than most codebases.

### F23 · Reduced motion is genuinely respected — *Strength*

- `styles.css:797-809` — global `prefers-reduced-motion` zeroes animation and transition
  durations
- framer-motion usages in `project-shelf/*` and `section-reveal.tsx` call `useReducedMotion`
- No `scale(0)` entrances anywhere

**Impact.** Motion-sensitive users get a usable product without a separate code path.

**Recommendation.** Nothing. Keep the global override in place as the safety net.

### F24 · `transition-all` and long durations violate the stated policy — *High*

- `styles.css:18` documents "restrained motion: 120-180ms colour/opacity transitions only"
  and ships `transition-lift` / `-spatial` / `-fade` at 120ms
- `transition-all` in 9-11 files: `composer-bar.tsx:583`, `drag-drop-file-input.tsx:71/140`,
  `project-timeline.tsx:81/105`, `collection-dialog.tsx:161`
- `duration-500` / `duration-700` in 6 places, untied to any token

**Impact.** `transition-all` animates properties you did not choose, including layout ones,
so hovers feel soft and can jank. Half-second transitions on frequent interactions read as
lag.

**Recommendation.** Ban `transition-all` in lint. Name properties explicitly and hold each
element under 300ms: press 100-160ms, popovers 125-200ms, dropdowns 150-250ms, modals
200-300ms.

### F25 · Two animation systems with no rule for choosing — *Medium*

- framer-motion confined to `landing/data.tsx`, `project-shelf/*`, `section-reveal.tsx`
- Everything else uses Tailwind transitions and `animate-*` utilities

**Impact.** Comparable interactions get different curves and timings depending on which file
they were built in.

**Recommendation.** Write the rule down: CSS transitions for state change, framer-motion
only for orchestration, gesture, and layout. Enforce in review.

---

## 08 · Contrast & accessibility

Accessibility is a strength — 362 aria attributes and real keyboard handling. The gap is
text placed over content the app does not control.

### F26 · White text over user-supplied images with no guaranteed scrim — *Critical*

- `blocks/profile/gallery-block.tsx:97`
- `project-shelf-overlay.tsx:208-210`, `project-shelf-thumbnails.tsx:66`,
  `project-shelf.tsx:543`
- All rely on the image or an overlay being dark enough

**Impact.** Upload a light image and the title becomes unreadable. On the project shelf and
gallery — the product's showcase surfaces — that is a visible failure users will hit
immediately.

**Recommendation.** One `on-media` wrapper that always applies a scrim behind the text band
and uses a tokenised `on-media` foreground, rather than bare `text-white`.

### F27 · ARIA and keyboard coverage are above average — *Strength*

- 362 `aria-*` occurrences; `aria-current`, `aria-expanded`, `aria-pressed`, `aria-hidden`
  all used correctly
- `navbar.tsx` handles Escape and wires `aria-expanded`/`aria-controls`
- `focus-visible` rings baked into Button and inputs; `styles.css:279-337` defines a global
  focus ring

**Impact.** Keyboard and screen-reader users can operate most of the product today.

**Recommendation.** Hold the line: spot-check the unverified raw buttons in
`studio/g-studio-surface.tsx` and `workspace-grid.tsx` for labels.

### F28 · Avatars are all decorative — *Medium*

- Avatar `<img>` tags consistently use `alt=""` with an initials fallback

**Impact.** Defensible for repeated list avatars, but on a profile header the avatar is the
subject of the page and should be named.

**Recommendation.** Pass the person's name as `alt` on profile and project-owner avatars;
keep `alt=""` for list and stack avatars where the name is adjacent.

---

## 09 · Screen-by-screen

Every route, its layout shape, and what is flagged on it. Rendered as a table on purpose —
this is exactly the comparable, multi-attribute content the app currently forces into card
grids.

| Route                          | Area   | Lines | Layout shape                       | Flags                                     |
| ------------------------------ | ------ | ----- | ---------------------------------- | ----------------------------------------- |
| `/`                            | Public | 317   | Hero + stats grid, lazy sections   | Best-in-app loading pattern               |
| `/login` · `/signup` · `/reset-password` | Auth | 84 | Centered max-w-md card via `AuthShell` | –                                    |
| `/privacy` · `/terms`          | Public | 86    | Static legal prose                  | –                                         |
| `/projects/$id`                | Public | 1048  | Block renderer + legacy header/pulse/sections | Oversized · Dead visual paths |
| `/skills/$slug`                | Public | 727   | Workshop page, `SegmentedControl` tabs | Oversized · Ad-hoc loading              |
| `/teams/$slug`                 | Public | 84    | Team profile                        | Ad-hoc loading                             |
| `/u/$handle`                   | Public | 240   | Studio profile                      | Ad-hoc loading                             |
| `/dashboard`                   | App    | 921   | Banner + uniform `WorkspaceGrid` modules | Oversized · No hierarchy · Skeleton mismatch |
| `/explore`                     | App    | 1227  | Intent picker + tabs + card grids + filter aside | Oversized · Overloaded fold · Filters lost below `lg` |
| `/community`                   | App    | 196   | Sidebar + feed + mobile bottom nav  | No `EmptyState`                           |
| `/community/spaces/$slug/settings` | Nested | 924 | max-w-3xl single-column form     | Oversized                                  |
| `/community/spaces/$slug/reports` | Nested | 459 | max-w-3xl list                    | –                                         |
| `/connections`                 | App    | 334   | Equal-weight card grid              | Should be a row/table view                |
| `/messages`                    | App    | 387   | List + thread                       | –                                         |
| `/notifications`               | App    | 107   | shadcn `Tabs`                       | Only route using `ui/tabs`                |
| `/profile`                     | App    | 1005  | Banner + five identical 2-col blocks | Oversized · No hierarchy                |
| `/settings`                    | App    | 444   | Thin route → `settings-page.tsx`    | –                                         |
| `/studio`                      | App    | 74    | Thin route → `CreationStudio`       | Sidebar cannot collapse                   |
| `/teams`                       | App    | 241   | Single-column `ul` in max-w-5xl     | Zero breakpoints · Mobile stack on desktop |
| `/library` · `/library/$id`    | App    | 570   | Card grid → single-column detail    | Oversized detail · Should be a row/table view |
| `/sessions` · `/sessions/$id`  | App    | 651   | Layout → detail document            | Oversized detail                          |
| `/challenges` · `/challenges/$id` | App | 780 | Repeated 3-col card grids → detail | Oversized detail · Should be a row/table view |
| `/templates` · `/templates/$id` | App   | 324   | Card grid → detail                  | Only route using shared `Skeleton`        |

Line counts in **red** exceed 500 — nine route files do.

---

## 10 · What to do, in order

Three passes. The first is not a design exercise — it fixes screens that are currently wrong
or unusable at some viewport. Only the third one changes how the product looks on purpose.

### P0 · Fix what is broken, not just inconsistent

Restore filters below `lg` as a drawer. Give Teams a real desktop layout. Put a guaranteed
scrim behind every on-media label. Split the destructive and warning badge appearances.
Delete the legacy header, pulse, and sections from the project workspace so only one design
can render.

- **F19** — Filters disappear below `lg`
- **F20** — Teams is a mobile stack served to desktop
- **F26** — White text over user images with no scrim
- **F10** — Destructive/warning badges identical
- **F15** — Dead visual paths in project workspace

### P1 · Collapse the duplicate systems

Rebuild `ui/card` on the `panel` utility and codemod the ~54 hand-rolled cards to it. Drive
all navigation renderers from one manifest and add a sidebar rail. Port the four hand-rolled
modals onto Dialog. Choose `SegmentedControl` and drop `ui/tabs`. Co-locate skeletons with
the surfaces they stand in for. Delete the `g/` scaffold and the no-op glow and gradient
tokens.

- **F06** — Card primitive unused
- **F07** — Four navigation implementations
- **F08** — Two modal systems
- **F09** — Two tab languages
- **F21** — Five loading treatments
- **F02** — Second design system ships in repo
- **F03** — Dead glow/gradient tokens

### P2 · Decide what each screen is for

Promote one primary module on the dashboard and demote the rest to rows. Add a dense row
view for Connections, Library, and Challenges with cards as an optional gallery. Rebuild the
profile as hero, evidence, then metadata. Start Explore with results instead of three
control clusters. Enforce the motion policy in lint and split the nine oversized routes as
you go.

- **F12** — Dashboard is a filing cabinet
- **F13** — No tables in the app
- **F14** — Profile stacks content at identical weight
- **F17** — Explore competes with itself above the fold
- **F24** — Motion policy violations
- **F16** — Nine route files over 500 lines

---

*Audit of `bushninjdots/tethyr-main` — visual, layout, and UI consistency only.*
*28 findings across 8 categories · 23 route groups.*