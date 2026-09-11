# Tethyr Studio & Creator UX Improvements (2026-09-10)

> **Scope:** the Studio / creator surface (Studio editor, the creator's Studio View, and the
> public Studio) plus the block-inspector and section/palette tooling that power it. Eighteen
> improvement items were implemented across two passes this day — a first pass of ten
> (sections 01–10) and a second pass of eight (sections 13–20), plus two fixes found while
> verifying the second pass (section 21). Every item is verified: `tsc --noEmit` clean,
> ESLint clean on changed files, the full Vitest suite (74 files, 587 tests) passing, and the
> second pass additionally walked end to end in the browser on a seeded account and a fresh
> signup. Read alongside [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) and
> [`AGENTS.md`](../AGENTS.md). This is a record of completed work, not a standing audit.

## Verdict

**The creator story now leads with work, momentum, and clear next steps — and the creator can act on all of it without leaving the Studio.**

The Studio surface previously read as a generic identity card (LinkedIn header), a static
read-only canvas (Studio View), and a flat equal-weight grid (public Studio). Both passes
carry Tethyr's work-first character: the header leads with what the person is building and
their reputation momentum; the creator's home offers one-click publish, a next-steps rail, a
first-session checklist, device-accurate visitor preview, and hidden-area visibility; the
public page has editorial chapter hierarchy; and the editor tooling communicates through
visuals (layout thumbnails, block glyphs, real field controls) instead of abstract labels.

The second pass closes the loop from "prompted" to "done": the first project can be created
inside the Studio, the starting feel is a first-run moment rather than a buried control,
publishing is deliberate (diff + changelog note), empty blocks teach with real actions, and
the creator's view links back into the exact block to edit. Only the publish-note feature
needed schema (one additive migration); everything else reuses the existing blocks, page, and
completeness systems.

## Contents

**Pass one — identity, hierarchy, and editing tooling**

- [01 · Creator profile header](#01--creator-profile-header)
- [02 · Studio View as the creator's home](#02--studio-view-as-the-creators-home)
- [03 · Customize panel progressive disclosure](#03--customize-panel-progressive-disclosure)
- [04 · Public Studio editorial flow](#04--public-studio-editorial-flow)
- [05 · Creator onboarding checklist](#05--creator-onboarding-checklist)
- [06 · Block inspector richer field types](#06--block-inspector-richer-field-types)
- [07 · Section layout visual previews](#07--section-layout-visual-previews)
- [08 · Seamless "view as visitor"](#08--seamless-view-as-visitor)
- [09 · Empty state simplification](#09--empty-state-simplification)
- [10 · Block palette previews](#10--block-palette-previews)

**Pass two — Studio creation, publishing, and acting on guidance**

- [13 · Create your first project inside the Studio](#13--create-your-first-project-inside-the-studio)
- [14 · First-run "choose a feel"](#14--first-run-choose-a-feel)
- [15 · Publish diff and version notes](#15--publish-diff-and-version-notes)
- [16 · Device parity in the visitor preview](#16--device-parity-in-the-visitor-preview)
- [17 · Deep links into the editor](#17--deep-links-into-the-editor)
- [18 · Autosave confirmation](#18--autosave-confirmation)
- [19 · Hidden areas are visible to the creator](#19--hidden-areas-are-visible-to-the-creator)
- [20 · Actionable empty states](#20--actionable-empty-states)
- [21 · Fixes found while verifying](#21--fixes-found-while-verifying)

**Reference**

- [11 · Files touched](#11--files-touched)
- [12 · Scope notes](#12--scope-notes)

---

## 01 · Creator profile header

The `profile-header` block (`src/components/tethyr/blocks/profile/header-block.tsx`) rendered a
standard horizontal identity card: avatar, name, handle, category chip, location/timezone/
languages chips, and a bare `{score} rep` badge. It communicated "profile," not "maker."

**Changes:**

- **"Currently building" hook.** A `Hammer` link under the name shows the most recently updated
  public project (`projects` with `visibility="public"` and `status` in `planning|active`),
  tinted with the user's accent. The header now leads with the thing being made.
- **Reputation as momentum.** The bare score becomes a tier panel: current tier → next tier with
  a `#trust` progress bar (`getTierProgress` from `@/lib/reputation`), so reputation reads as
  progress rather than a static number.
- **Collaboration signal.** `profiles.availability` renders as a status-dot chip ("Open to
  collaboration" / "Focused on current work" / "Taking a step back").
- **New inspector toggles.** `Show active project` and `Show collaboration status`, both on by
  default. Empty data (no project / no rep / no availability) hides the element entirely.

## 02 · Studio View as the creator's home

`StudioView` (`src/components/tethyr/studio/studio-view.tsx`) was a static render with a thin
toolbar. Two additions make it answer "what should I do next?":

- **`StudioPublishStrip`.** When the Studio is a draft with content, a slim caution strip under
  the top bar offers one-click **Publish now** via the existing `usePublishPage` RPC. On success
  the page status flips to published and the strip disappears.
- **`StudioNextStepsRail`** (2xl+). A sticky aside showing **Setup** and **Showcase** completeness
  bars (accent fill) plus the top undone profile steps (`nextSteps`), each clickable into the
  setup form via the existing `onCompleteProfile()`. Renders nothing once all steps are done.

Both are derived entirely from data already loaded by `useCurrentUser` and `usePage` — no new
queries. The canvas continues to center itself; the rail only claims gutter space at 2xl.

## 03 · Customize panel progressive disclosure

`GCustomizePanel` (`src/components/tethyr/studio/g-studio-surface.tsx`) presented 10+ choice
groups in a single column on first visit.

**Change:** the three "feel" decisions — **Starting point, Structure, Personality** — stay on
top for everyone. Everything else (Density, Corners, Accent, Card borders, Border weight, Card
fill, Background, Content tree, Complete profile) is collapsed under a **More options**
disclosure (`aria-expanded`, rotating chevron) whose open/closed state persists in
localStorage (`studio-customize-advanced-open`, SSR-guarded). Decision space on first sight:
3, not 20+.

## 04 · Public Studio editorial flow

The public Studio rendered sections in a flat equal-weight grid. The default profile layout
(`src/lib/default-layouts.ts`) was already editorial in structure but carried no chapter titles.

**Changes:**

- **Chapter titles in the default layout:** `Featured Work` (projects + direction), `Skills &
Experience`, `Tools & Achievements`. The header, About/Links, and Gallery sections
  deliberately stay untitled because those blocks already self-label — the page never repeats
  itself.
- **Creator view parity.** `StudioViewSection` now renders the chapter header for _any_ titled
  section (with the same `area N` auto-title suppression the public renderer uses), fixing a
  leftover artifact where the creator's view printed the literal layout name (`feature`).

New titles apply to new/default layouts; existing profiles keep their layouts (no silent
migration).

## 05 · Creator onboarding checklist

No guided path existed from signup to a live Studio.

**Change:** `StudioOnboardingChecklist` renders a compact rail above the Studio View canvas with
five content wins — **feel → project → bio → banner → publish** — all derived from already-loaded
data. Done steps show a trust-green check with strikethrough; undone steps carry an arrow
affordance. Dismissable (persisted via `studio-onboarding-dismissed`, SSR-guarded). Hides at
3/5 done, at which point the publish strip and next-steps rail carry the remaining journey.
Actions: feel → `/studio`, project → `/dashboard` (where project creation lives), bio/banner →
setup form, publish → the same `handlePublish()` used by the strip.

## 06 · Block inspector richer field types

`BlockField` (`src/lib/page-blocks.ts`) already supported `image` and `color`, but
`GBlockInspector` routed every non-`toggle`/`select` field to a `<textarea>` — so those types
were effectively unhandled in the side inspector.

**Changes:**

- Added `"range"` to the `BlockField.type` union with optional `min`/`max`/`step`.
- Rewrote `GBlockInspector`'s dispatch to render all seven types properly: toggle → checkbox,
  select → native select, range → slider with mono readout (accent thumb), color → swatch +
  hex, image → URL input with thumbnail preview, textarea, text.
- Added the matching `range` handler to the inline quick-editor (`inline-inspector.tsx`).
- Proved the new types in real use: `content-divider` now exposes **Thickness** (`weight`,
  range 1–6) and **Label color** (`labelColor`, color).

## 07 · Section layout visual previews

The section header selected layouts through a native `<select>` of abstract names ("Sidebar
left" vs "Feature" being trial-and-error).

**Change:** the select is now `SectionLayoutPicker` — a compact button that opens a popover grid
of SVG **wireframes** (`LayoutThumbnail`) showing each column arrangement, highlighting the
active layout and using the user's accent for the feature spine. Same compact footprint in the
crowded header; click-outside closes.

## 08 · Seamless "view as visitor"

The Studio View's preview iframe loaded the full public page — sticky public header included —
so the creator saw two stacked headers.

**Change:** the public route (`src/routes/u.$handle.tsx`) accepts `?embed=1` (Zod search schema;
`optional().default(false)` so existing links stay valid). When set, the sticky public header and
owner notice are suppressed. The preview iframe now loads `/u/<handle>?embed=1`.

## 09 · Empty state simplification

The old empty state ("Your Studio is empty. Open Customize…") was redundant with the onboarding
checklist above it and reserved `min-h-[30vh]` of dead space.

**Change:** one quiet line — "No blocks yet — add them in Customize to build your Studio." — with
modest padding. The checklist carries the guidance.

## 10 · Block palette previews

The Add-to-Studio palette listed abstract names ("Profile Header", "Profile Bio").

**Change:** every palette row now carries a 36×24 SVG wireframe (`BlockGlyph`) of what the block
renders — avatar+name for header, card rows for projects, chips for skills, 2×2 grid for
gallery, a rule for divider, and so on. Unknown/new block types fall back to a category sketch
(project/community → accent header bar; people → avatar + lines) so the palette never looks
broken as the registry grows. Uses the same wireframe vocabulary as `LayoutThumbnail`.

---

# Pass two — Studio creation, publishing, and acting on guidance

## 13 · Create your first project inside the Studio

The onboarding checklist sent new creators to `/dashboard` to add a project — a full context
switch at the exact moment they had momentum, and the top follow-up the pass-one notes
flagged. Creating work is the primary loop; it should not require leaving the creator's home.

**Changes:**

- **Reused the existing `ProjectDialog`** (`src/components/tethyr/profile/project-dialog.tsx`)
  rather than inventing a lightweight form — same three-step Basics → Direction → Share flow,
  same skill catalog and cover upload, same persistence.
- **Two entry points, both in place:** the Studio View checklist's _Add your first project_
  opens the dialog instead of navigating to the dashboard, and the editor's empty **Featured
  Projects** block opens it from the canvas (section 20).
- Saving invalidates `CURRENT_USER_KEY`, so the header's "currently building" hook and the
  creator's completeness rail reflect the new project immediately; the projects block refetches
  on its next mount.

## 14 · First-run "choose a feel"

The starter picker — five wireframe-previewed directions — was reachable only from the
Customize panel's _Starting point_ control or the toolbar, i.e. after the creator had already
met a default canvas.

**Change:** a new Studio (no `starterId`, still a draft) opens the starter picker as its first
screen, so the feel is chosen before the default arrangement is judged. One show per browser —
dismissal (or choosing) persists under `studio-starter-intro-dismissed`, SSR-guarded, and the
_Starting point_ control remains for later visits. Applying a starter stays non-destructive and
one undo away.

## 15 · Publish diff and version notes

Publishing was a blind confirm: the creator saw a generic paragraph and had no record of what
changed or when. Version rollback existed but versions were anonymous numbers.

**Changes:**

- **"What changes" summary** in the publish dialog: first publish, or the areas and blocks
  added/removed since the last published version (counted by block label, capped at four
  lines), with an "arrangement and appearance changes" fallback.
- **Optional publish note** persisted with the version and shown in the version-history
  popover next to each entry, so "Restore v3" means something.
- **Schema (the one migration in either pass):** `page_versions.note` plus a
  `publish_page_version(uuid, text)` **overload**. The original `publish_page_version(uuid)`
  signature is untouched, so the RLS regression assertions that check its grants still pass;
  the two overloads resolve unambiguously because neither declares defaults.

## 16 · Device parity in the visitor preview

The editor had desktop/tablet/mobile preview frames, but the Studio View's "view as visitor"
iframe was desktop-only — the one place a creator checks the phone rendering had no phone.

**Change:** the preview now carries the same desktop/tablet/mobile radio group, capping the
iframe at the editor's frame widths (996px / 390px) with hairline edges at the frame so the
boundary is legible against the page background. An "open your public page" icon link was
added beside it for a real new-tab check.

## 17 · Deep links into the editor

The Studio View and the editor behaved as two modes: "Customize" always opened a fresh canvas
with nothing selected, so acting on something you just spotted cost a second hunt.

**Changes:**

- **`/studio?section=<id>&block=<id>`** (route `validateSearch`, keys optional so every
  existing `navigate({ to: "/studio" })` and link keeps working). The editor selects the target
  block — opening its inspector — and scrolls the area into view once the canvas has rendered.
- **Per-area edit affordance** in the Studio View: each titled area header reveals a pencil on
  hover that deep-links to that area (and its first block).

## 18 · Autosave confirmation

Draft saves are debounced and silent, and the top-bar status pill only ever said _Saving_ or
_Unsaved changes_ — so a clean draft looked identical to a draft that had never been touched.

**Change:** once a save or publish lands and nothing is dirty, the top bar shows a quiet
`saved just now / 12m ago` stamp beside the status pill (reusing `timeAgo`). The pill continues
to carry the authoritative state (`Live · v1`, `Unpublished changes`, `Draft`).

## 19 · Hidden areas are visible to the creator

Areas can be hidden without being deleted, but the creator's own view simply omitted them —
indistinguishable from a deletion.

**Change:** a slim strip under the publish notice reports `N hidden area(s) — not visible to
visitors` with an _Edit in Customize_ action. It renders nothing at zero, so it never adds
chrome to a Studio with nothing hidden.

## 20 · Actionable empty states

The data-driven profile blocks already rendered edit-mode placeholders, but the copy was
static ("Show the work you are building…") and the owner had to work out where the data lived.

**Change:** the three work-first blocks now teach with real actions, using the existing
`BlockEmptyState` action slot and two new `BlockContext` callbacks the canvas supplies:

| Block             | Action                   | Leads to                           |
| ----------------- | ------------------------ | ---------------------------------- |
| Featured Projects | _Add your first project_ | in-Studio project dialog (item 13) |
| About / Bio       | _Write your bio_         | the profile-completion flow        |
| Skills            | _Add your skills_        | the profile-completion flow        |

## 21 · Fixes found while verifying

Browser verification of the second pass surfaced two real defects in the _existing_ "view as
visitor" preview (pass-one item 08), both fixed:

- **The preview iframe could never load.** The response CSP set `frame-ancestors 'none'` and
  `X-Frame-Options: DENY`, so the app blocked _itself_ from being framed and the browser
  showed "localhost refused to connect". Both now allow same-origin framing only
  (`frame-ancestors 'self'` / `SAMEORIGIN`), which leaves third-party embedding blocked and so
  does not weaken clickjacking protection.
- **`?embed=1` triggered a search-normalization redirect** (`307` to `?embed=true`) whose
  intermediate response produced a hydration mismatch inside the framed page. The iframe now
  requests the canonical `?embed=true` form directly, avoiding the redirect hop and hydrating
  cleanly.

---

## 11 · Files touched

| File                                                     | Items          |
| -------------------------------------------------------- | -------------- |
| `src/components/tethyr/blocks/profile/header-block.tsx`  | 01             |
| `src/components/tethyr/studio/studio-view.tsx`           | 02, 05, 09     |
| `src/components/tethyr/studio/g-studio-surface.tsx`      | 03, 06, 07, 10 |
| `src/components/tethyr/studio/inline-inspector.tsx`      | 06             |
| `src/components/tethyr/blocks/content/divider-block.tsx` | 06             |
| `src/lib/default-layouts.ts`                             | 04             |
| `src/lib/page-blocks.ts`                                 | 06             |
| `src/routes/u.$handle.tsx`                               | 08             |

## 12 · Scope notes

- **No migrations or schema changes.** Every improvement is client-side and reuses existing
  tables, RPCs, and hooks (`usePage`, `usePublishPage`, `useCurrentUser`, `nextSteps`).
- **Defaults changed, existing content preserved.** Editorial titles and the checklist apply to
  new/default layouts and the creator's view; pre-existing profiles keep their saved layouts.
- **Design guardrails respected.** No new card containers for spacing, no radius inflation, no
  gratuitous gradients/glow, accent color used as a small accent only. Where a pattern already
  existed (starter-picker wireframes, segmented pills, `t-label`, localStorage SSR guards), it
  was reused rather than duplicated.
- **Potential follow-ups (deliberately out of scope):** analytics signals for the Studio View,
  richer one-click project create without visiting the dashboard, and migrating pre-existing
  layouts to the editorial titles.
