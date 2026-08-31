# Studio ↔ Profile Convergence Plan

> Date: 2026-08-31 · Status: DRAFT — design-review pass, no code changes yet.
> Owner: `_authenticated/profile.tsx`, `_authenticated/studio.tsx`, Studio block system.
> Follows [`../TETHYR_UX_RULES.md`](../TETHYR_UX_RULES.md) and the binding guardrails in [`../../AGENTS.md`](../../AGENTS.md).

## Purpose

Give **"Your Studio" a single owner** — the block-based Studio (`PageShell` + block
composition), which is the strategic direction in `TETHYR_PRODUCT.md` ("a profile is a
person's studio… projects and contributions dominate"). Remove the legacy tabbed
`ProfileLayout` "Manage" surface once the block composition can express everything that
surface does, so `/profile` stops being a compromise between two competing editing
models.

This is the work that will also shrink the `check:unused` baseline: most of the 189
tracked dead exports are legacy profile/tab surfaces orphaned by this transition.

## Primary goal

`/profile` renders the block composition (`PageShell`) as the **single** private Studio
view, and `ProfileLayout` is deleted entirely because nothing references it.

## Current issues

1. **Duplicate private surfaces** (already flagged by the "Remove duplicate private
   profile surfaces" work). `profile.tsx` currently branches into:
   - **custom** → `PageShell` (block-composition, the real Studio),
   - **setup** → legacy tabbed `ProfileLayout` ("Setup layout", the "Manage" fallback),
   - preview (`?preview=…`) → `PageShell`.
   - Plus an **unreachable `else`** branch that renders a *second* `ProfileLayout` with
     duplicated tab content (line ~317). This dead branch should be removed first.
2. **Two header toggle states** ("Setup layout" / "Customized") present the same profile
   through two different frameworks, which is exactly the "duplicate visual ownership"
   the constitution forbids.
3. `ProfileLayout` is also consumed by `studio.tsx` for its own manage view, so it cannot
   be deleted until the block composition covers those edits.
4. Several editing actions only live behind the legacy tabs today: direct profile-field
   editing (bio, title, links, favourite tools, software stack, teaching style, growth
   goals, GitHub connect, skills), projects/activity/sessions/communities readers.

## Information hierarchy (target)

Same as the public profile / Studio:
Level 0 header/identity → README-like intro → **work (projects/skills)** → extras
(links, activity, sessions, communities). Editing happens in-place via the block
inspector and block fields, not via a separated tab bar.

## Reuse

- `PageShell`, `EditModeProvider`, the Studio block registry and inspector.
- The editing primitives already stay as blocks/content: `AboutCard`, `TextCard`,
  `ChipListCard`, `LinksCard`, `GitHubConnect`, `SkillEditingSection`, `ProfileProjectsTab`,
  `ProfileActivityTab`, `ProfileSessionsTab`, `ProfileCommunitiesTab`.
- Existing hooks (`useCurrentUser`, `usePage`, `usePageEditor`) and the block field schema
  (`BlockField`) for moving legacy controls into inspector fields.
## Proposed information architecture

1. **Quick win (safe now):** delete the unreachable duplicate `ProfileLayout` `else`
   branch in `profile.tsx` and the now-dead `studioView`-`"setup"` fallback code path, so
   there is literally one live `ProfileLayout` render left (in `studio.tsx`).
2. **Gap analysis:** enumerate the legacy `ProfileLayout` capabilities and confirm each
   already has a block or a Studio-inspector field. Likely gaps: profile field editing
   (bio/title/links/tools/stack/teaching/growth) as editable block fields, and the
   projects/activity/sessions/communities readers as existing blocks. If a gap exists,
   port it into the block inspector — do **not** duplicate a tab surface.
3. **Converge `/profile`:** default `studioView` to the block composition; remove the
   `ProfileLayout` render in `profile.tsx`. Keep the single "Customize in Studio" CTA to
   `/studio`.
4. **Converge `studio.tsx`:** stop rendering `ProfileLayout` inside the Studio for its
   manage/setup view; route that flow through the same block composition.
5. **Delete `ProfileLayout`:** once no file references it, remove
   `src/components/tethyr/profile/profile-layout.tsx` and re-record the `check:unused`
   baseline (189 → smaller), deleting the now-orphaned legacy tab components and their
   dependencies.

## Scope

**Will change:** `_authenticated/profile.tsx`, `_authenticated/studio.tsx`, Studio
inspector/block-field wiring for profile editing, deleted `profile-layout.tsx` + orphaned
legacy tab/dependency files, baseline re-record, this plan → spec.

**Will NOT change (explicit):** the public profile route `u.$handle` (already block-based
and shipping), the block palette/registry, project spaces, or the design tokens. Do not
introduce new card containers or gradients just to fill the old tabs.

## State and responsive plan

- **Loading/empty/error:** keep `PageShell`'s existing `renderState` handling; confirm the
  new-user empty profile still shows strong defaults (per `TETHYR_PRODUCT` "strong
  defaults; customization optional").
- **Mobile:** the block composition already stacks; the legacy tab bar collapse disappears.
  Verify no long-tab overflow and that inspector-drawn fields are usable at 360px.
- **Keyboard / reduced-motion / a11y:** inspector fields inherit existing Studio a11y;
  confirm focus management and that no removed surface removed an accessible path to an
  action.

## Validation plan

1. `tsc --noEmit`, `eslint .`, `prettier --check`, full `vitest` suite.
2. `npm run check:unused` — expect the baseline to shrink further after each removal step.
3. Route smoke (`npm run smoke`) for `/profile`, `/studio`, `/u/$handle`.
4. Browser check at desktop + mobile widths: create a user, edit fields in Studio, save,
   confirm the public profile reflects it; run the existing authenticated browser smoke if
   available.
5. A11y/keyboard pass over the profile field inspector.
6. Honest limitation note: no live-visual/Figma reference was available; verified by
   browser where the environment allows.

## Gating note

This is deliberately a **plan, not an implementation** — significant UI/product change.
Execute in the order above, validating and committing after each step, and only delete
`ProfileLayout` in the final step when nothing references it.
