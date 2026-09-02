# Tethyr Studio + Editor — Full UX/UI Audit (2026-09-02)

> Dated audit of the Studio host, the Studio editor, and the public Studio
> presentation. Read alongside [`TETHYR_UX_RULES.md`](./TETHYR_UX_RULES.md)
> (the binding workflow) and [`AGENTS.md`](../AGENTS.md) (the binding
> constitution). This is an **editorial/product pass** evaluated against the
> current source, not a substitute for the canonical references.

## Context

The starting brief ("do a full audit of Studio and customizing it") was paired
with a detailed editorial critique of Tethyr's Studio editor as a creative
tool. This audit maps that critique onto the actual code, corrects it where the
editorial pass assumed missing functionality that already ships, and turns the
real gaps into a prioritized execution plan.

## Grounding: how the Studio is actually wired

| Concern | Where it lives | Notes |
| --- | --- | --- |
| Studio host (owner) | `src/routes/_authenticated/profile.tsx` | Also hosts setup form, skill editor, GitHub connect. |
| Public Studio | `src/routes/u.$handle.tsx` → `PageShell` | Read-only unless the owner is signed in. |
| Editor toolbar + tabs | `src/components/tethyr/page/editor-toolbar.tsx` | Content / Layout / Style / Settings tabs, undo/redo, preview, publish. |
| Edit / view / preview state | `src/components/tethyr/page/edit-mode-context.tsx` | `isEditing` / `isPreviewing` / `previewDevice`. |
| Canvas renderer (sections→blocks) | `src/components/tethyr/page/page-layout.tsx` | Section grid + contextual block/section controls. |
| Per-block hover tray + drag | `src/components/tethyr/page/sortable-block.tsx` | Drag handle, move up/down, resize, edit, remove. |
| Per-block settings panel | `src/components/tethyr/studio/inline-inspector.tsx` | Persist-on-change + debounce. |
| Composition ("arrange" preset) | `src/components/tethyr/studio/composition-picker.tsx` | Confirm before replacing an existing arrangement. |
| Vibe (tone preset) | `src/components/tethyr/studio/personality-picker.tsx` | Restyles without touching arrangement. |
| Appearance (radius/type/density/accent) | `src/components/tethyr/studio/appearance-panel.tsx` | Fine-grained, no personality needed. |
| Theme picker (mini previews) | `src/components/tethyr/page/theme-picker.tsx` | Swatch preview per theme + reset to default. |
| Background editor (App / Public Studio) | `src/components/tethyr/profile/background-picker-dialog.tsx` | Lives as a modal. |
| Identity / banner / caption editing | `src/components/tethyr/profile/hero-edit-controls.tsx` | Edit-mode gated (`context.isOwner && context.isEditing`). |
| Block system | `src/lib/block-registry.ts`, `src/lib/page-blocks.ts` | Registry keyed by type; blocks self-register. |
| **Dead code** | `src/components/tethyr/studio/studio-guide.tsx`, `studio-navigation.tsx` | Defined but never imported anywhere. |

## Verdict

The engine is largely built. The gap is **surface discipline**: view vs. edit
is only half-enforced, editor chrome sits on the creator's theme, empty public
sections render as empty bands, and two components are dead code. The fix set
below is about **reorganizing, not rebuilding**.

### Scorecard (updated against code)

| Area | Note |
| --- | --- |
| Content / Layout / Style / Settings tabs | ✅ Shipped exactly as the target editor proposed. |
| Undo / Redo + Cmd/Ctrl+Z | ✅ `studio-history.ts` + context + toolbar. |
| Preview (Desktop / Tablet / Mobile) | ✅ `previewDevice` frames in `page-shell.tsx`. |
| Save-state indicator | ⚠️ Status label exists, but publishes flip a single page `status`; no draft copy separation. |
| Template preview-before-apply | 🔴 Missing — applying a template is immediate; only composition-swap confirms. |
| Empty public sections collapse | ⚠️ Half: blocks `return null` when empty in view, but the section band still renders with padding + divider. |
| Editor chrome neutrality (#35/#36) | 🔴 Toolbar/chrome sits inside the owner's `BackgroundLayer` + `appearanceStyle`. |
| Identity editing consolidation (#17/#18) | ⚠️ Identity edited via `hero-edit-controls`, `ProfileSetupForm`, `skill-editing`, and route-level avatar/banner — four surfaces. |
| Dead code | 🔴 `studio-guide.tsx`, `studio-navigation.tsx` unused. |

## What already ships (don't rebuild)

- Human-categorized block picker ("Tell your story / Show your process / Your
  work / People and identity").
- Mini previews for themes and composition mock-ups.
- Contextual, persist-on-change block inspector with debounced text fields.
- Accessibility is attended to (aria labels, `sr-only`, focus-visible rings).
- Empty states exist and are edit-gated; they only need better voice.

## Real gaps, prioritized

Per `TETHYR_UX_RULES.md`, order is smallest-strong-change first:

### P0 — Correctness of the model
1. **Public empty-section collapse** (`page-layout.tsx`): a section whose
   wrapped blocks all render no content must not reserve a band + divider.
   (The critique's "three giant empty boxes" — gallery/experience/links.)
2. **Dead code**: remove/decide `studio-guide.tsx` and `studio-navigation.tsx`.
3. **Empty-state voice**: replace "…will appear here" with the "show the work
   behind what you make" copy everywhere a block uses `BlockEmptyState`.

### P1 — Editor chrome neutrality
4. Separate the editor toolbar/panel chrome from the owner's
   `BackgroundLayer`/`appearanceStyle` so an extreme creator theme cannot break
   editor readability.

### P2 — Destructive-safety + publishing clarity
5. **Template preview-before-apply** + an apply-confirmation enumerating what
   changes (sections, order, spacing) while content is preserved.

### P3 — Presentation polish
6. A compact "Studio readiness" indicator (data already flows through
   `setupCompleteness`), surfaced without adding a checklist to the canvas.

## Decisions taken this session

- Created this dated audit.
- Implemented P0 items 1–3 (see commit).
- Deferred P1–P3 to follow-up passes to keep scope and reviewability bounded.

## Validation

- `npm run typecheck`
- `npm run lint` (changed files)
- `npm run test`
- Source review of empty-collapse behavior (see limitations below).
- Build/route smoke where practical.

Known limitation: no live browser verification was possible in this pass; the
empty-collapse behavior was validated by source review + typecheck. A browser
pass at desktop + 390px is the recommended next confirmation.