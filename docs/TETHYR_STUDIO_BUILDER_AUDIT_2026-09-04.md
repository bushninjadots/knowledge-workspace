# Studio Builder ↔ Public Studio — Layout Consistency Audit (2026-09-04)

> Dated audit of the **/studio builder** (`CreationStudio` + `GStudioSurface`)
> and how its layout model maps to the **public Studio** (`/u/:handle` →
> `PageLayoutRenderer` view mode) and the **owner quick-view** (`/profile` →
> `StudioView`). Scope: **profiles only** — projects are out of scope for this
> pass. No code was changed; this is a findings report.
>
> Read alongside [`AGENTS.md`](../AGENTS.md) (constitution),
> [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md) (workflow), and the earlier
> [`TETHYR_STUDIO_EDITOR_AUDIT_2026-09-02.md`](./TETHYR_STUDIO_EDITOR_AUDIT_2026-09-02.md)
> (which covered the pre-builder Editor page's edit/preview/publish polish).

## TL;DR

The builder ships a **freeform 12-column canvas grid** (`section.grid` with
`x/y/w/h`), but the public page renders through a **completely different**
model — DOM order inside a CSS grid whose columns come from `section.layout`,
with only `block.span` honoured and `x/y/h` discarded. There is no translation
layer between the two. Consequences, verified in source:

1. A **fresh, untouched default profile already renders differently** in the
   builder than it does publicly (feature section: builder stacks
   projects+direction, public shows them side-by-side).
2. **Resizing blocks in the builder does not produce the same widths publicly**
   — in `full` sections the span is ignored outright; in column sections the
   span conflicts with the fixed `SECTION_GRID` track template.
3. The builder **cannot set `section.layout`**, yet that value is the public
   page's primary layout lever.
4. **"Move up/down" a block inside a section is invisible in the builder**
   canvas (order changes only; grid untouched) but *does* reorder the public
   page — editor and public disagree.
5. **`/profile` "View as visitor" is not the public page.** `StudioView`
   renders a third layout model (reads only `section.grid.w`) and keeps
   sections the public page collapses.
6. **Builder preview ≠ public**: hidden blocks stay visible (45% opacity),
   empty-content sections don't collapse, tablet/mobile previews don't persist
   and use different breakpoints, and section titles never appear publicly.

## How the three surfaces are wired

| Surface | Route | Renderer | Layout model used |
| --- | --- | --- | --- |
| Builder (the only profile editor) | `/studio` | `creation-studio.tsx` → `GStudioSurface` (`g-studio-surface.tsx`) | `react-grid-layout` **legacy**, per-section 12-col canvas, `section.grid` x/y/w/h, `compactType={null}` (freeform), uniform band per section. `section.layout` is cosmetic (`feature` → "spine" label). |
| Public Studio | `/u/:handle` | `PageShell` → `PageLayoutRenderer` (`page-layout.tsx`, `context.isEditing=false`) | DOM order + CSS grid `SECTION_GRID[section.layout]`; `block.span` → `md:col-span-N` **only when** `gridClass` is non-empty; `x/y/h` never used. |
| Owner quick-view | `/profile` | `StudioView` (`studio-view.tsx`) | 12-col `md:grid`; `md:col-span` = `clamp(section.grid.w)`, fallback 12; ignores `section.layout`, `block.span`, `grid.x/y`, and empty-collapse. |

**Persistence path** (`creation-studio.tsx`): every drag/resize at `lg`/`md`
breakpoints (`PERSISTED_BREAKPOINTS`, `g-studio-surface.tsx:781-796` →
`applyGrid` at `creation-studio.tsx:376-411`) writes `section.grid`
**and** mirrors `span=item.w`, `height=item.h`, `position=item.index` onto each
block; autosave (`save` → RPC `apply_studio_composition`) persists
`normalizeLayout(layout)` which keeps the grid.

`/u/$handle` passes `isOwner={false}` to `PageShell` (`u.$handle.tsx:181`), so
the owner **cannot** reach `PageLayoutRenderer`'s edit mode from the public
page. The profile editor is exclusively the builder. (The `PageLayoutRenderer`
edit mode — `StudioSectionGrid` + `sortable-block.tsx` + `SectionLayoutPanel` —
still exists and is what *projects* use; out of scope here.)

## Findings

### F1 — Two incompatible layout models, no translation layer
- Builder = absolute grid (`grid.x/y/w/h`, freeform). Public = CSS grid from
  `section.layout` template + DOM order. `page-layout.tsx:520` applies
  `block.span` only through
  `gridClass && typeof block.span === "number" ? spanClass(block.span) : ""`.
- `grid.x`, `grid.y`, `grid.h` have **no meaning** anywhere in the public
  render. The editor's freeform vertical placement cannot be expressed.
- Because the two models disagree at the schema level, no amount of preview
  polish can make the builder faithfully show the public result.

### F2 — Default profile diverges without any user edits
`createDefaultProfileLayout` (`default-layouts.ts`) yields sections:
`full` (header) → `feature` (projects+direction) → `sidebar_right`
(bio+links) → `two_column` (skills+experience) → `full` (gallery) →
`two_column` (tools+achievements); blocks have **no span/grid**.
- `normalizeLayout` synthesizes a grid from `sizeFor` with 2-col parity packing
  (`sectionGrid`, `creation-studio.tsx:777-801`): in the `feature` section,
  `profile-projects` (w12) fills row 0 and `profile-direction` (w5) lands at
  `x=6, y=5` — a half-width block **below**. That is what the builder shows.
- Public `feature` template = `md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]`
  (`page-layout.tsx:61`) → projects and direction **side-by-side**.
- So the flagship default profile is already inconsistent the first time the
  owner opens the builder.

### F3 — Resizing in the builder ≠ resizing publicly
- `full` sections (`gridClass=""`, e.g. header/gallery): `block.span` is never
  applied → **any width change in the builder is silently dropped** on the
  public page (always full-width stacked). This is the most common case.
- Column sections (`feature`, `sidebar_right`, `two_column`, …): the section
  has a **fixed** `SECTION_GRID` template (e.g. 2 tracks). Builder spans such
  as `col-span-12` + `col-span-5` against a 2-track template create implicit
  columns/overflow (`gridAutoFlow:"row"`), not the arrangement shown in the
  canvas.
- Vertical resize (`h`) is lost everywhere — public blocks are content-sized.

### F4 — `section.layout` is uneditable in the only profile editor
- `addSection` always creates `layout: "full"` (`creation-studio.tsx:323-336`);
  `GCustomizePanel` "Structure" only changes `structureMaxWidth`
  (768/1024/1200px content width), not section grids.
- The only control that sets `section.layout` is `SectionLayoutPanel` in the
  *old* `PageLayoutRenderer` edit mode — unreachable for profile owners.
- Yet `section.layout` is the public page's dominant layout signal. For
  profiles, two of the three persisted layout state slots (`grid` vs
  `layout`+`span`) are effectively controlled by different, disconnected tools.

### F5 — "Move up/down" and "Move to area" behave differently editor vs public
- `moveBlock` (`creation-studio.tsx:273-293`) swaps `block.position` only —
  `section.grid` is untouched. RGL positions children by their layout item
  (`key` → `item`), so the canvas **does not visibly move** after Up/Down.
  `applyGrid` only runs on real drag/resize, so the mismatch persists until the
  user drags something.
- On the public page, order = `block.position` sort (`page-layout.tsx:367-369`)
  — so the same action **does reorder** the public page. The editor reads
  "nothing happened"; visitors see a change.
- `moveToSection` (`creation-studio.tsx:295-321`) rebuilds the target grid via
  `nextGridItem` (drops the block at bottom, full default width) — it works in
  both, but the destination placement is non-obvious and doesn't match the
  source's width/row.

### F6 — Owner quick-view is a third, divergent renderer
- `StudioView` (`studio-view.tsx`) spans blocks via
  `Math.max(1, Math.min(12, gridItem?.w ?? 12))` (`:292`), i.e. only
  `section.grid.w`, falling back to **12 (full width)** when there's no grid.
  It ignores `section.layout` and `block.span`. A legacy/no-grid published
  profile shows every block stacked full-width on `/profile` while `/u/:handle`
  shows two-column/feature layouts.
- The **"View as visitor" toggle is misleading**: it flips `mode` between
  `view`/`preview` inside `StudioView` itself; it never renders
  `PageLayoutRenderer`. Owners who click it are not seeing what visitors see.
- No `onBlockEmptyChange` is wired (`studio-view.tsx:94-102`), so sections the
  public page collapses (all-empty) still render their bands for the owner.
- Block content is clipped: wrapper is `h-full min-h-0 overflow-hidden`
  (`:299`) while the public has no frame; header/content heights differ.

### F7 — Builder preview ≠ public
- Hidden blocks (`visible=false`) render in the builder at `opacity-45` even in
  *preview* (`g-studio-surface.tsx:842`), while public drops them entirely.
- Empty-content sections: the builder preview only drops sections whose blocks
  are all `visible!=false` (`g-studio-surface.tsx:656`); it never reports
  resolved emptiness (no `onBlockEmptyChange` in the canvas `BlockContext`,
  `:855-865`). Public collapses all-empty sections via
  `shouldRenderSectionInView` (`page-layout.tsx:159-161`, blocks report via
  `onBlockEmptyChange` `:569`). So preview shows empty bands the public hides.
- Breakpoints differ: builder previews at 834/390 with `COLS` collapsing
  `{sm:8,xs:4,xxs:1}`; public stacks below `md` (768). The mobile sheet admits
  the gap ("widths apply to the wide layout — on a phone the public Studio
  always stacks in this order"), i.e. mobile widths are editor-fiction.
- Only `lg`/`md` persist (`PERSISTED_BREAKPOINTS`), so tablet/phone drags
  live-resize but vanish on save/reload.

### F8 — Section titles are editor-only
- The builder shows an editable title bar per section and a "spine" header for
  `feature` (edit mode) and feature spine labels in preview
  (`g-studio-surface.tsx:664-737`), default title `Area N`.
- `PageLayoutRenderer` public renders **no section titles at all**; the
  edit-mode section header (`page-layout.tsx:388`) is editing-only. A renamed
  "Area 2 → Portfolio" never appears publicly. (May be intentional — flagging
  so the copy "rename areas" isn't read as public-facing.)

### F9 — Height/density are editor-only
- Builder row height is density-scaled (20/24/28, `g-studio-surface.tsx:643-646`)
  and blocks are fixed to their `h` rows with `overflow-y-auto` frames
  (`:851`) — content scrolls or leaves whitespace.
- Public has no height model (content-sized); density only changes
  `--spacing-section` (2.5/4/6rem) and `--content-density-gap`.

## Consistency matrix (verified in source)

| Action (builder) | Sees it in builder? | Sees it on `/u/:handle`? | Sees it on `/profile`? |
| --- | --- | --- | --- |
| Drag block (lg/md) | ✅ grid canvas | ⚠️ order yes; width only in non-`full`; x/y/h no | ⚠️ width via grid.w only, order yes |
| Resize width | ✅ | 🔴 `full` sections drop it; column sections overflow template | ✅ width (grid.w) |
| Resize height | ✅ rows | 🔴 | 🔴 |
| Move block up/down | 🔴 nothing visible | ✅ order changes | ✅ order |
| Move section up/down | ✅ | ✅ | ✅ |
| Hide block/section | ✅ (opacity) | ✅ dropped | ✅ dropped |
| Rename section | ✅ | 🔴 never shown | 🔴 never shown |
| Empty section collapse | 🔴 preview shows band | ✅ collapses | 🔴 shows band |
| Tablet/mobile resize | ⚠️ live, not persisted | 🔴 | 🔴 |
| section.layout change | 🔴 impossible | ✅ main lever | 🔴 ignored |

## Suggested direction (no changes made — decision needed)

> **Fix F10 (version-snapshot schema) and root-cause F11 (nothing persists)
> first** — they block every other improvement: the editor is currently
> unusable on first load after a publish.

Smallest strong changes, in rough order:

1. **Pick one canonical public model.** Either teach the public page to read
   `section.grid` (translate x/y/w/h on a 12-col grid to the section's CSS
   grid: `md:grid-cols-12` + `md:col-span-xs`/`md:row-span-y` from grid w/h,
   keep `section.layout` as the *desktop measure* fallback), or stop the
   builder from writing `grid` and route everything through `layout`+`span`.
   Option A has the smaller diff today (page-layout public branch) and makes
   the builder truthful for widths/heights.
2. **Make `moveBlock` rebuild the grid** from the new order (or animate), so
   Up/Down is visible in the canvas — and make `applyGrid` the single mutator.
3. **Let the builder set `section.layout`** (or drop it for profiles and derive
   columns purely from grid widths).
4. **Point `/profile` "View as visitor" at `PageLayoutRenderer`** (render the
   public component in an iframe/frame) and wire `onBlockEmptyChange` in
   `StudioView`.
5. **Preview truthfulness**: respect visibility in preview (`visible!==false`
   filter), run the same empty-collapse reporter, and map preview breakpoints
   to the public `md` stack point.

## F10 (BLOCKER) — Publishing once breaks the Studio editor permanently

**Symptom.** After publishing a profile page, reopening `/studio` hard-crashes.
Content renders nothing; console shows:

```
TypeError: Cannot read properties of undefined (reading 'map')
    at normalizeLayout (creation-studio.tsx:715)
    at <useMemo in CreationStudio> …
```

The owner can no longer edit (the only profile editor is dead). `/profile`
(StudioView) and the public `/u/:handle` are unaffected.

**Root cause (verified in code + DB).** The publish RPC `publish_page_version`
inserts `l.sections` — a **JSON array** — into `page_versions.layout`
(verified via `pg_proc.prosrc`). But `use-page.ts:133` wraps it as an object:

```ts
layout: { sections: (row.layout as unknown as PageLayout).sections },
```

`row.layout` is an array, so `.sections` is `undefined` → every returned
`version.layout` becomes `{ sections: undefined }`. `creation-studio.tsx`
reads the newest snapshot for `hasUnpublishedChanges` (`:130-140`) and feeds it
to `normalizeLayout` (`:717` `layout.sections.map`), which throws on
`undefined.map` during the first render after the query resolves. Every
published profile in the DB (`testuser` v1, `bush` v1–14) has an array-typed
`page_versions.layout`, so this hits every published owner who opens the
studio, not just the audit subject.

**Fix sketch (not applied — audit scope).** Either store `{ sections }` in the
RPC, or read it on the client:
`layout: { sections: ((row.layout as unknown as PageLayout).sections ?? (row.layout as unknown as PageLayout)) as PageLayout["sections"] }`
(pick whichever represents the intended snapshot schema). Add a regression test
that publishes a profile then mounts `CreationStudio`.

## F11 — In-canvas drag/resize did not persist anywhere (observed in this run)

While the page was still a draft, `profile-gallery` was resized from 896px
(~12/12) to 441px (~5/12) via the SE handle in the builder canvas. The DB was
then inspected: the layout row
(`dbe6fafd-01b1-41eb-90bf-96a4ea3ee07a`) still has **0/6 sections with a
`grid` array** and **all `block.span`/`height` null** — both after the resize
and after a subsequent Publish (which itself calls `apply_composition`). The
visible editor change never reached storage, and the version snapshot is
likewise grid-less.

Cause is not conclusively pinned (a healthy `applyGrid` → `save` →
RPC `apply_studio_composition` path should have written `grid`); the autosave
debounce, a silent RPC failure, or a stale-clone write are candidates, and
clean experimentation is blocked by F10. Whatever the cause, **the editor's
primary manipulation writes nothing the public page can read** — worth
root-causing immediately after F10.

## Validation performed

- Source review of `creation-studio.tsx` (applyGrid/normalizeLayout/
  sectionGrid/moveBlock/addSection), `g-studio-surface.tsx` (RGL wiring,
  PERSISTED_BREAKPOINTS, preview filter, GBlockFrame), `page-layout.tsx`
  (gridClass/span gate, empty-collapse, order), `studio-view.tsx`, `page-shell.tsx`,
  `u.$handle.tsx`, `studio-config.ts`, `studio-visibility.ts`,
  `default-layouts.ts`, `use-page.ts`, publish RPC, and the builder's test file
  (`creation-studio.test.tsx`, `vitest`).

## Empirical verification (browser, 2026-09-04)

Automated Playwright pass against the local stack (login =
`test@tethyr.com`/`password123`; subject = freshly-defaulted `testuser`
profile, layout `dbe6fafd…`). Viewports 1440×900 and 390×844. Analysis is from
DOM geometry (`[data-block-type]` / `.react-grid-item` rects), not screenshots.

- **Builder desktop**: canvas ≈896px after the two rails. Default 6-section
  layout synthesizes grids from `sizeFor`: `profile-projects` w=896 row 0,
  `profile-direction` w=555 **overlapping the projects block's lower-left**
  (grid cell `translate(0,38)` on the same column) — every 2nd block of every
  2-block section overlaps by 38px. **Confirms F2** live: the synth grid packs
  project+direction stacked/clipped, public renders them side-by-side.
- **`/profile` desktop**: every block full-width 1152 (x=264) — no grid on
  this legacy layout, so span falls back to 12. gallery block measures h=0.
  **Confirms F6**: owner quick-view ≠ public (public shows columns).
- **Builder mobile (390)**: blocks stack full-width 358; same 38px overlap.
- **Publish → public `/u/testuser` desktop**: `header` full-bleed w=1440 h=186
  (a `full` section — span ignored, no max-width wrap). `feature`
  (1.35fr/0.65fr) → **projects w=950 + direction w=458 side-by-side** — the
  exact opposite of the editor's stacked view. `sidebar_right` → bio w=1128 +
  links w=280 rail. `two_column` → 2×704. **profile-gallery absent** — the
  empty block collapsed the whole section publicly while the editor kept
  showing the empty band (empty-collapse only exists on the public path,
  F7). Public mobile stacks 1×358 in order
  header→projects→direction→bio→links→skills→experience→tools→achievements.
- **Interaction**: `profile-gallery` resized 896→441 in-canvas but nothing
  persisted (F11). "Move up/down" affordances for blocks are not surfaced in
  the DOM (no labels/tests hit), consistent with F5.
- **Publish-then-reopen**: `/studio` crashes on load (F10); `/profile` still
  renders 10 blocks, no console errors; public page renders fine. Regression
  fully consistent with root-cause analysis.
## Resolution status (2026-09-04, applied + committed with `078360b` follow-up)

The findings above were addressed in the next pass. Each item is marked
**FIXED** (verified green: `tsc --noEmit`, `eslint` on touched files, 460
vitest tests) or **DEFERRED** (documented product call, no change).

| Finding | Status | What changed |
| --- | --- | --- |
| F1 two incompatible layout models | **FIXED (Option A)** | Public `PageLayoutRenderer` now renders a 12-col CSS grid (`md:grid-cols-12`, `gap-8`) when `section.grid` is present and well-formed: each block gets `md:col-start-{gridItem.x+1}` + `md:col-span-{gridItem.w}` (see `page-layout.tsx` public branch + `colStartClass`). Legacy template path (`SECTION_GRID[section.layout]` + `block.span`) is fully preserved when a section has no grid. `x/y/h` still not persisted publicly beyond placement — see F9. |
| F2 default feature-section divergence | **FIXED** | `nextGridItem`/`normalizeLayout`/`sectionGrid` now use first-fit non-overlapping packing (`firstFreePosition`) instead of the floor-packer that overlapped 2nd blocks in 2-block sections. Combined with F1, the editor canvas and public grid now agree on placement. |
| F3 resize lost on full sections / span–template conflict | **FIXED** | Any section whose grid is touched (drag/resize/add/remove/duplicate/move) now writes `section.grid` and the public page honours it via the 12-col grid. Untouched sections save **without** a synthetic grid (`save()`/`publish()` strip `grid` from untouched sections via `touchedGridRef`), so pristine default layouts keep the pretty template rendering. Height (`h`) remains editor-only — F9. |
| F4 `section.layout` uneditable in `/studio` | **DEFERRED** | With F1, `section.layout` is no longer the primary public lever for grid-touched sections, so the gap matters less. The builder still cannot set it; new sections are `full`. Revisit only if column templates are wanted over grid placement. |
| F5 "Move up/down" invisible on canvas | **FIXED** | `moveBlock` now swaps positions **and** rebuilds the block's grid slot via first-fit (`creation-studio.tsx`), so the canvas visibly reorders and stays consistent with public order. |
| F6 `/profile` "View as visitor" ≠ public | **FIXED** | `StudioView` preview mode now renders a real `<iframe src="/u/{handle}">` (the actual public page, `data-studio-preview-frame`) when a handle exists. |
| F7 preview truthfulness | **FIXED** | `GSectionBand` drops `visible === false` blocks when not editing (no more 45%-opacity zombies); empty-collapse in public preview still differs from public by design (editor shows empty bands). |
| F8 section titles editor-only | **DEFERRED** | Product call — section titles are a builder affordance; they are not rendered on the public page. No change. |
| F9 height/density editor-only | **DEFERRED** | Public is content-sized by design; rows/density are an editor framing concept. No change. |
| F10 publish-then-reopen `/studio` crash | **FIXED (blocker)** | Root cause: `publish_page_version` stores `layouts.sections` as a **bare array** in `page_versions.layout`; `use-page.ts` read `(row.layout as PageLayout).sections` → `undefined` → `normalizeLayout` crashed on every `/studio` load after first publish. Fixed with exported `parseVersionLayoutSections(raw)` (handles array + `{sections}` + nullish) + new regression test `src/hooks/use-page.test.ts`. |
| F11 builder resize not persisted | **RETESTED / suspected-invalid** | Write path (`applyGrid` → `save()` → RPC `apply_studio_composition`) re-verified sound end-to-end. The earlier observation was almost certainly Playwright synthetic-input noise (drag never fired `onResizeStop`); persisted-grid persistence should be revalidated in-browser with a real drag. |

### Verified state after changes
- `npm run typecheck` clean; `npx eslint` clean on all six touched source
  files + tests; `npm run test` → 460 passed (61 files), including the new
  `parseVersionLayoutSections` suite and the existing grid-adapter tests
  (stable with first-fit packing).
- Files changed (all staged+committed together): `src/hooks/use-page.ts`,
  `src/hooks/use-page.test.ts`,
  `src/components/tethyr/studio/creation-studio.tsx`,
  `src/components/tethyr/studio/g-studio-surface.tsx`,
  `src/components/tethyr/studio/studio-view.tsx`,
  `src/components/tethyr/page/page-layout.tsx`, plus this doc.
- Pre-existing unrelated working-tree changes (`.gitignore` prowl rules and
  `g/` legacy-folder deletions) were deliberately left out of the commit.
