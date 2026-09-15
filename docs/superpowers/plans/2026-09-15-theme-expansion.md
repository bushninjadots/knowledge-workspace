# Theme Expansion Plan

**Date:** 2026-09-15
**Status:** Complete — all three tasks shipped on `design/studio-dual-accent` and merged to `main`.
**Scope:** Three related changes to theming and Studio creator

---

## Task 1: Remove Starter/Template UI from Studio Editor

**Goal:** Keep the template picker at Studio creation time only. Remove it from the live Studio editor.

### Changes

**`src/components/tethyr/studio/g-studio-surface.tsx`:**
- Remove `StarterPicker` import (line 67-70)
- Remove `starterOpen` state (line 383)
- Remove `onFeel` prop from `GCustomizePanel` (line 161) and all call sites (lines 457, 494, 544, 551, 577, 606)
- Remove `onChooseStarter` prop (line 161)
- Remove StarterPicker from canvas area (lines 546-552)
- Remove "Starting point" section from GCustomizePanel (lines 2279-2281, 2311-2323, 2315-2318)
- Remove `onFeel` from GMobileEditSheet (lines 2676, 2894)

**`src/components/tethyr/studio/studio-view.tsx`:**
- Remove `starterChosen` prop (lines 284-285, 698, 710, 738)

**`src/components/tethyr/studio/creation-studio.tsx`:**
- Keep `introStarterOpen` dialog (creation-time only)
- Keep `chooseStarter` callback and `StarterPicker` rendering (lines 921-924, 1058-1073)

**Keep unchanged:**
- `src/data/starters.ts` — needed by creation flow
- `src/components/tethyr/studio/starter-picker.tsx` — needed by creation flow
- `src/lib/studio-config.ts` — `starterId` field stays as `string | null` (DB compat)

### Verification
- ✅ Run tests, typecheck
- ✅ Verify StarterPicker still appears on first Studio creation
- ✅ Verify StarterPicker does NOT appear in Studio editor customize panel or header

---

## Task 2: Global Theme Presets in Top Navbar

**Goal:** Expand the ThemeToggle dropdown to include premade theme presets alongside Light/Dark/System.

### Current state
- `ThemeToggle` (`src/components/tethyr/theme-toggle.tsx`) — 3-option dropdown (Light/Dark/System)
- `ThemeProvider` (`src/lib/theme.tsx`) — manages dark/light class on `<html>`, persists to `localStorage["tethyr-theme"]`
- DB has 13 seeded themes (`themes` table) with full CSS token palettes (colors, fonts, radii, shadows)
- `useTheme(themeId)` (`src/hooks/use-theme.ts`) — fetches theme tokens, applies via `themeTokensToVars()`
- Currently DB themes are per-page (via `page_settings.themeId`), not global

### Design

Expand `ThemeToggle` into a two-section dropdown:
1. **Mode** section: Light / Dark / System (existing)
2. **Style** section: Theme presets from DB (Minimal, Developer, Terminal, Paper, Brutalist, Glass, Retro, Cyberpunk, Academic, Nature, Studio, Sunset, Midnight)

When a preset is selected:
- Set the dark/light mode (same as today)
- Store the theme ID in `localStorage["tethyr-theme-preset"]`
- Apply theme tokens at the app level (ThemeProvider reads and applies them)

### Changes

**`src/lib/theme.tsx`:**
- Add `themePreset: string | null` to `ThemeContextValue`
- Add `setThemePreset(id: string | null)` to context
- Read `localStorage["tethyr-theme-preset"]` on init
- When a preset is active, expose its ID so consumers can apply tokens

**`src/components/tethyr/theme-toggle.tsx`:**
- Import `useQuery` + supabase client to fetch available themes
- Add second section in dropdown: "Style" with theme preset options
- Each preset shows a small color dot preview (extracted from its tokens)
- Active preset gets the same `bg-learning` dot indicator
- "Default" option at top of Style section clears the preset (returns to system tokens)

**`src/components/tethyr/authenticated-shell.tsx`:**
- Read `themePreset` from `useTheme()`
- When preset is active, apply `themeTokensToVars(tokens, resolvedTheme)` to the shell root div
- Fetch tokens via the existing `useTheme(themePreset)` hook
- Merge with existing `paletteToStyle()` + `appearanceStyle()` (preset tokens override CSS defaults, user accent overrides preset accent)

**`src/routes/__root.tsx`:**
- No changes needed — ThemeProvider already wraps the app

### Token precedence (top to bottom wins)
1. User accent tokens (`--user-accent-*`) from `appearanceStyle()` / `paletteToStyle()`
2. Theme preset tokens from DB (`themeTokensToVars()`)
3. CSS defaults in `styles.css`

### Persistence
- `localStorage["tethyr-theme"]` — dark/light/system (unchanged)
- `localStorage["tethyr-theme-preset"]` — theme ID or null (new)
- `localStorage["tethyr-theme-preset-vars"]` — cached CSS-var map replayed by the pre-hydration init script, so the chosen preset paints on the very first frame

### Status
- ✅ Shipped: `themePreset` context state, Style section in the ThemeToggle dropdown, `GlobalThemePreset` applier on `<html>`, cached-var replay in `themeInitScript`.

---

## Task 3: Dual-Color Accent in Studio Creator

**Goal:** Add a "dual" accent mode to the Studio Creator where one color derives from the banner and the other is user-chosen.

### Current state
- Studio config: `accentMode: "auto" | "custom" | "none"`, `accentColor: string`
- `studioConfigToStyle()` in `studio-config.ts` (lines 385-429) — sets `--user-accent-*` vars
- "auto" = banner-derived accent, "custom" = user-picked hex, "none" = falls back to `var(--primary)`

### Design

Add `accentMode: "dual"` option:
- `accentColor` = the user-chosen primary accent (used for interactive elements: buttons, active states, highlights)
- Banner-derived color becomes the secondary accent (used for background tints, subtle surfaces)
- New CSS vars: `--user-accent-secondary` + derived subtle/border/glow

**UI split:**
- Primary accent (`--user-accent`): hover borders, active chips, button highlights, nav indicators
- Secondary accent (`--user-accent-secondary`): page background tint (via background-layer), card fill tints, section dividers

### Changes

**`src/lib/studio-config.ts`:**
- Add `"dual"` to `AccentMode` type (line 40)
- Update `ACCENT_OPTIONS` to include `{ value: "dual", label: "Dual colors", description: "Banner + custom accent" }`
- Update `studioConfigToStyle()`: when `accentMode === "dual"`, set primary from `accentColor` and secondary from banner color (passed as parameter or read from DOM)
- Export new CSS vars: `--user-accent-secondary`, `--user-accent-secondary-subtle`, `--user-accent-secondary-border`

**`src/lib/background-themes.ts`:**
- `accentVarsFromColor()` — unchanged (generates 5 vars from a single hex)
- Add `secondaryAccentVarsFromColor(color: string)` — same logic but prefixed with `--user-accent-secondary`
- `appearanceStyle()` — when `accentMode === "dual"`, set primary from `accentColor` and secondary from `background.color`

**`src/components/tethyr/studio/g-studio-surface.tsx`:**
- Update `GCustomizePanel` accent section: add "Dual" option alongside Auto/Custom/None
- When "Dual" is selected, show the accent color picker (same as Custom) + note that the banner provides the second color

**`src/components/tethyr/background-layer.tsx`:**
- Use `--user-accent-secondary-subtle` for the background tint when available (instead of `--user-accent-subtle`)
- This means the background tint uses the banner-derived color while interactive elements use the user-chosen accent

**`src/components/tethyr/project-shelf/project-shelf-cover.tsx`:**
- `ownerAccentStyle()` — when dual mode, use primary accent for hover border, secondary for card fill hint

**`src/styles.css`:**
- Add default values for `--user-accent-secondary` vars (same pattern as existing accent defaults)

### Files touched
- `src/lib/studio-config.ts` — type + options + style generation
- `src/lib/background-themes.ts` — secondary accent helper + appearanceStyle dual branch
- `src/components/tethyr/studio/g-studio-surface.tsx` — customize panel UI
- `src/components/tethyr/background-layer.tsx` — secondary accent for background tint
- `src/components/tethyr/project-shelf/project-shelf-cover.tsx` — dual accent in explore cards
- `src/styles.css` — CSS defaults for secondary vars
- Tests: `studio-config.test.ts`, `background-themes.test.ts`

### Status
- ✅ Shipped as `accentMode: "dual"` ("Banner + colour"), replacing the redundant `"auto"` option with a legacy migration (`"auto"` → `"dual"`).

---

## Execution Order

1. **Task 1** (template removal) — bounded, fast, no dependencies
2. **Task 2** (navbar theme presets) — needs DB theme query infrastructure
3. **Task 3** (dual-color accent) — builds on Task 1's cleaned-up Studio

Each task shipped on its own branch and was merged into `main` via
`design/studio-dual-accent`. The `/templates` routes and hooks were deleted in
the same pass so the Studio customize panel is the single appearance surface.
