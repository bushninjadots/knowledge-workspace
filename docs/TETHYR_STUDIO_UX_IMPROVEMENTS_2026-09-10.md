# Tethyr Studio & Creator UX Improvements (2026-09-10)

> **Scope:** the Studio / creator surface (Studio editor, the creator's Studio View, and the
> public Studio) plus the block-inspector and section/palette tooling that power it. Ten
> improvement items were proposed and implemented this session. Every item is verified:
> `tsc --noEmit` clean, ESLint clean on changed files, and the full Vitest suite (74 files,
> 582 tests) passing. Read alongside [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) and
> [`AGENTS.md`](../AGENTS.md). This is a record of completed work, not a standing audit.

## Verdict

**The creator story now leads with work, momentum, and clear next steps — without new data or new schema.**

The Studio surface previously read as a generic identity card (LinkedIn header), a static
read-only canvas (Studio View), and a flat equal-weight grid (public Studio). All three now
carry Tethyr's work-first character: the header leads with what the person is building and
their reputation momentum; the creator's home offers one-click publish, a next-steps rail, and
a first-session checklist; the public page has editorial chapter hierarchy; and the editor
tooling communicates through visuals (layout thumbnails, block glyphs, real field controls)
instead of abstract labels. No migrations were required — every change is client-side and
reuses the existing blocks, page, and completeness systems.

## Contents

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
- **Creator view parity.** `StudioViewSection` now renders the chapter header for *any* titled
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

## 11 · Files touched

| File | Items |
| ---- | ----- |
| `src/components/tethyr/blocks/profile/header-block.tsx` | 01 |
| `src/components/tethyr/studio/studio-view.tsx` | 02, 05, 09 |
| `src/components/tethyr/studio/g-studio-surface.tsx` | 03, 06, 07, 10 |
| `src/components/tethyr/studio/inline-inspector.tsx` | 06 |
| `src/components/tethyr/blocks/content/divider-block.tsx` | 06 |
| `src/lib/default-layouts.ts` | 04 |
| `src/lib/page-blocks.ts` | 06 |
| `src/routes/u.$handle.tsx` | 08 |

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