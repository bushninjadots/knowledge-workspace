# Studio Expressive Redesign — Design Spec

**Date:** 2026-09-01
**Status:** Approved direction (Approach A — evolve the block system into an expressive Studio system)

## 1. Summary

Tethyr Studio is the single, primary expression of a person on Tethyr. Today it is
structurally capable but visually timid: the block system renders generic cards in
2-3 column grids. This redesign gives Studio an **expression layer** on top of the
existing block architecture, delivering the brief's core promise:

> **One Studio system. Infinite personalities.**

The user flow stays exactly as the brief defines it:
**Create → Customize → Personalize → Arrange → Preview → Publish**

The owner Studio and public Studio become the **same page** — the owner view is the
public view plus contextual inline editing controls. No more two-website drift.

## 2. Goals

1. Make Studio feel like a **personal creative space**, not a dashboard or a wall of cards.
2. Give every person a distinct visual identity through layout, projects, typography, accent, and density.
3. Keep all of it behind the existing block system (no throwaway architecture).
4. Delete every dead-end / legacy path and leave **one** Studio rendering path.
5. Structured freedom: the system offers design _choices_ (presets, compositions), not endless settings.

## 3. Non-Goals

- No new `/studio` route. Private Studio stays at `/profile`.
- No freeform pixel canvas. Freeform was the "Creation Studio mess" — rejected.
- No full-screen wizard. Customization is inline on the Studio page itself.
- No new persistence system. Everything reuses `pages` / `layouts` / `blocks` / `themes`.

## 4. Data Model Changes

### 4.1 New: `pages.config` JSONB

Add a `config` JSONB column (default `'{}'`) to `pages` in a new forward-only migration.
Holds the user's Studio-level decisions:

```ts
// src/lib/studio-config.ts (new)
type RadiusTreatment = "sharp" | "soft" | "rounded";
type TypographyTreatment = "editorial" | "modern" | "classic";
type Density = "compact" | "comfortable" | "spacious";
type AccentMode = "auto" | "person" | "none";

interface StudioConfig {
  personalityId: string | null; // 'minimal' | 'creative' | 'professional' | 'artistic' | null (custom)
  radius: RadiusTreatment; // default 'soft'
  typography: TypographyTreatment; // default 'modern'
  density: Density; // default 'comfortable'
  accentMode: AccentMode; // default 'auto'
  manual: boolean; // true once the user arranges/customizes beyond the applied preset;
  // when set, re-applying a personality shows a confirmation first
}
```

- Missing / empty config → defaults, i.e. current behavior (backward compatible).
- `config.personalityId` is _intent_; the _applied_ result lives in layout + themeOverrides.
- All appearance values (`radius`, `typography`, `density`, `accentMode`) are **independently tunable** after any personality is applied.

### 4.2 Migration list

| Migration                                      | Action                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `20260901150000_studio_config.sql`             | `ALTER TABLE pages ADD COLUMN config jsonb NOT NULL DEFAULT '{}'`                                 |
| `20260901150100_drop_public_studio_layout.sql` | `ALTER TABLE profiles DROP COLUMN IF EXISTS public_studio_layout` (reverse of the legacy restore) |

### 4.3 Types to add / extend in `src/lib/page-blocks.ts`

Extend `SectionLayoutType` with the new compositions:

```ts
type SectionLayoutType =
  | "full"
  | "two_column"
  | "three_column"
  | "sidebar_left"
  | "sidebar_right"
  | "feature"
  | "side_by_side" // existing
  | "featured_work"
  | "asymmetric"
  | "split"
  | "image_lead"
  | "compact_list"; // new
```

## 5. Architecture

### 5.1 New modules

**`src/lib/studio-personalities.ts`** — the preset catalog.

```ts
interface StudioPersonality {
  id: string; // 'minimal' | 'creative' | 'professional' | 'artistic'
  label: string;
  description: string; // one line, used in the picker
  composition: () => PageLayout; // blueprint builder (full section composition)
  appearance: StudioConfig; // radius / typography / density / accentMode
  themeTokens: Partial<ThemeTokens>; // token adjustments (e.g. display font, heading color)
}

const STUDIO_PERSONALITIES: StudioPersonality[];
```

Four presets, one per brief personality:

- **Minimal** — typography + whitespace. Single column, generous spacing, thin borders,
  muted accent, sharp-soft radius, editorial typography.
- **Creative** — imagery + asymmetric layouts. Featured work + gallery-led, offset grids,
  stronger accent, soft radius, modern typography.
- **Professional** — structured project presentation. Clean grid, dense but ordered,
  neutral accent, sharp radius, classic typography.
- **Artistic** — experimental composition + visual storytelling. Split + image_lead,
  generous density, distinctive accent, editorial typography.

`applyPersonality(personality, existingPage?): { layout: PageLayout, config: StudioConfig, overrides: Partial<ThemeTokens> }`
— builds the target composition fresh and returns the appearance settings. **Applied
destructively to the layout only when explicitly chosen** (with confirmation if the user
has already customized). Appearance settings persist independently after apply.

**`src/lib/studio-config.ts`** — types (above), `DEFAULT_STUDIO_CONFIG`, `studioConfigToTokens(config)`
(radius/typography/density/accent → CSS override tokens via `deepMergeTokens`), and
`studioConfigToCss(config)` producing the `--studio-*` CSS custom-property overrides.

**`src/components/tethyr/studio/`** (new directory) — Studio-specific UI:

- `personality-picker.tsx` — "Start from a vibe": grid of 4 preset cards with live
  MiniPreview-style swatches; one tap applies composition + appearance.
- `appearance-panel.tsx` — visual controls: Radius (`Sharp | Soft | Rounded`),
  Typography (`Editorial | Modern | Classic`), Density (`Compact | Comfortable | Spacious`),
  Accent (`Auto | Person | None`). Live preview styling applied to the page behind it.
- `inline-inspector.tsx` — floating contextual panel opened by clicking a block in edit
  mode. Renders the block's `fields` (existing `BlockField` system) plus any block-specific
  presentation options (e.g. the projects presentation picker) and a remove button.
  Positioned beside the target block; closes on outside click / Escape.
- `composition-picker.tsx` — section-level layout selector with visual previews (actual
  mini grid diagrams, not `Layout: Grid-3` labels).
- `project-presentation.tsx` — the picker for a projects block's presentation style,
  with thumbnail previews of each style.

### 5.2 Extended existing modules

**`src/components/tethyr/page/page-layout.tsx`** — extend `SECTION_GRID` with the new
compositions:

| Layout          | Grid                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| `featured_work` | `md:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]` with first block large / offset |
| `asymmetric`    | `md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]` alternating on odd sections         |
| `split`         | `md:grid-cols-2` with tighter gap, optional equal leading trim                       |
| `image_lead`    | `md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]` image block first                   |
| `compact_list`  | single column, dense rows                                                            |

Composition-aware section chrome: featured_work / split / image_lead drop the
`border-b border-border/35` divider and use whitespace instead; asymmetric alternates
the dominant column.

**`src/components/tethyr/page/editor-toolbar.tsx`** — evolve into the 6-stage flow:
**Create** (setup already done at route level) → **Customize** (compositions, projects
presentation) → **Personalize** (vibe presets + appearance) → **Arrange** (add/reorder
blocks) → **Preview** (stop editing) → **Publish**. The toolbar exposes: Add section,
Section composition, Vibe, Appearance, Preview, Publish. Non-edit state keeps the
`Create → Customize → Personalize → Arrange → Preview → Publish` guidance line.

**`src/components/tethyr/page/theme-picker.tsx`** — unchanged in role; receives the
resolved appearance tokens as base so a chosen theme layers on top of personality
appearance.

**`src/hooks/use-page-editor.ts`** — add `useUpdatePageConfig` (+ `useUpdatePageAppearance`)
mutations writing `pages.config`; extend `usePage`/`PageData` with `config: StudioConfig`.

**`src/components/tethyr/page/sortable-block.tsx`** — click opens the inline inspector
(alongside existing move/remove/drag controls).

### 5.3 Redesigned profile blocks (editorial visual language)

All 10 profile blocks get an expression pass in place. Guidelines per block:

| Block                  | Expression changes                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile-header`       | Hero intent: optional large display type for name, banner bleeds full-bleed, avatar + name + handle composed as an identity stack, layout variant option (`stack` / `row` / `cover`)                                                                          |
| `profile-bio`          | Editorial prose styling; longer line measure, larger lead paragraph when configured                                                                                                                                                                           |
| `profile-direction`    | Keep 3-up but as bordered stats/sections separated by spacing not cards                                                                                                                                                                                       |
| `profile-experience`   | Timeline treatment (left rule + dots) instead of card list                                                                                                                                                                                                    |
| `profile-skills`       | Grouped, two-tier hierarchy (teach louder than learn); not a wall of tags                                                                                                                                                                                     |
| `profile-projects`     | **Presentation styles** — new `presentation` config: `spotlight` (one large featured + supporting list), `editorial-grid` (asymmetric first-large grid), `horizontal-scroll` (scroll row), `minimal-list` (dense rows). Default: `spotlight` on fresh Studios |
| `profile-tools`        | Inline with skills hierarchy; quieter swatch treatment                                                                                                                                                                                                        |
| `profile-links`        | Inline footer band, not a card                                                                                                                                                                                                                                |
| `profile-achievements` | Gallery strip; badges as small medallions                                                                                                                                                                                                                     |
| `profile-gallery`      | Masonry / asymmetric evidence shelf, image-first                                                                                                                                                                                                              |

Block `fields` gain presentation-type options where relevant (select fields with
`options`). `BlockDefinition` already supports `select` fields — no schema change needed.

### 5.4 Single Studio path

**`src/routes/u.$handle.tsx`** — remove the legacy fallback. Rendering becomes:

- owner or page exists → `EditModeProvider` + `PageShell` (owner gets edit controls, visitor doesn't);
- no page yet (visitor) → tasteful empty state ("hasn't published their Studio yet");
- `BackgroundLayer` + Back header stay.

**`src/routes/_authenticated/profile.tsx`** — keep the setup form (<40% completeness =
"Create" stage) and the `PageShell` owner Studio. Wire the toolbar's new stages.

## 6. Flow: Create → Customize → Personalize → Arrange → Preview → Publish

1. **Create** — profile setup form (unchanged): identity, banner, avatar, skills, links.
2. **Customize** — inline inspectors: section compositions (visual picker), project
   presentation styles, per-block fields. All live on the page.
3. **Personalize** — Vibe picker (4 presets) sets composition + appearance in one tap;
   Appearance panel lets radius/typography/density/accent drift independently.
4. **Arrange** — existing block add/move/remove/drag-between-sections (unchanged).
5. **Preview** — stop editing; the page is already WYSIWYG so preview is just leaving edit mode.
6. **Publish** — existing publish/unpublish in the toolbar; published Studio is the public page.

## 7. Data Flow

- `PageShell` reads `page.config` (now part of `PageData`). On load it applies:
  `themeTokens` (from theme) → merged with `themeOverrides` → merged with
  `studioConfigToTokens(page.config)` → CSS custom properties for the page.
- Personality apply: `applyPersonality()` builds a new layout + appearance; a single
  mutation persists `layout` + `config` + `themeOverrides`. Confirmation dialog shown
  when `config.manual === true` (user already customized) to avoid silently wiping work.
- Section composition change: `useUpdatePageLayout` — no new persistence.
- Inline inspector edits: `handleBlockConfigChange` (existing) routes through the
  inspector instead of a generic panel.
- All failures revert optimistically and surface the existing toast pattern.

## 8. Error Handling

- Config/appearance save failures → rollback + toast (existing optimistic patterns).
- Personality apply failure → keep current layout, toast, no partial state.
- Malformed `pages.config` JSONB → treated as `{}` defaults (never crashes render).
- Unknown presentation / personality ids in persisted data → fall back to defaults.

## 9. Testing

- **Unit:** `studio-config` (defaults, token mapping, css mapping), `studio-personalities`
  (apply builds valid layout, non-destructive defaults), composition grid map, project
  presentation defaults. Update any default-layout snapshot expectations.
- **Component:** inline inspector open/close + field edit; appearance panel live application;
  personality picker apply (fresh vs customized confirmation).
- **Manual verify:** `npm run verify` + browser smoke (`tests/`), plus the local stack
  (`bash scripts/base44-start.sh`) with `curl` checks on `/profile` and `/u/<handle>`.

## 10. Cleanup & Dead-End Removal (do this FIRST, as its own commit)

Delete the following (no source references may remain):

1. `src/hooks/use-public-studio-layout.ts` (orphaned; reads dropped column)
2. `src/lib/page-block-layout.ts` + `src/lib/page-block-layout.test.ts`
3. `src/hooks/use-project-scroll-spy.ts` + `src/hooks/use-project-scroll-spy.test.tsx`
4. `src/components/tethyr/profile/profile-layout.tsx` — **relocate its `Skill` type**
   (`{ id, slug, name, category }`) to `src/components/tethyr/profile/types.ts` (which
   already owns shared profile types) before deleting; importers are `profile-projects-tab.tsx`
   and `skill-editing.tsx`
5. Legacy editing cards: `about-card.tsx`, `text-card.tsx`, `chip-list-card.tsx`,
   `links-card.tsx`, `section-card.tsx`, `timeline-card.tsx`
6. Legacy tabs: `profile-projects-tab.tsx`, `profile-activity-tab.tsx`,
   `profile-sessions-tab.tsx`, `profile-communities-tab.tsx`, `profile-reviews-tab.tsx`
   (re-home any still-needed `Skill` shape first)
7. `src/components/tethyr/profile/public-studio-workspace.tsx`
8. `src/components/tethyr/profile/studio-direction.tsx`
9. `u.$handle.tsx` legacy fallback block (`showLegacyPublicView`, `PublicStudioWorkspace`,
   `StudioDirection` usage)
10. Migration `20260901150100_drop_public_studio_layout.sql` (drop the restored column)
11. Stale `.output/` Creation Studio artifacts — cleared by next build

Also grep-post-verify: `grep -r "public_studio_layout\|profile-layout\|PublicStudioWorkspace\|StudioDirection" src/` → zero matches.

## 11. Files Touched (index)

**New:** `src/lib/studio-config.ts`, `src/lib/studio-personalities.ts`,
`src/components/tethyr/studio/{personality-picker,appearance-panel,inline-inspector,composition-picker,project-presentation}.tsx`,
migrations `20260901150000_studio_config.sql`, `20260901150100_drop_public_studio_layout.sql`.

**Extended:** `src/lib/page-blocks.ts`, `src/components/tethyr/page/{page-layout,editor-toolbar,sortable-block,page-shell,theme-picker}.tsx`,
`src/hooks/use-page-editor.ts`, `src/lib/theme-tokens.ts`, `src/lib/default-layouts.ts` (defaults tuned to new expression),
all 10 `src/components/tethyr/blocks/profile/*.tsx`.

**Deleted:** the 25 files listed in §10.

## 12. Sequence

1. Cleanup commit (§10).
2. Migration for `pages.config` + drop column; regenerate Supabase types (`npx supabase gen types`).
3. `studio-config.ts` + `studio-personalities.ts` + unit tests.
4. Layout compositions (`page-layout.tsx`) + default-layout tuning.
5. Editor toolbar stages + composition picker.
6. Vibe picker + appearance panel + `useUpdatePageConfig`.
7. Inline inspector + sortable-block wiring.
8. Profile block expression pass.
9. `u.$handle.tsx` single-path + empty state.
10. Project presentation styles for `profile-projects`.
11. Verify: `npm run verify`, typecheck, local stack browser check.
