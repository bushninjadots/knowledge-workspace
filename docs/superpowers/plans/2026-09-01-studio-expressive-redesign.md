# Plan: Studio expressive redesign (Create → Customize → Personalize → Arrange → Preview → Publish)

Solves: [design spec `docs/superpowers/specs/2026-09-01-studio-expressive-redesign-design.md`](README.md) (committed `60dbf2f`).

## Status Key

- `[ ] Todo`
- `[x] Done`
- `[~] In progress`

Lowercase `[x] ✔` = completed + verified containing "✔".

## Implementation Notes

- All work happens on the existing block system (Approach A). We extend `PageData`/`PageLayout`/blocks; we do not build a parallel system.
- Timing: ~1.5-2h. No golden master; just run the local verify command below.
- Commit strategy: Phase 0 is its own commit (dead-end removal). Remaining phases may be one or more commits, keeping the branch in a working state at all times (Lovable syncs every push).
- Supabase local stack must be running (`bash scripts/base44-start.sh`) for migration + type regeneration + browser smoke.

## Verify With

- `npm run verify` (typecheck + lint + test + prettier:check + check:unused)
- `curl -H "Host: x" http://localhost:3000/` → 200 with seeded title
- Browser smoke of `/profile` Studio edit flow and `/u/<handle>` public view.

## Risks

- Migration timestamp collisions with existing local DB — use distinct 20260901x15y00 names. Do NOT renumber existing migrations.
- `check:unused` only fails on NEW unused exports; deletions are always safe. Baseline currently lists dead tabs/cards; deleting them removes baseline entries (no `--update-baseline` needed for cleanup, only if a NEW unused export appears).
- Lovable: do not rewrite published git history (force push/rebase/amend). Commits stay linear.

---

## Phase 0 — Delete dead-end code (own commit)

Removes everything from the abandoned public-studio / legacy profile paths so the system has exactly one expressible Studio (the block system). No behavior change for existing block pages.

### Task 0.1 — Relocate `Skill` type before deleting its host

- Add to `src/components/tethyr/profile/types.ts` (next to the other exported profile types; verified it only imports from hooks/lib, never from `profile-layout.tsx`):
  ```ts
  export type Skill = { id: string; slug: string; name: string; category: string };
  ```
- Change `src/components/tethyr/profile/skill-editing.tsx:39` from `import type { Skill } from "./profile-layout"` to `import type { Skill } from "./types"`.

### Task 0.2 — Delete orphaned dead-end modules

- Delete:
  - `src/hooks/use-public-studio-layout.ts`
  - `src/lib/page-block-layout.ts`
  - `src/lib/page-block-layout.test.ts`
  - `src/hooks/use-project-scroll-spy.ts`
  - `src/hooks/use-project-scroll-spy.test.tsx`
- Grep repo for `usePublicStudioLayout|page-block-layout|useProjectScrollSpy|project-scroll-spy` to confirm zero references remain.

### Task 0.3 — Delete legacy profile components dead after the block system

Delete these files (all shown as unused by `npm run check:unused` baseline, plus the profile-layout host of `Skill`):

- `src/components/tethyr/profile/profile-layout.tsx` (after Task 0.1)
- `src/components/tethyr/profile/profile-projects-tab.tsx`
- `src/components/tethyr/profile/profile-activity-tab.tsx`
- `src/components/tethyr/profile/profile-sessions-tab.tsx`
- `src/components/tethyr/profile/profile-communities-tab.tsx`
- `src/components/tethyr/profile/profile-reviews-tab.tsx`
- `src/components/tethyr/profile/about-card.tsx`
- `src/components/tethyr/profile/text-card.tsx`
- `src/components/tethyr/profile/links-card.tsx`
- `src/components/tethyr/profile/chip-list-card.tsx`
- `src/components/tethyr/profile/timeline-card.tsx`
- `src/components/tethyr/profile/public-studio-workspace.tsx`
- `src/components/tethyr/profile/studio-direction.tsx`

Then, driven by an import graph grep (`rg "from \"./profile[^\"]*\"|projects-card|project-library-add-dialog|ChipListCard|TimelineCard|ProjectsCard|ProjectLibraryAddDialog|SectionCard|ActivityRow"`), prune the cascade (graph verified on 2026-09-01):

- Delete `projects-card.tsx` and `project-library-add-dialog.tsx` — after the tab deletions their only remaining importer is the `index.ts` re-export itself (verified: `ProjectsCard` ← profile-projects-tab only; `ProjectLibraryAddDialog` ← projects-card only).
- Delete `chip-list-card.tsx` and `timeline-card.tsx` — only re-exported, no concrete importers (check:unused baseline already flags `ChipListCard`/`TimelineCard`).
- Prune from `src/components/tethyr/profile/index.ts`: `ChipListCard`, `ProjectsCard`, `ProjectLibraryAddDialog`, `TimelineCard`.
- KEEP (verified live importers):
  - `SectionCard` + `Field` in `section-card.tsx` — `SectionCard` imported by `skill-editing.tsx`; `Field` imported by `project-dialog.tsx`. (`dashboard.tsx` has its own local `SectionCard`.)
  - `ActivityRow` in `types.ts` + its `index.ts` re-export — imported by `src/hooks/use-current-user.ts:7` via `profile-sections`.
  - `BannerStrip` (dashboard, profile route via profile-sections, u.$handle direct), `ProjectDialog` (create-project-button), badges/types in `index.ts`.

### Task 0.4 — Remove legacy fallback from `u.$handle.tsx`

- Delete the legacy identity-card branch, `StudioDirection`, `PublicStudioWorkspace`, and the `showLegacyPublicView` / `blocksArePage` split.
- When `!blocksArePage && isOwner` → the PageShell already routes to a block page (auto-created page keeps `sections: []` → PageShell's "Your page is empty" state). When `!blocksArePage && !isOwner` → render a graceful empty state (e.g. "This studio hasn't published anything yet.").
- Prune unused imports (BannerStrip, StudioDirection, PublicStudioWorkspace, FavoriteBadge, ReputationBreakdown, connect/follow/copy buttons, MapPin/Clock/Languages, MessageCircle). Keep `themeTokensToStyle`, `useDominantColor`, `BackgroundLayer`, `appearanceStyle`.
- Keep the existing `Shell` + header behavior (project-workbench test coverage of banner/shell renders must stay green).

### Task 0.5 — Verify + commit

- `npm run verify` green; `bash scripts/base44-start.sh` still serves 200.

---

## Phase 1 — Config storage + `studio-config` core (with tests)

### Task 1.1 — Migrations

- Create `supabase/migrations/20260901150000_studio_config.sql`:
  ```sql
  ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
  ```
- Create `supabase/migrations/20260901150100_drop_public_studio_layout.sql`:
  ```sql
  ALTER TABLE public.profiles DROP COLUMN IF EXISTS public_studio_layout;
  ```
- Kill supabase → `npx supabase start` → regenerate `src/integrations/supabase/types.ts` (fresh `npx supabase gen types typescript`).

### Task 1.2 — `src/lib/studio-config.ts`

Exports:

- `type RadiusTreatment = 'sharp' | 'soft' | 'rounded'`
- `type TypographyTreatment = 'editorial' | 'modern' | 'classic'`
- `type Density = 'compact' | 'comfortable' | 'spacious'`
- `type AccentMode = 'auto' | 'person' | 'none'`
- `interface StudioConfig { personalityId: string | null; radius: RadiusTreatment; typography: TypographyTreatment; density: Density; accentMode: AccentMode; accentColor: string | null }`
- `DEFAULT_STUDIO_CONFIG: StudioConfig = { personalityId: null, radius: 'soft', typography: 'modern', density: 'comfortable', accentMode: 'auto', accentColor: null }`
- `RADIUS_OPTIONS`, `TYPOGRAPHY_OPTIONS`, `DENSITY_OPTIONS`, `ACCENT_OPTIONS` (labeled Sharp/Soft/Rounded, Editorial/Modern/Classic, Compact/Comfortable/Spacious, Auto/Choose/None)
- `normalizeStudioConfig(raw: unknown): StudioConfig` — defensive; per-field membership checks fell to defaults (used by `usePage`).
- `studioConfigToThemeTokens(config): ThemeTokens`:
  - radius maps (sm,md,lg,xl,2xl,3xl,4xl): sharp `{1,2,3,4,4,5,6}`, soft `{2,3,4,5,5,6,8}` (current), rounded `{4,6,8,12,14,16,18}`
  - editorial → `typography.headingFont` = `'Space Grotesk, ui-sans-serif, system-ui, sans-serif'` + `scale.heading1 { fontSize: 'clamp(2.5rem,5vw,4.5rem)', lineHeight: '1.05', fontWeight: '600' }`
  - classic → `scale.heading1 { fontSize: 'clamp(1.875rem,3.5vw,2.5rem)', lineHeight: '1.15', fontWeight: '500' }`
  - modern → no typography tokens
  - `spacing.section`: compact `2.5rem`, comfortable `4rem`, spacious `6rem`
- `studioConfigToStyle(config): React.CSSProperties & Record<string, string>`:
  - accentMode `person` → `--user-accent` = accentColor, `--user-accent-foreground` = duplicated `contrastingHexForeground` formula (luminance > 0.56 → `#1f2328` else `#ffffff`), plus subtle/border/glow `color-mix(in oklab, {color} 10%/30%/6%, transparent)`
  - accentMode `none` → `--user-accent: var(--primary)`, `--user-accent-foreground: var(--primary-foreground)`, neutral mixes
  - density → `--content-density-gap` + `--content-density-padding` (`0.75rem` / `1rem` / `1.5rem`)
- Type-only import of `ThemeTokens` from `./page-blocks` (safe cycle: studio-config never imported by page-blocks).

### Task 1.3 — `src/lib/studio-config.test.ts`

- normalize: garbage → defaults; partial → filled; unknown members → defaults.
- radius/token merges per treatment; density spacing; accent `person` emits foreground via luminance; `none` neutral.

---

## Phase 2 — Personality catalog (with tests)

### Task 2.1 — `src/lib/studio-personalities.ts`

- `import { createDefaultProfileLayout }`-style helpers: local `nid()`/`blk()` mirrors (do not mutate `default-layouts.ts` helpers cross-file).
- `type StudioPersonality = { id: string; label: string; description: string; composition(): PageLayout; appearance: Pick<StudioConfig, 'radius'|'typography'|'density'|'accentMode'|'accentColor'>; themeTokens: Partial<ThemeTokens> }`
- `applyStudioPersonality(personality) → { layout, config, themeOverrides }` (config from appearance + `personalityId`)
- Exported `STUDIO_PERSONALITIES` (4) + `getStudioPersonality(id)`:
  1. `minimal` — "quiet focus on the work"; single-column: `[full profile-header][full profile-projects:minimal-list][full profile-bio][full profile-skills][full profile-links]`; sharp/classic/spacious/auto
  2. `creative` — "image-led gallery space"; `[featured_work profile-projects:spotlight + profile-direction][image_lead profile-gallery + profile-bio][asymmetric profile-skills + profile-experience][full profile-links]`; soft/editorial/comfortable/auto
  3. `professional` — "structured credibility"; `[full profile-header][featured_work profile-projects:editorial-grid + profile-direction][two_column profile-skills + profile-links][compact_list profile-achievements]`; sharp/modern/compact/none
  4. `artistic` — "deliberately experimental"; `[image_lead profile-header + profile-gallery][asymmetric profile-bio + profile-direction][full profile-projects:horizontal-scroll][full profile-links]`; rounded/editorial/spacious/person (accentColor `#6d28d9`)
- Compositions reference the new layouts (Phase 3) — order phases so grid strings exist first.

### Task 2.2 — `src/lib/studio-personalities.test.ts`

- 4 presets exist with expected id/label; `getStudioPersonality` fallback; apply → config.personalityId set + layout has expected sections.

---

## Phase 3 — Section compositions + spacing var

### Task 3.1 — `src/components/tethyr/page/page-layout.tsx`

- Add to `SectionLayoutType` (in `src/lib/page-blocks.ts`): `'featured_work' | 'asymmetric' | 'split' | 'image_lead' | 'compact_list'`
- Add `SECTION_GRID` entries (existing strings stay):
  - `featured_work: 'grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]'`
  - `asymmetric: 'grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]'`
  - `split: 'grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'`
  - `image_lead: 'grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'`
  - `compact_list` → `''` (single column).
- Change section padding to use the density-driven spacing var: `py-[var(--spacing-section)]` (replaces `py-8 … sm:py-10`). For `split`/`image_lead`/`featured_work` whitespace-led layouts, drop the `border-b border-border/35` divider.

### Task 3.2 — `src/styles.css`

- Add `--spacing-section: 4rem;` to both `:root` and `.dark` blocks (so the var always resolves; density overrides via studio config tokens).

---

## Phase 4 — Data wiring

### Task 4.1 — `src/hooks/use-page.ts`

- Add `config` to the select + `PageRow`.
- Return `config: normalizeStudioConfig(row.config)` on `PageData`.

### Task 4.2 — `src/lib/page-blocks.ts`

- `PageData` gains `config: StudioConfig` (type-only import from `./studio-config`).

### Task 4.3 — `src/hooks/use-page-editor.ts`

- Add `useUpdatePageConfig({ pageId, config })` → `pages.update({ config: config as unknown as Json })` (import `Json` from `@/integrations/supabase/types`); onSuccess `invalidates(['page', …])` via existing `invalidatePage`.

### Task 4.4 — `src/components/tethyr/page/page-shell.tsx`

- `containerStyle` → `themeTokensToStyle(deepMergeTokens(page.theme ?? {}, studioConfigToThemeTokens(page.config)))` then `...studioConfigToStyle(page.config)`.
- Non-owner + `status !== 'published'` still returns `null` (existing behavior); owner empty page keeps the creating/empty states.

---

## Phase 5 — Studio UI components (new dir `src/components/tethyr/studio/`)

All follow `theme-picker.tsx`'s panel shell: `relative mb-4 rounded-xl border border-card-border bg-surface-elevated p-4`, ghost close button, uppercase section-label heading.

### Task 5.1 — `composition-picker.tsx`

- `CompositionPicker({ page, onClose, onApply })`: lists `STUDIO_PERSONALITIES` as buttons (label + description); if `page.config.personalityId` non-null, confirms (Dialog) before destructive apply; calls `applyStudioPersonality` → `onApply({ layout, config })`.

### Task 5.2 — `personality-picker.tsx`

- `PersonalityPicker({ page, onClose, onApply })`: same preset catalog but non-destructive — applies only appearance + themeTokens (config). Confirm dialog only when replacing an existing personalityId (spec §4.1 `manual`-flag alternative: deterministic confirm).

### Task 5.3 — `appearance-panel.tsx`

- Segmented control per setting: Radius (Sharp/Soft/Rounded), Typography (Editorial/Modern/Classic), Density (Compact/Comfortable/Spacious), Accent (Auto/Person/None).
- Accent = Person → show native color input (live preview). Immediate `onChange(partialConfig)`; `personalityId` untouched (edits detach from preset).

### Task 5.4 — `inline-inspector.tsx`

- `InlineInspector({ block, context, onClose, onChange })`: fixed right-side floating panel (`fixed right-3 top-24 z-50 w-72 max-h-[70vh] overflow-y-auto`).
- Renders each `BlockField.definition.fields` by type: text → `Input`, textarea → `Textarea`, toggle → `button role="switch"` with `aria-checked` + label (no Switch UI exists; do not install), select → segmented buttons (or `ui/select`), image → URL input + preview, color → native input.
- Persist-on-change via `onChange(blockId, newConfig)` (existing `PageShell.handleBlockConfigChange` path); "Reset to defaults" + "Remove block" footer buttons.
- Add a "Presentation" select for `profile-projects` blocks when `presentation` field exists.

### Task 5.5 — `project-presentation.tsx`

- Small catalog for the profile block (do NOT touch `src/lib/project-presentation.ts`, which is project-page arrangement): `PROFILE_PROJECT_PRESENTATIONS = spotlight | editorial-grid | horizontal-scroll | minimal-list` with labels + description.

---

## Phase 6 — Editor flow + toolbar

### Task 6.1 — `editor-toolbar.tsx`

- New panel states: `showComposition`, `showPersonality`, `showAppearance` (alongside existing `showPicker`, `showThemePicker`, `showApplyPanel`).
- Visual flow chips (existing hidden-sm copy becomes visible stage label in the non-edit banner): `Create → Customize → Personalize → Arrange → Preview → Publish`.
- Edit toolbar: keep Add section / Preview / Publish / Unpublish / Save layout; add "Composition" (GalleryHorizontalEnd → `showComposition`, renders `CompositionPicker`), "Vibe" (Palette → `showPersonality`), "Appearance" (SlidersHorizontal → `showAppearance`).
- Wire `onApply` for composition (full apply, then `refetch`) and personality (config-only apply).

### Task 6.2 — `sortable-block.tsx`

- `Settings2` `onConfigure` now opens `InlineInspector` (replaces the no-op passthrough). Inspector state lives in `page-layout.tsx` (or lifted to PageShell) keyed by `selectedBlockId`; onBlockConfigChange flows through existing `onBlockConfigChange` prop.

---

## Phase 7 — Profile block expression pass

### Task 7.1 — `header-block.tsx`

- Add `variant` select field (`stack | row | cover`, default `row`):
  - `stack`: centered column hero (avatar, name, handle) under banner
  - `row`: current side-by-side identity
  - `cover`: full-bleed banner area with identity overlaid (accent gradient scrim)

### Task 7.2 — `projects-block.tsx`

- Add `presentation` select field (default `spotlight`) from Task 5.5 catalog.
- Implement 4 variants (query already returns `title, description, status, progress_percent, cover_url`):
  - `spotlight`: one large featured card + compact supporting list
  - `editorial-grid`: asymmetric first-large grid
  - `horizontal-scroll`: `overflow-x-auto` flex row of cards
  - `minimal-list`: dense rows (title + role + status)
- Empty edit placeholder unchanged; blocks remain containerless-safe.

### Task 7.3 — polish pass (smallest changes)

- Ensure bio/skills/links/gallery/direction/achievements blocks read as composed sections, not cards-in-rows; adjust container and whitespace only where the new layouts expose awkward gaps. No new card containers.

---

## Phase 8 — Public single-path + final verify

### Task 8.1 — `u.$handle.tsx` empty-state check

- Confirm Phase 0 removal left the PageShell path as the ONLY path; verify visitor + unpublished → empty state; visitor + published → `PageLayoutRenderer` (not editable).

### Task 8.2 — Final verification

- `npm run verify` green.
- `curl -H "Host: x" http://localhost:3000/` → 200.
- Browser: `/profile` → Customize → apply a personality → publish → `/u/<handle>` shows composed blocks with spacing/accent; toggle Appearance+Inline table while editing; confirm flow on re-apply.
- New gitignored `.env.supabase-runtime` left untouched; commit only source.

---

## Task Sizes

All tasks above are 5-45 min, single-unit, no dependencies beyond declared Phase ordering. No task branches.
