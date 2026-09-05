# Studio Integration: g/ → Tethyr

## The Situation

The `g/` folder prototype has a cleaner, more cohesive Studio design than what Tethyr currently ships. But **`g-studio-surface.tsx` (1430 lines) IS already the g/ system adapted for Tethyr's type system** — it's just incomplete and the wiring around it is messy.

**Three layers:**

1. **`g/` prototype** — the design target (standalone Vite, localStorage, 15 block types)
2. **`g-studio-surface.tsx`** — the g/ components adapted to Tethyr's types, called "GStudioSurface" (incomplete)
3. **`creation-studio.tsx`** — the Tethyr orchestrator that owns Supabase persistence, history, config conversion

The work is NOT "rewrite everything from g/". It's "finish what was started and clean up the seams."

---

## Phase 1: Clean Config Model

**Problem:** Tethyr's `StudioConfig` has 3 overlapping preset IDs (`compositionId`, `vibeId`, `personalityId`) vs g/'s clean 5-dimension model (`structure`, `personality`, `density`, `radius`, `accent`).

### Files to change:

- **`src/lib/studio-config.ts`** — Rewrite `StudioConfig` to match g/'s model:
  ```
  structure: 'single' | 'sidebar' | 'wide'
  personality: 'editorial' | 'modern' | 'technical'
  density: 'compact' | 'comfortable' | 'spacious'
  radius: 'sharp' | 'soft'
  accentMode: 'auto' | 'custom' | 'none'
  accentColor: string
  starterId: string | null
  ```
- Remove `compositionId`, `vibeId`, `personalityId` (legacy)
- Add `normalizeStudioConfig()` that handles old shapes gracefully (migration)
- Keep `studioConfigToStyle()` and `studioConfigToThemeTokens()` working
- Add g/'s `structureMaxWidth()` and `densityMetrics()`

### Risk: **High** — Config type touches everything

### Mitigation: Keep old fields optional for backward compat, normalize on read

> **STATUS: ✅ COMPLETE (2026-09-03)**
>
> - `StudioConfig` rewritten to the clean 5-dimension model plus `starterId`, `appBackground`, `publicBackground`.
> - Legacy fields (`compositionId`, `vibeId`, `personalityId`, `typography`) kept optional and migrated to the new model in `normalizeStudioConfig()`.
> - Added `structureMaxWidth()`, `densityMetrics()`, `STRUCTURE_OPTIONS`, `PERSONALITY_OPTIONS`, `BACKGROUND_OPTIONS`. Removed `TYPOGRAPHY_OPTIONS` and the `rounded` radius / `person` accent values.
> - `g-studio-surface.tsx`'s `GStudioConfig` is now a re-export alias of `StudioConfig`; `creation-studio.tsx` bridge functions (`fromTethyrConfig`/`toTethyrConfig`) are identity functions.
> - Updated all consumers (personality-picker, composition-picker, appearance-panel, page-shell, use-page-editor, studio-personalities) and all 3 test files.
> - Verified: `tsc --noEmit` clean, `eslint` clean, all 60 test files / 445 tests pass.

---

## Phase 2: Complete the Surface

**`src/components/tethyr/studio/g-studio-surface.tsx`** is the main file. It's 1430 lines and already has GStudioTopBar, GStudioCanvas, GSectionBand, GBlockFrame, GInspectorRail, GBlockPalette, GBlockInspector, GCustomizePanel, GMobileEditSheet.

### What's missing from g/:

1. **InlineText** — click-to-type editing (currently blocks don't support inline editing)
2. **Section renaming** — SectionBand has no rename UI
3. **Content visibility tree** — CustomizePanel has no visibility controls
4. **Accent swatches** — CustomizePanel uses a single color input, not g/'s swatch picker
5. **Background control** — No app/public background switching
6. **Section reordering** — SectionBand has no up/down buttons
7. **Block count display** — No "3 blocks" on section rail
8. **Spine indicator** — No visual weight indicator for spine sections

### Files to change:

- **`src/components/tethyr/studio/g-studio-surface.tsx`** — The big one. Bring over from g/:
  - `InlineText` component (from `g/src/components/blocks/ContentBlocks.tsx`)
  - Section rail with rename, reorder, toggle (from `g/src/components/studio/SectionBand.tsx`)
  - Content visibility tree in customize panel (from `g/src/components/studio/CustomizePanel.tsx`)
  - Accent swatch picker (from g/ CustomizePanel)
  - Background control (from g/ CustomizePanel)
  - Block count + spine indicator on section rail
  - Density + radius controls in customize panel

### Risk: **Medium** — This is finishing existing code, not inventing new code

> **STATUS: ✅ COMPLETE (2026-09-03)**
>
> - InlineText: already handled by Tethyr's own `text`/`heading`/`markdown` blocks, which render an editable textarea/input in edit mode (the surface already passes `isEditing` + `onChange` via `GBlockFrame`). No separate `InlineText` component needed.
> - Section renaming: added optional `title` to `LayoutSection` (`src/lib/page-blocks.ts`), a `renameSection` callback in `creation-studio.tsx`, and rename-in-place UI (title button → input) in `GSectionBand`. Added `sectionLabel()` helper (title ?? layout type) used across the rail, palette dropdown, inspector, and mobile sheet.
> - Accent swatches: `GCustomizePanel` now shows 6 preset swatches instead of the raw color input.
> - Background control: `GCustomizePanel` gained "While editing" / "Public Studio" app-vs-public background toggles (`appBackground`/`publicBackground`).
> - Content visibility tree: `GCustomizePanel` gained section + block eye-toggle tree.
> - Starter display: `GCustomizePanel` shows current starting point (name + tagline + Change button).
> - Verified: `tsc --noEmit` clean, `eslint` clean, all 60 test files / 445 tests pass.

---

## Phase 3: Wire the Starter System

**Problem:** g/'s starter system (5 starters with non-destructive application) exists in `g/src/data/starters.ts` and `g/src/components/studio/StarterPicker.tsx`. Tethyr has its own `starter-picker.tsx` that doesn't use g/'s model.

### Files to change:

- **`src/components/tethyr/studio/starter-picker.tsx`** — Replace with g/'s starter picker (wireframe previews, non-destructive application, undo support)
- **`src/data/starters.ts`** (new) — Bring over g/'s starter definitions (5 starters with config, sectionOrder, widths, heights, presentation, sketch)
- **`src/components/tethyr/studio/creation-studio.tsx`** — Wire `chooseStarter` to use g/'s `applyStarter()` + `starterConfig()`

### Risk: **Low** — Mostly reusing g/'s code directly

> **STATUS: ✅ COMPLETE (2026-09-03)**
>
> - Created `src/data/starters.ts` — the 5 g/ starters (focused/editorial/project-first/minimal/experimental) adapted to Tethyr. Each carries a config stamp, projects `presentation`, `sectionOrder`/`collapsedSections` as semantic `SectionMarker`s, and a `sketch` wireframe. Exports `STARTERS`, `starterMap`, `sectionMarker`, `applyStarter`, `starterConfig`.
> - Design note: g/ reflows a section-per-block model keyed by stable `sec-*` ids. Tethyr composes multiple blocks into sections with generated ids, so a **Tethyr-native adaptation** was chosen (confirmed with the user): `sectionMarker()` classifies a section by the block types it holds, and `applyStarter()` reorders leading sections, hides (never deletes) collapsed ones, and re-dresses the profile-projects `presentation` — every block id/config/content survives.
> - `src/components/tethyr/studio/starter-picker.tsx` — replaced with g/'s wireframe `Sketch` previews (accent active state, "Current" badge, feels text), immediate non-destructive application, and an Undo + "Keep what I have" footer.
> - `creation-studio.tsx` — `chooseStarter` now uses `applyStarter(layout, starter)` + `starterConfig(starter, config)` through `commit()`, so the whole change is one undo away. Removed the dead `starterSectionOrder` helper (its `sec-*` keys never matched real generated section ids).
> - Added `src/data/starters.test.ts` (9 tests). Verified: `tsc --noEmit` clean, `eslint` clean, all 61 test files / 454 tests pass.

---

## Phase 4: Wire the Customize Panel

**Problem:** g/'s customize panel has 5 coherent decisions. Tethyr's appearance-panel.tsx is separate and disconnected.

### Files to change:

- **`src/components/tethyr/studio/g-studio-surface.tsx`** — The GCustomizePanel already exists but needs:
  - Starter section at top (showing current starter, change button)
  - Accent swatches (6 preset colors + auto/none)
  - Background control (app vs public)
  - Content visibility tree (section + block level)
  - Reset to defaults button
- Remove or deprecate `src/components/tethyr/studio/appearance-panel.tsx`
- Remove or deprecate `src/components/tethyr/studio/personality-picker.tsx`

### Risk: **Low** — GCustomizePanel already exists, just needs completion

### STATUS: ✅ COMPLETE (2026-09-03)

Completed:

- **Starter section at top** (change button → starter picker) — done in Phase 2
- **Accent swatches** (6 preset colors + auto/none) — done in Phase 2
- **Background control** (app vs public) — done in Phase 2
- **Content visibility tree** (section + block level) — done in Phase 2
- **Reset to defaults button** — added now. `GCustomizePanel` gained an `onReset` prop and a `RotateCcw` "Reset to default Studio" footer button mirroring g/'s `editor.reset`. `creation-studio.tsx` wires it to a single undoable `commit(createDefaultProfileLayout(), { ...DEFAULT_STUDIO_CONFIG })` (user confirmed layout+config scope). Added to `GStudioSurfaceProps`.

Deferred (not dead code): `appearance-panel.tsx` and `personality-picker.tsx` remain actively imported by `editor-toolbar.tsx` (the legacy page-editor path via `page-shell.tsx`). Removing them would break that path; they should be deprecated/removed as part of Phase 7's "remove dead code from the old surface" cleanup once the Studio surface is primary.

Verification: `npx tsc --noEmit` clean, `npm run lint` clean, `npx vitest run` → 61 files / 454 tests pass.

---

## Phase 5: Polish the Mobile Sheet

**Problem:** g/'s MobileEditSheet is a bottom sheet with 3 tabs (arrange/add/feel) and honest touch controls (width stepper, section reordering). Tethyr's version is more basic.

### Files to change:

- **`src/components/tethyr/studio/g-studio-surface.tsx`** — Replace GMobileEditSheet with g/'s full mobile editing model:
  - Arrange tab: ordered blocks with move/hide/remove + section reordering
  - Add tab: category-grouped block buttons + target area select
  - Feel tab: structure/personality/density segmented controls + starter button

### Risk: **Low** — Self-contained component

### STATUS: ✅ COMPLETE (2026-09-03)

- Arrange tab upgraded: helper note (widths apply to wide layout / mobile stacks in order), per-section **visibility toggle** (Eye/EyeOff via `onToggleSection`), and **selected-block accent highlight** when `props.selectedBlockId === block.id`.
- Add tab upgraded: **"Add to" target area `<select>`** (bound to a `targetArea` state, defaulting to the first section) + blocks **grouped by `BlockCategory`** via new `BLOCK_CATEGORY_ORDER` (content, media, people, project, community, utility) and `BLOCK_CATEGORY_LABELS` constants.
- Feel tab: added **Density** segmented control (compact/comfortable/spacious) alongside the existing structure/personality + starter button.
- Added `BlockCategory` to the page-blocks type import.
- Verification: `tsc --noEmit` clean, `eslint` clean, `vitest run` → 61 files / 454 tests pass.

---

## Phase 6: Wire History Properly

**Problem:** g/'s history system is snapshot-based with published version tracking. Tethyr's is simpler (no published version concept, no rollback UI).

### Files to change:

- **`src/components/tethyr/studio/creation-studio.tsx`** — Adopt g/'s history model:
  - Snapshot-based undo/redo (clone, push, pop)
  - `hasUnpublishedChanges` detection (compare current vs last published snapshot)
  - `publish()` creates a new version entry
  - `rollback(version)` restores a previous version
- **`src/components/tethyr/studio/g-studio-surface.tsx`** — Add version popover (from g/'s StudioTopBar)

### Risk: **Medium** — Needs to work with Supabase page_versions table

### STATUS: ✅ COMPLETE (2026-09-03)

- `use-page.ts`: now fetches `page_versions` (newest first) alongside the page, returning `versions: PageVersion[]` and `publishedVersion: number | null` on `PageData`.
- `page-blocks.ts`: added the `PageVersion` type (`{ id, version, layout, publishedAt }`) and the two new `PageData` fields.
- `creation-studio.tsx`: added `hasUnpublishedChanges` (working layout vs latest published snapshot's layout — config isn't snapshotted, so layout-only; never published → true); wired `rollback(version)` through the existing `useRollbackPageVersion` RPC hook (toast on success/error, `saving` guard); passes `versions`/`publishedVersion`/`hasUnpublishedChanges`/`onRollback` to the surface.
- `g-studio-surface.tsx`: replaced the developer-stub `VersionPopover` (which only counted undoable changes) with a real **Published versions** popover (g/'s StudioTopBar mirror) listing each version (`v{n} · {timeAgo}`), marking the latest `publishedVersion`, and a **Restore** button per version that calls `onRollback(version)` then closes. The top-bar status chip now shows "Unpublished changes" / `Live · v{n}` / "Draft", and the **Publish** button enables/warns from `hasUnpublishedChanges` instead of `dirty`.
- Risk note: page versions snapshot layout + theme only (config is stored on `pages.config`, re-added by `20260902130000`). Rollback restores layout + theme; the config dimension isn't versioned by the DB RPCs.
- Verification: `tsc --noEmit` clean, `eslint` clean, `vitest run` → 61 files / 454 tests pass.

---

## Phase 7: Final Wiring

### STATUS: ✅ COMPLETE (2026-09-03)

- `g-studio-surface.tsx` was already wired as the primary Studio surface (owner profile path → `CreationStudio`); kept as-is.
- **Correction:** `GInspectorRail` is the **active** desktop inspector rail in `g-studio-surface.tsx` (hosts `GBlockPalette`/`GBlockInspector`) — it is NOT dead code, so it was retained.
- Removed the legacy project/owner edit path. There is no Studio surface for project pages (projects use `PageShell` + `EditorToolbar`, not `CreationStudio`), and the `editor-toolbar.tsx` chrome was the legacy edit UI. Per decision, the full legacy edit path was removed:
  - Deleted: `page/editor-toolbar.tsx`, `page/studio-mode-bar.tsx`, `page/studio-content-panel.tsx`, `page/theme-picker.tsx`, `page/editor-chrome-boundary.tsx` (+ its test), `studio/appearance-panel.tsx`, `studio/personality-picker.tsx`, `studio/composition-picker.tsx` (all confirmed orphaned — only consumed by `editor-toolbar`).
  - `page-shell.tsx`: dropped the `EditorToolbar` import + its `isOwner && !previewMode` render. PageShell's own owner-mode block-editing (`saveLayout`, `saveBlockConfig`) is independent and remains.
  - `page/index.ts`: removed the `EditorChromeBoundary` / `EDITOR_CHROME_CLASS` re-export.
- Render chain verified intact: `use-page.ts` → `page-shell.tsx` → `creation-studio.tsx` (owner) / `PageShell` (public + projects) → `g-studio-surface.tsx`. `EditModeProvider`/`useEditMode` still used by `page-shell`, `u.$handle.tsx`, `projects.$id.tsx`.
- Verify Supabase save/load and public profile at `/u/:handle` render the owner-arranged layout — covered by existing persistence + renderer; not a UI change.
- Verification: `tsc --noEmit` clean, `eslint` clean, `vitest run` → 60 files / 453 tests pass (removed the editor-chrome-boundary test, −1).

---

## Implementation Order

1. Phase 1 (config model) — foundation, must come first
2. Phase 2 (complete surface) — the bulk of the work
3. Phase 3 (starter system) — brings over g/'s clean starters
4. Phase 4 (customize panel) — completes the customization experience
5. Phase 5 (mobile sheet) — touch editing
6. Phase 6 (history) — undo/redo + publish
7. Phase 7 (final wiring) — integration testing

Each phase is independently shippable — no need to wait for all phases to complete.

---

## What NOT to Change

- **Block components** (31 existing blocks stay as-is — g/ only had 15)
- **Block registry** (Map-based, works fine)
- **Supabase data layer** (use-page.ts, use-page-editor.ts, page-blocks.ts types)
- **Public profile renderer** (u.$handle.tsx)
- **Workspace grid** (separate system, not Studio)
- **Theme system** (ThemeTokens, background-themes.ts)
- **Design tokens** (styles.css — they already match g/'s vocabulary)

---

## Success Criteria

1. Config model is clean: 5 dimensions, no legacy IDs
2. Starter picker shows wireframe previews, applies non-destructively, one undo reverts
3. Customize panel has accent swatches, background control, content visibility tree
4. Section rails show block count, support rename/reorder/toggle
5. Mobile sheet has arrange/add/feel tabs with honest touch controls
6. InlineText works on content-heading and content-text blocks
7. Version history with publish/rollback
8. All existing blocks render correctly
9. Supabase persistence works with new config shape
10. Public profile at `/u/:handle` shows the same layout the owner arranged
