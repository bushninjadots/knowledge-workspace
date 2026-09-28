# Studio Settings Audit — 2026-09-27

**Scope:** the Studio creator surface (`/profile`, the owner view) and the Studio
creator/editor (`/studio`, the customization surface), specifically whether every
setting in them works, looks right, and is logically placed.

**Mode:** design review. Per [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) →
_Design Review Mode_, **no product code was changed.** Everything below is a
finding or a proposal.

**Method:** measurement, not opinion. Two Playwright harnesses read the live DOM
(`getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`) against the
local Base44 stack with a seeded demo account, at eleven viewports from 1920×1080
to 360×640, in both the desktop Customize panel and the phone edit sheet. They
print 31 + 14 pass/fail checks and write their raw numbers to
`qa-artifacts/`.

```bash
node scripts/qa-studio.mjs       # the editor: /studio   (31 checks, 23 fail)
node scripts/qa-studio-view.mjs  # the Studio: /profile  (14 checks,  2 fail)
```

Both harnesses separate the two failure modes that look identical on screen: a
control that cannot be clicked is re-driven through the DOM, and a control that
is not painted at all (inside a closed menu, or a 1×1 `.sr-only` wrapper) is
excluded rather than reported as occluded. A skipped check is reported as skipped,
never as a pass. Accessible names are resolved in HTML-AAM order — `aria-labelledby`,
then `aria-label`, then the native `el.labels` association, then subtree text,
then `title` — because reading only `aria-label`/`textContent` reports every
checkbox wrapped in a `<label>` as unnamed, which is a probe artefact rather than
a defect. That one correction moved finding 12 from 8 offenders to 1.

Raw measurements: [`qa-artifacts/studio-audit.json`](../qa-artifacts/studio-audit.json),
[`qa-artifacts/studio-view-audit.json`](../qa-artifacts/studio-view-audit.json).

**Headline:** the settings themselves are real and, where the harness could reach
them, they work — every control it clicked repainted the canvas. The failures are
almost all in the _container_: the panel hangs up to 75px past the bottom of the
viewport, its content is not scrollable, and the rows in the bottom third of it
are painted underneath its own footer. Behind that, three settings misrepresent themselves
— "Personality" promises a typography change it only half applies (on the editor
and on the Studio), two of the three "Structure" options render identically on
any laptop, and "Theme" and the theme picker both claim to own the same tile.

---

## Findings

| #   | Severity     | Finding                                                                                                                                                                                                                                                  | Where                                                 |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **Critical** | The builder is 48px taller than the viewport at all 11 sizes; the Customize panel is 48–75px past the bottom edge, so its footer is never fully visible                                                                                                  | `g-studio-surface.tsx:459`, `:2657`                   |
| 2   | **Critical** | Panel content cannot be scrolled to: 2121px of content in a 722px box with `overflow: visible`, painted over by the 89px footer. Density, Corners, Accent, Card borders, Border weight, Card fill, Background and the whole Content tree are unreachable | `g-studio-surface.tsx:2668`, `:2980`                  |
| 3   | **Critical** | The version-history popover positions against the page instead of the header, so it covers its own trigger and the Add block / Save draft / Publish controls. No role, no outside-click, no Escape, and it cannot be closed by clicking the trigger      | `g-studio-surface.tsx:877`, `:494-501`                |
| 4   | **High**     | "Personality" half-applies: `t-label` never reads `--studio-label-font`, so under Technical the headings go mono and every micro-label stays Inter — on `/studio` and on `/profile` alike                                                                | `styles.css:577-583` vs `:565-573`                    |
| 5   | **High**     | Two of the three Structure options are indistinguishable below ~1520px: Balanced caps at 1024px and Wide at 1200px, and the canvas is only 944px at 1440×900, so both render at 944px                                                                    | `studio-config.ts:336-340`                            |
| 6   | **High**     | The theme picker shows two selected tiles at once — "Default" and "Tethyr Default" both report `aria-pressed="true"`                                                                                                                                     | `g-studio-surface.tsx:2519-2534`                      |
| 7   | **High**     | The mobile Style tab carries 4 of the 11 desktop setting groups, and has no Reset                                                                                                                                                                        | `g-studio-surface.tsx:3267-3326`                      |
| 8   | **High**     | The phone sheet covers 59% of the viewport and is open by default                                                                                                                                                                                        | `g-studio-surface.tsx:3043+`                          |
| 9   | **Medium**   | "Apply site-wide" — a whole-app change — sits directly under the theme grid with no separation from the Studio-only choice                                                                                                                               | `g-studio-surface.tsx:2538`                           |
| 10  | **Medium**   | 26 of 127 painted controls in the builder are under the 24px target — 7 in the inspector rail (the block's 16×16 `Show …` toggles), 14 in the canvas section band (7 `Rename area` at 16.5px, 7 `Change area layout` at 20px), 5 on the canvas           | `g-studio-surface.tsx:2321`, `:1323`, `:351`          |
| 11  | **Medium**   | The Block inspector "Frame" control is a 3-up segmented control with no group label and no `role="radiogroup"`; its three buttons are named only "Theme", "Border", "None"                                                                               | `g-studio-surface.tsx:1731+`                          |
| 12  | **Low**      | 1 of 127 focusables in the builder has no accessible name: the block image-URL input, whose visible caption is a `<span>` rather than a `<label for>`. It sits at tab stop 111, so it is found late rather than never                                    | `g-studio-surface.tsx:2405`                           |
| 13  | **Medium**   | "Up" / "Down" (60×28, 77×28) sit in the same group as 28×28 icon buttons, and the phone sheet calls the same actions "Move block up" / "Move block down"                                                                                                 | `g-studio-surface.tsx:2443-2472`                      |
| 14  | **Medium**   | "Apply site-wide" and the Studio-only theme choice are both in the Theme group, and the publish CTA is on `/profile` while the editor header calls the destination "Customize"                                                                           | `g-studio-surface.tsx:2696` hint, `:2538`             |
| 15  | **Low**      | Seven different uppercase treatments coexist in one screen, one of them split across two faces                                                                                                                                                           | inventory below                                       |
| 16  | **Low**      | Chrome takes 34% of a 1440px viewport before the canvas starts (239 nav + 256 panel)                                                                                                                                                                     | measured                                              |
| 17  | **Low**      | The editor's "device preview" is only a `max-width`; the Studio's is a bordered, shadowed frame. The two surfaces disagree                                                                                                                               | `g-studio-surface.tsx:545`, `studio-view.tsx:308-315` |
| 18  | **Low**      | Hint typography is inconsistent: Corners uses `text-[0.6875rem]`, every other group uses `text-2xs`                                                                                                                                                      | `g-studio-surface.tsx:2740`                           |
| 19  | **Low**      | Templates dialog: 896×765, focus enters and Escape closes, but focus does not return to the trigger and `aria-modal` is null; sort controls are 19px tall                                                                                                | `starter-picker.tsx`                                  |

---

## 1. What is good

- **The settings are real.** Structure, Personality, Density, Corners, Accent,
  Card borders, Border weight, Card fill, Opacity, Background, and the
  per-section/per-block visibility tree all write to a persisted Studio config
  and repaint the canvas — the harness drove each one and diffed the resulting
  custom properties and computed styles. Nothing here is a placeholder; the
  problems are reachability (findings 1, 2) and one option set whose values
  exceed the space available (finding 5), not substance.
- **Progressive disclosure is the right idea.** Theme / Structure / Personality
  stay visible; fine-tuning lives behind "More options", and its open state is
  remembered in `localStorage` (`g-studio-surface.tsx:2641-2653`). That is the
  correct instinct for a panel this dense.
- **One token source for personality.** `studioSurfaceStyle()`
  (`studio-config.ts:511-531`) is shared by the editor canvas, the Studio view,
  and the published page, so a Studio cannot look different in the editor than
  on `/u/<handle>`. The comment at :519-522 shows the intent was deliberate.
- **Personality maps to real faces.** Editorial → Space Grotesk on
  `--font-title`/`--font-display`, Technical → JetBrains Mono, verified by
  measuring the custom properties after each click. The canvas headings do
  change.
- **The editor has no horizontal overflow at any of the 11 sizes**, and no
  console, page, or HTTP errors surfaced in any section of either surface.
- **Keyboard affordances exist.** `Ctrl/⌘D` duplicates, arrows nudge, `Del`
  removes, and the top bar exposes a real `role="radiogroup"` for
  Editing/Preview.
- **Device preview narrows the canvas for real** (first block 757 → 621 → 224px
  across desktop/tablet/mobile), so the control is wired to something.
- **The Studio view scrolls in exactly one place** and the app nav stays put
  while it does (`position: sticky`, y 0 → 0 after a 600px scroll), so the
  Studio does not stack two headers.
- **The Studio view is honest about being a draft.** "Draft — visitors can't see
  your Studio yet" with a Publish now button, plus "N hidden areas — not visible
  to visitors", is the right information at the right moment.
- **Every control in the Studio's own chrome is clickable**, at both 1440 and
  390, and all 8 top-bar controls have an accessible name and clear 24px.
- **SectionLayoutPicker is the correct popover** (`g-studio-surface.tsx:331-387`):
  `relative` container, `top-full` placement, outside-`mousedown` dismissal,
  close-on-select. The fix for finding 3 is to copy this, not to invent one.

## 2. What is bad

1. **The panel is taller than the screen and cannot scroll.** This single
   defect produces three separate user-visible failures:

   | Viewport  | Builder overflow | Panel overflow | Panel scrollable range |
   | --------- | ---------------- | -------------- | ---------------------- |
   | 1920×1080 | +48px            | +69px          | 75px                   |
   | 1440×900  | +48px            | +75px          | 75px                   |
   | 1280×800  | +48px            | +75px          | 75px                   |
   | 1023×768  | +48px            | — (sheet)      | —                      |
   | 390×844   | +48px            | — (sheet)      | —                      |

   The root is `flex h-dvh …` (`g-studio-surface.tsx:459`) but it is nested under
   a 48px app header, so it always hangs 48px below the fold. The panel is
   `h-[calc(100dvh-2.75rem)]` (`:2657`) = 856px at a 900px viewport, but it
   starts at y=119 because the editor's two-row header is 71px tall, so its
   bottom is at y=975.

   Worse, the panel's own scroll range is only 75px — the amount it overflows.
   The content wrapper (`:2668`) is `flex-1 min-h-0` with `overflow: visible`, so
   its 2121px of content (with "More options" open) simply overflows the 722px
   box and the later-in-DOM `<footer>` (`:2980`, 89px, `position: static`, no
   z-index) paints on top of it.

2. **So half the settings are dead to a pointer.** Hit-testing every control at
   rest and after scrolling:

   - at rest — `Compact`, `Comfortable`, `Spacious` (52px below the viewport
     edge) and `Save as template` (31px below) cannot be hit at all
   - after scrolling — the same three report
     `coveredBy: "Reset to default Studio"`, and `Edit background` is 43px below
     the viewport edge
   - at the end of the scroll — `Tools & Stack` (41px below), `Achievements`
     (75px below) and their visibility toggles are below the viewport entirely

   The controls are in the DOM, focusable by keyboard, and announced correctly.
   A mouse or finger cannot reach them. The harness separates the two possible
   stories by driving the control through the DOM when the pointer cannot: driven
   that way, `Density → Spacious` changes the canvas, so the setting is sound
   and only its reach is broken. (`Density → Compact` is the already-active
   value on the seeded account, so a click on it cannot change anything and the
   harness reports it as unproven rather than broken.) Settings that "don't
   work" here are exactly the settings the panel defect hides.

3. **The version popover is unusable.** Measured: popover at x=1140, y=44,
   288×98; its trigger at x=1368, y=58. It overlaps its own trigger and covers
   seven controls — `Add block`, `Save draft`, `Publish changes`,
   `Version history`, and the section band's `Move area up`, `Move area down`
   and `Hide area`. It has `role=null`, no label, and no dismissal at all:
   outside click leaves it open, Escape leaves it open, and clicking the trigger
   while it is open is intercepted by the popover itself. The only way out is to
   navigate.

4. **Personality's promise and the code disagree.** The hint under the control
   reads "Typography and visual character — Editorial uses Space Grotesk,
   Technical uses JetBrains Mono". Under Technical, `--font-title` and
   `--font-display` both become JetBrains Mono, so the `h1` `Maya Chen` and the
   `h2` `Customize` flip to mono — while `Editing`, `Theme`, `Structure`,
   `Personality`, `More options`, `Featured Work`, `spine` and `README` all stay
   Inter, in the same panel, 95px apart. Measured: **1 of 13** micro-labels
   reaches JetBrains Mono under Technical, and **12 of 13** fail to reach Inter
   under Editorial. The cause is a one-token gap: `t-label` sets
   size/weight/tracking/colour but no `font-family`, while `section-label` does
   set it. The two utilities are also not the same treatment — 600/0.06em
   against 650/0.1em — so the "kept identical" note on `t-label` is true of
   size and nothing else.

   The same gap crosses surfaces. `--studio-label-font` _is_ set on `/profile`,
   and the Studio's `Make it yours` checklist uses `section-label`, which reads
   it — but the top bar and the per-area chrome use `t-label`, which does not.
   Setting Technical in the editor therefore produces **zero** mono labels on
   the Studio: `--studio-label-font` resolves to JetBrains Mono there and
   nothing consumes it.

   A third of the gap is in the headings: `h1` and `h2` read `--font-title`
   (`styles.css:335-348`) but `h3` does not, so the section heading `Projects`
   stays Inter under both personalities.

   `--studio-display-font` (`studio-config.ts:517`) is set on every personality
   change and read by nothing at all.

5. **Structure has two identical options on a normal laptop.** `Column → 768px`,
   `Balanced → 1024px`, `Wide → 1200px` (`studio-config.ts:336-340`). The canvas
   at 1440×900 is 944px — 239px app nav, 256px panel, the rest — so Balanced and
   Wide both render at 944px and look the same. They diverge only once the
   canvas is at least 1024px wide, i.e. a viewport of roughly 1520px or more. On
   a 1280×800 or 1440×900 laptop — the common case — two thirds of a setting in
   the always-visible top group of the panel do nothing visible. The comment on
   `structureMaxWidth` explains the caps as "kept under the site-wide max-w-7xl
   (1280px) cap so the builder fits alongside the rest of Tethyr's fixed chrome
   (inspector rail + customize panel)": it accounted for the panel and the
   inspector, not for the 239px app nav rail standing in front of them.

6. **Two theme tiles are selected.** `ThemeSection` renders a hardcoded
   `Default` tile with `active={current === DEFAULT_THEME_ID}` (`:2523`) and then
   maps `presets`, which also contains an entry with the id `DEFAULT_THEME_ID`
   ("Tethyr Default", `:2590`). Both report `aria-pressed="true"`.

7. **The phone is a different product.** The desktop panel has 11 setting
   groups — Theme, Structure, Personality, Density, Corners, Accent, Card
   borders, Border weight, Card fill, Background, Content — and the mobile
   `feel` tab renders 4 of them (`:3267-3326`), plus "Browse templates" and
   "Save as template". Missing entirely: Corners, Accent (+ swatches), Card
   borders, Border weight, Card fill (+ opacity), Background/Edit background
   and the whole Content visibility tree, and the footer's Reset. So on a phone
   a creator can choose how their Studio _feels_ and cannot change what it
   _shows_ or how it is coloured. The internal tab key is `feel` while the
   visible label is `Style`, so a search for the visible word finds nothing.

8. **The phone sheet owns the screen.** `max-h-[62vh]` with `open` initialised
   to `true`: 497px on an 844px viewport = 59%, open before the user has seen
   the thing they are editing, with an "Edit Studio" restore FAB to get it out
   of the way.

## 3. What is confusing

- **Which Studio am I in?** The editor header reads `Studio / Customize` and
  its exit goes to a page titled "Your Studio". The creator is told to
  "Customize" from the top bar and from three per-area `Edit this area in
Customize` buttons stacked down the right margin of the content, and lands on
  a surface whose name changes.
- **Is Theme a Studio setting or an app setting?** "Apply site-wide" changes the
  whole application, including the nav the creator is standing in. It is one
  text button under a grid of Studio-only tiles, with no divider and no warning
  about what it reaches.
- **Are there two Themes?** A grid of 15 unnamed-looking colour tiles, a
  `Default` tile that is not the same as `Tethyr Default`, and a separate
  Accent swatch row — three different notions of colour in one panel, none of
  them labelled as "your colours" vs "the theme's colours".
- **What does "Border" mean in the block inspector?** The Frame group offers
  `Theme | Border | None` with no group label; "Border" reads like the Card
  borders setting in the panel, which controls something else entirely.
- **Is the current area selected?** The block inspector's Area list marks the
  current section with a `disabled` button whose only signals are
  `disabled:text-[var(--user-accent)]` and a "current" badge. A disabled control
  is not focusable, so a keyboard user never learns where they are, and the
  state is carried by colour.
- **Publishing.** The editor's `Publish changes` is disabled until something has
  been published; the real "Publish now" CTA is on `/profile`, next to the
  `Make it yours` checklist whose fifth step is "Publish your Studio". The two
  surfaces disagree about where publishing happens, and the editor offers no way
  to reach the one that works.

## 4. What is unnecessary

- **A second "next steps" system.** The Studio view has two task lists in the
  code, and a new creator can see both at once. The `Make it yours` checklist
  lists 5 steps and returns `null` once 3 are done
  (`studio-view.tsx:846-847`); the `Studio steps` rail (`studio-view.tsx:478`,
  `hidden … 2xl:block`) lists 4 and carries Setup/Showcase completeness bars.
  The two overlap step for step — "Upload profile photo", "Add a banner image",
  "Set your location", "Add a skill you're growing" against "Write a short bio",
  "Upload a banner", "Publish your Studio" — and both route to the same two
  destinations. Measured: the seeded account is past the checklist, so at
  1440×900 only the draft strip shows; at 1920×1080 the rail appears reading
  "4 steps left · Setup 50% · Showcase 25%". The collision is what a creator
  with 0–2 steps done sees, which is the state the checklist exists for.
- **Publish, offered twice** (draft strip and checklist step 5).
- **`Customize`, offered up to five times** — once in the top bar, once per area
  (`Edit this area in Customize` on Featured Work, Skills & Experience and Tools
  & Achievements, at y=157, 859 and 1084, all flush to the same right edge), and
  once more as `Open Customize` in the steps rail at ≥1536px. Contextual
  per-area entry is a defensible pattern; four identically worded buttons is the
  same verb four times over.
- **15 theme tiles in a 2-column grid ≈ 287px** — 34% of an 856px panel spent
  before the user reaches anything they tune, with no search, no grouping, no
  preview beyond a 14px dot, and the site-wide escape hatch underneath.
- **A `Default` tile that duplicates a preset** (finding 6).
- **`--studio-display-font`**, a token nobody reads.
- **One of the two micro-label utilities, on this surface.** The editor panel
  uses `t-label` throughout and `section-label` nowhere, so the pair that is
  supposed to be one treatment is only ever half present.

## 5. What is missing

- **No scroll container.** The single missing thing behind findings 1 and 2.
- **No width or bezel on the editor's device preview**, so "mobile" is just a
  narrow column with no way to tell it from a narrower desktop.
- **No feedback when a setting cannot be seen.** Nothing in the panel says
  "Balanced and Wide look the same at this window size", so the creator's only
  evidence that Structure is not working is that nothing moved.
- **No search or filter** over 15 themes, and no indication of which one is
  currently live on the public page.
- **No undo affordance for Reset** — "Reset to default Studio" is a single
  unconfirmed click next to a live canvas, and the editor does have version
  history for published versions, so the capability exists.
- **No confirmation that a setting was saved.** Changes are local until Publish;
  the header shows "Unpublished changes · N block" but the panel never says so.
- **No `aria-modal`/focus return** on the templates dialog, and no group label
  or `role` on the Frame segmented control.
- **No keyboard route to the mobile-only-hidden settings** — the Content tree
  and background editor are not reachable at any phone width, by any input.

## 6. Structural problems

- **Height is computed from the viewport instead of the parent.** `h-dvh` and
  `calc(100dvh - 2.75rem)` assume the surface owns the screen. It does not: the
  authenticated shell already puts a 48px app header above it, and the editor
  adds a 71px two-row header. This is the same class of bug as a layout that
  hardcodes a z-index — correct in one container, wrong in the real one.
- **Two scroll owners, and the wrong one is declared.** The comment at `:2667`
  says "Single scroll owner: the aside scrolls; this wrapper just stacks" — but
  the wrapper has no `overflow`, so it does not scroll; it overflows visibly and
  the footer paints over it. The comment documents an intent the CSS does not
  implement.
- **The popover is a sibling of the positioned element it needs.** It is
  rendered as a child of the builder root, _after_ the `sticky <header>`, with
  `absolute right-3 top-11`. `position: sticky` establishes a containing block;
  the root does not, so the offsets resolve against something far above. The
  correct pattern is already in the same file (`SectionLayoutPicker`).
- **Personality is split across two token families.** `--font-title` /
  `--font-display` (the _page_ face) and `--studio-label-font` /
  `--studio-display-font` (the _chrome_ face) are set together but consumed by
  different rules, and one consumer of each is missing. Four tokens for two
  decisions.
- **The two micro-label utilities are split across surfaces, not within one.**
  `t-label` (29 uses in the editor surface, 3 on the Studio) never reads a font;
  `section-label` (used by the `/profile` checklist and most of the app) does.
  So the same token produces one face in the app and no face in the Studio, and
  the "kept identical" comment describes a pair that is never rendered side by
  side. The divergence is a latent trap rather than a visible one — the editor
  panel only ever uses `t-label` — which is why the harness cannot compare them
  on one surface.
- **Structure's caps are written against a chrome budget that no longer
  exists.** `structureMaxWidth` budgets for "inspector rail + customize panel";
  the app nav rail in front of them is a third column the comment never
  mentions. A numeric cap derived from a layout assumption silently becomes a
  no-op when the layout changes — the same failure mode as `h-dvh` in findings
  1 and 2, in a different unit.
- **The mobile surface is a separate implementation, not a responsive one.**
  `GMobileEditSheet` re-implements the settings list instead of rendering the
  same panel, which is how it drifted to 4 of 11 groups. Every future setting
  now has to be written twice.
- **The Studio view and the editor disagree about publishing** and about what a
  device preview looks like, because they are two surfaces with two owners and
  no shared contract.

## 7. Visual problems

**Seven uppercase treatments in one screen.** The inventory of uppercase
label-like text on the editor at 1600×1000, Modern personality, read from
computed style:

| Size | Weight | Tracking | Face              | Samples                                  |
| ---- | ------ | -------- | ----------------- | ---------------------------------------- |
| 10px | 400    | 1px      | JetBrains Mono    | `Feature`, `Add block`, `Full`           |
| 10px | 400    | normal   | JetBrains Mono    | `Unsaved changes`, `2 blocks`            |
| 11px | 600    | 0.66px   | Inter             | `Editing`, `Theme`, `Structure`          |
| 11px | 600    | 0.66px   | **Space Grotesk** | `Customize`                              |
| 11px | 400    | 1.1px    | JetBrains Mono    | `New area`                               |
| 14px | 500    | normal   | Inter             | `Projects` (an `h3`, uppercased by rule) |
| 36px | 600    | −0.54px  | Inter             | `Maya Chen` (the `h1`)                   |

Five of the seven are the same idea at three sizes, three weights, three
trackings, and two faces. The 11px/600/0.66px pair is the worst case: the panel
title is Space Grotesk and the group label under it is Inter, 95px apart,
identical in every other respect — and that is the Modern personality, where
nothing was asked to change.

**Chrome budget.** At 1440×900: app nav rail 239px + Customize panel 256px =
495px before the canvas's 944px starts. A third of the screen is chrome before
the creator sees their work.

**Small targets.** 26 of the builder's 127 painted focusables are under 24px
(finding 10): 7 `Show …` toggles at **16×16** in the inspector rail, 7
`Rename area` buttons **16.5px** tall in the canvas section band, 7
`Change area layout` buttons **20px** tall beside them, and 5 canvas links — 4
attribution avatars at **20×20** and the 183×20 "Currently building" link. In
the templates dialog, `Newest` is 54×19, `Most used` 75×19,
`Unpublish Default Studio` 20×20, `Close` **16×16**. The design system's
accessibility baseline says interactive targets must be usable on touch; 14 of
these are under 20px on a desktop, and the section band's 16.5px
`Rename area` button is the one a creator must hit to do the most ordinary
thing to a section. The card-fill swatches are `h-6 w-6` and are fine.

**Colour-only and disabled-only state** in the inspector's Area list (finding 13).

**Contrast on published content** (not editor chrome, but it is what the creator
is publishing). Measured on `/profile` by compositing each computed colour onto
a canvas and reading the pixel back, against its nearest painted ancestor — 4
elements in the seeded Studio's content fall under 4.5:1, and all four are 11–12px
text:

| Text                        | Where                  | Ratio      | Size       | Colour                |
| --------------------------- | ---------------------- | ---------- | ---------- | --------------------- |
| `511 rep` (reputation)      | `header-block.tsx:274` | **2.46:1** | 11px / 400 | `muted-foreground/60` |
| `Legend` (tier name)        | `header-block.tsx:267` | 4.31:1     | 11px / 500 | `text-trust`          |
| `UI Design` (skill pill)    | `skills-block.tsx:102` | 4.42:1     | 12px / 500 | `text-teaching`       |
| `Illustration` (skill pill) | `skills-block.tsx:102` | 4.42:1     | 12px / 500 | `text-teaching`       |

`511 rep` is the outlier: the reputation line is `text-muted-foreground/60`
(`header-block.tsx:274`), so two fifths of the token's contrast is given away
before the creator's own colours are involved. `Legend` is the tier name beside
it — `text-trust` at 11px/500 (`header-block.tsx:267`). `UI Design` and
`Illustration` are skill pills — `text-teaching` on `bg-teaching-subtle` at
12px/500 (`skills-block.tsx:102`). All four are the creator's own content, in
the accent system the Studio lets them pick, which is why the app cannot see
them fail.

**Whitespace.** The panel is 256px wide holding 11 groups, and the theme grid
above them is ≈287px — a third of an 856px panel spent before the user reaches
anything they tune, so the groups they came for are compressed into a scroll
region that does not scroll.

## 8. Recommended information architecture

One rule: **the panel is a list of decisions, ordered by how often they are made,
and it scrolls.** Everything below follows from that.

**Desktop (`/studio`) — the Customize panel, 288px, one scroll owner:**

```
Customize                                    [×]
─────────────────────────────────────────────
LOOK            (the three things everyone changes)
  Theme         4 curated tiles + "15 presets…"
  Structure     Column · Balanced · Wide
  Personality   Modern · Editorial · Technical

DETAIL          (More options — remembered)
  Layout        Corners · Card fill · Opacity
  Colour        Accent + swatches · Card borders + swatches · Border weight
  Background    Edit background →
  Content       Area tree (visibility + select)

─────────────────────────────────────────────
  [Save as template]
  [Reset to default Studio]
```

- **Theme, Structure, Personality at the top** — they are the three that change
  the whole Studio, and they are already the only three visible.
- **Four curated tiles + a "more" affordance** instead of 15 equal tiles. The
  curated four are the ones a new creator actually wants; the rest live behind a
  picker that shows a real preview. This alone returns ~230px to the panel.
- **Group the remaining settings by what they change** (Layout / Colour /
  Background / Content) so the reader can predict where a control lives instead
  of scanning 12 headings.
- **"Content" last, always.** It is the most frequent thing a creator changes
  _after_ the first pass, and it is the longest block.
- **The footer stays put** and the list scrolls behind it. Footer actions
  (save-as-template, reset) are not settings; they should not move.
- **"Apply site-wide" leaves the Theme group.** It is an application-level
  action, not a Studio decision. Put it under a divider labelled "Tethyr app",
  or move it to the appearance dialog the Background row already opens.

**Phone (`/studio`) — one sheet, closed by default, that reuses the same list:**

- Closed by default, `max-h-[52vh]`, with the "Edit Studio" FAB as the only way
  in.
- Tabs `Arrange · Add · Style`, with `Style` rendering **the same list** as the
  desktop panel, not a hand-maintained subset. Parity is the requirement; a
  shared component is the only way to keep it.
- `Style` opens scrolled to the top with Theme/Structure/Personality first,
  which is the same reading order as desktop.

**Studio view (`/profile`) — one guidance surface:**

- Keep the draft strip (it is a _state_, not a task list) and the hidden-areas
  strip (it is also a state).
- Keep the checklist, drop the steps rail, or merge the rail's Setup/Showcase
  bars into the checklist header. Do not ship both.
- `Customize` appears once, in the top bar. The other two entry points become
  plain text ("Edit in Customize") that is not styled as a button.

**Naming:** one word for the destination. `Customize` in the editor, `Your
Studio` on the view, `Studio` in the breadcrumb — pick the one the product doc
uses and use it in all three.

## 9. Recommended implementation

Each item names the smallest change that fixes the finding, and why it is worth
making. **None of these are applied in this document.**

**P0 — make the panel reachable (findings 1, 2).** Three edits, all in
`g-studio-surface.tsx`:

1. Bound the builder to its flex parent instead of the viewport: drop `h-dvh`
   on the root (`:459`) and let the shell's `min-h-0 flex-1` chain size it.
   _Reason: maintainability — the surface stops hardcoding an assumption about
   what is above it, so it cannot break again when the app header changes._
2. Drop `h-[calc(100dvh-2.75rem)]` on the panel (`:2657`) and make the content
   wrapper (`:2668`) the scroll owner: `min-h-0 flex-1 overflow-y-auto` with
   `pb-2`. _Reason: user — every setting becomes reachable; keyboard focus
   scrolls into view for free once the box scrolls._
3. Keep the footer `shrink-0` after it. _Reason: accessibility — the scroll
   region then matches what the comment at `:2667` already claims._

**P0 — fix the popover (finding 3).** Move `<VersionPopover>` inside the sticky
`<header>` as a sibling of its trigger, change `absolute right-3 top-11` to
`absolute right-3 top-full`, and copy the outside-`mousedown` + Escape handling
from `SectionLayoutPicker` (`:340-347`). Add `role="dialog"` +
`aria-label="Published versions"`. _Reason: user (the control currently cannot
be dismissed) and maintainability (one popover pattern in the file, not two)._

**P1 — make Personality true (finding 4).** In `styles.css`, either delete
`t-label` and use `section-label`, or give it the missing
`font-family: var(--studio-label-font, var(--font-sans))` and sync weight (650)
and tracking (0.1em) so the "kept identical" note becomes accurate. Extend the
`--font-title` rule to `h3` (`:335-348`) so section headings follow the
personality too. Delete `--studio-display-font` (`:517`) or point something at
it. _Reason: product — the setting advertises a typography change it does not
deliver, on either surface; accessibility — mixed faces in one panel is a
legibility problem, not a taste problem._

**P1 — make the three Structure options differ (finding 5).** The caps in
`structureMaxWidth` (768/1024/1200) have to fit the space the canvas actually
has, which is `viewport − 239 (app nav) − 256 (panel)`. Re-derive them from that
instead of from `max-w-7xl`, or scale them as ratios of the canvas. _Reason: user
— two of three options in an always-visible group currently do nothing on a
laptop; product — a setting that looks broken is worse than one that is absent._

**P1 — one selected theme (finding 6).** Drop the hardcoded `Default` tile at
`:2519-2534` and let the preset list own selection, or filter the `DEFAULT_THEME_ID`
entry out of `presets`. _Reason: user — two pressed tiles make "what am I
using?" unanswerable; accessibility — `aria-pressed` on two elements is an
invalid state for a single-select group._

**P1 — one settings implementation (finding 7, 8).** Extract the panel body into
a component that takes a `variant: "panel" | "sheet"`, and render it in both.
Default the sheet closed and cap it at 52vh. _Reason: maintainability — parity
stops being a manual promise; user — the phone is no longer a different product._

**P2 — inventory pass (findings 10, 11, 12, 13, 18).** Bring the 26 sub-24px
controls to 24px — the 7 rail toggles, the 14 section-band buttons, and the 5
canvas links — give the block image-URL input an `aria-label`, give the Frame
control a `role="radiogroup"` + label, rename `Up`/`Down` to `Move up`/`Move
down` (and make them the same width as each other), and use `text-2xs` for the
Corners hint. _Reason: accessibility baseline in
[`TETHYR_DESIGN_SYSTEM.md`](./TETHYR_DESIGN_SYSTEM.md) — every one of these is a
documented rule, not a preference. The 26 are one class change each and are
worth doing together, because they are the same rule missed in the same two
components._

**P2 — collapse the micro-labels (finding 15).** Pick one of the seven rows in
the inventory and delete the other six; the natural candidate is the existing
`section-label`, which also already reads `--studio-label-font`. _Reason: visual
hierarchy — a screen that uses three sizes and two faces for the same role has no
hierarchy, it has a sorting problem._

**P2 — one guidance surface (findings on `/profile`).** Merge the steps rail
into the checklist, keep one `Customize` button in the chrome and turn the
per-area ones into a quieter affordance, and give "Apply site-wide" its own
labelled group. _Reason: user — two task lists for the same four actions is one
list too many; product — publishing and the editor have one owner each._

**P3 — the rest.** Templates dialog `aria-modal` + focus return; a width label
and bezel on the editor's device preview (reuse what `studio-view.tsx:308-315`
already does); a confirmation on Reset; the sub-4.5:1 content colours.

## 10. Priority order

| Order | Do this                                                           | Why it is first                                                                                    |
| ----- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1     | Panel height + scroll ownership (P0)                              | Half the settings cannot be clicked. Nothing else in this list is worth fixing while this is true. |
| 2     | Version popover containment and dismissal (P0)                    | The control cannot be closed, and it blocks Publish.                                               |
| 3     | `t-label` font-family + duplicate utility (P1)                    | One line, and it makes a headline setting honest on both surfaces.                                 |
| 4     | Structure caps vs available canvas (P1)                           | Two of three options in an always-visible group do nothing on a laptop.                            |
| 5     | Duplicate selected theme tile (P1)                                | Two lines, and it removes an invalid ARIA state.                                                   |
| 6     | Shared settings component for panel + sheet (P1)                  | Stops the phone from drifting further and stops this class of bug recurring.                       |
| 7     | Sheet closed by default, 52vh (P1)                                | One line, and it gives the phone back its screen.                                                  |
| 8     | Accessibility inventory: targets, names, Frame role, Up/Down (P2) | Documented baseline violations, each small.                                                        |
| 9     | One micro-label treatment (P2)                                    | The single biggest visual-hierarchy win.                                                           |
| 10    | One guidance surface + one Customize entry on `/profile` (P2)     | Product clarity; no new components.                                                                |
| 11    | Contrast, dialog semantics, device bezel, Reset confirmation (P3) | Real, but none blocks a task.                                                                      |

## Status (2026-09-28)

Items 1–9 of the priority order are implemented and verified: panel scroll
ownership with a fixed footer, version popover anchored under the top bar with
outside-click/Escape/trigger dismissal, `t-label` font-family var, Structure
caps as canvas fractions (82% / 90% / 100% — distinct at laptop sizes), theme
tiles filtered, `GCustomizeAdvanced` shared by panel and phone Style tab, sheet
closed by default at 52vh behind an "Edit Studio" FAB, and the accessibility
inventory (24px targets, control names, Frame radiogroup, renamed Move/Hide
actions). Contrast on the Studio view (P3) is also fixed. Verified by
`scripts/qa-studio.mjs` (32/32) and `scripts/qa-studio-view.mjs` (14/14);
`npm run e2e` runs all harnesses.

## What this audit did not cover

- Published-page rendering inside the `/u/<handle>` preview iframe beyond its
  geometry.
- Drag-and-drop reordering, resize handles, and the snap indicator (exercised by
  hand, not measured).
- `templates` publish/unpublish flows and the appearance dialog.
- Long-content and large-dataset states: the seeded demo account has 9 projects
  and a full skill list, so truncation behaviour under real load is untested.
- Dark theme. Every colour measurement above was taken in the default theme.
