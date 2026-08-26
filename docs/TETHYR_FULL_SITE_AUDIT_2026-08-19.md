# Tethyr Audit — Shipped Batch Review

> Date: 2026-08-19
> Method: source-level review of the batch shipped since the 2026-08-16 audit, plus a full validation run (typecheck / lint / Vitest) and a live browser smoke of the community feed.
> Precedence: this is a dated audit. `AGENTS.md`, `TETHYR_PRODUCT.md`, and `TETHYR_UX_RULES.md` remain authoritative.

This is a **delta audit** against [`TETHYR_FULL_SITE_AUDIT_2026-08-16.md`](./TETHYR_FULL_SITE_AUDIT_2026-08-16.md). It verifies what that audit flagged, reviews the surfaces added since, and records new findings.

Severity follows `TETHYR_UX_RULES.md`: **Critical** (blocks usability/access/safety), **High**, **Medium**, **Low**.

---

## 1. Validation

All green at the time of this audit:

- `tsc --noEmit` — clean
- `eslint .` — 0 errors
- Vitest — **116 passing** (19 files), incl. new `dominant-color` contrast tests
- pgTAP (`supabase test db`) — **71 passing** (carried forward from the Stage 2 coverage work)
- Browser smoke — `/community` feed renders with stats + discuss counts intact after the `useInfinitePosts` refactor; composer, project page, and connections were browser-verified in the prior turns.

No build, type, or test regressions from the shipped batch.

---

## 2. Resolved since 2026-08-16

Verified in current source; these are closed.

| 8-16 finding                                                             | Severity | Status                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 — Canonical links silently dropped without `VITE_PUBLIC_SITE_URL`     | Medium   | **Resolved** — `seo.ts` now falls back to `window.location.origin` and logs a dev-only warning.                                                                                                |
| G2 — Raw `error.message` in route `errorComponent`s                      | Medium   | **Resolved** — route error components now render friendly fallbacks ("This project couldn't be loaded", "Skill not found", etc.).                                                              |
| #1 — Unlabelled icon-only controls (library editor, mobile skill tabs)   | High     | **Resolved** — library editor back/favorite/pin/delete/title all have `aria-label`; skill tabs are a proper `role="tablist"`/`role="tab"` with `aria-label`, `aria-selected`, `aria-controls`. |
| #3 — Public profile terminology drift ("Studios" / "Currently learning") | Medium   | **Resolved** — `/u/:handle` now uses "Skills they share" / "Skills they're growing".                                                                                                           |
| #6 — `/library/:id` missing page `head`                                  | Medium   | **Resolved** — has a `head` ("Library item — Tethyr") and syncs `document.title` to the item title.                                                                                            |
| #9 — Bare-text loading states on `/projects/:id`, `/u/:handle`           | Low      | **Resolved** — both now render skeletons.                                                                                                                                                      |

---

## 3. New findings (introduced or surfaced by this batch)

### N1 — Confetti ignores `prefers-reduced-motion` — Medium (accessibility)

`src/lib/confetti.ts` `burstConfetti()` runs a `requestAnimationFrame` particle loop with no `matchMedia("(prefers-reduced-motion: reduce)")` guard. The global reduced-motion rule in `styles.css` only neutralises CSS animations; it cannot stop this canvas loop. A motion-sensitive user gets a full-screen particle burst on badge award with no opt-out.

- **Recommendation:** early-return in `burstConfetti()` when `prefers-reduced-motion: reduce` is set (or render a single static frame). One-line guard, no other call-site change.

### N2 — Icon-only "withdraw request" button has no accessible name — Low (accessibility)

`connections.tsx` outgoing-request row renders `<Button …><X /></Button>` with no `aria-label` or `title`. It is the only unlabelled icon-only control on the otherwise well-labelled Connections page.

- **Recommendation:** add `aria-label={`Withdraw request from ${name}`}` (and optionally a `title`).

### N3 — `FavoriteBadge` is icon-only with a hover-title only — Low (accessibility)

`achievements.tsx` `FavoriteBadge` renders a decorative icon `<span title="Favourite badge: …">` with no `role="img"`/`aria-label`. It sits next to the member name and is the only signal that a badge is "pinned". Non-sighted users and non-hover devices get no equivalent.

- **Recommendation:** add `role="img"` + `aria-label={def.label}` (or a `sr-only` text node). This is a status indicator, so it should not stay purely decorative.

### N4 — Raw error strings still reach transient toasts — Low–Medium

G2 (route-level) is closed, but ~30 component call-sites still pass raw `error.message` into `toast.error(...)` (profile-sections, profile, github-connect, connections, achievements, `use-project-repos`, library item `Save failed: ${err.message}`, etc.). Impact is lower than the old route leak — transient, dismissible — but the same internal table/RLS detail can flash on screen.

- **Recommendation:** route these through the existing `auth-error`/friendly-message helper; keep the raw message to `console.error`. Not urgent; a single helper + mechanical sweep when convenient.

---

## 4. Carried forward (still open from 2026-08-16)

| #   | Finding                                                                                                                | Severity | Notes                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Project page `head` title is generic ("Project — Tethyr"); the real title is only set client-side via `document.title` | Medium   | Same on `/challenges/:id` and `/sessions/:id` (Low) — entity name isn't in SSR/meta.                                                                                          |
| 7   | Landing Total Blocking Time ~940 ms                                                                                    | Medium   | Unchanged; performance-only, needs a Lighthouse pass + main-thread investigation.                                                                                             |
| —   | Skills page "workshop"/"hub"/"Sharing"/"Growing" terminology drift                                                     | Low      | `/skills/:slug` still uses "Skill workshop sections", a "Hub" crumb, and "Sharing"/"Growing" stat labels instead of canonical "Skills I share"/"Skills I'm growing" language. |
| 10  | Minor radius/gradient deviations (`u.$handle` banner `rounded-t-3xl`, avatar `bg-gradient-brand`)                      | Low      | Cosmetic.                                                                                                                                                                     |

---

## 5. Cross-cutting observations

1. **The batch is constitution-compliant.** New surfaces (Connections, composer, badge pinning, feed pagination, accent contrast) use sections/rows rather than gratuitous cards, keep `rounded-xl`/`rounded-lg`/`rounded-full` per the scale, and reuse `EmptyState`, `Button`, and the `--user-accent-*` tokens. No new gradients/glows/shadows were introduced; the accent-as-background contrast is now WCAG-aware (`--user-accent-foreground`).
2. **Accessibility is meaningfully better than 8-16.** The two High-priority gaps from the last audit are closed, and the shipped work added `aria` coverage (mobile nav `aria-expanded`/`aria-controls`, labelled icon buttons, keyboard move with scroll prevention). Remaining items are all Low–Medium and concentrated.
3. **Data wiring is clean.** Challenges, sessions, library items, and messages all now carry `project_id` context; RLS scopes read to owners + contributors. The migration batch (5 files) applied cleanly to both local and remote.
4. **No Critical or High findings.** The core loop surfaces (project workspace, studio, explore, community) are coherent and match the product definition.

---

## 6. Priority order

| #   | Finding                                             | Severity   | Where                                                        |
| --- | --------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| 1   | Confetti ignores `prefers-reduced-motion`           | Medium     | `src/lib/confetti.ts`                                        |
| 2   | Project/challenge/session `head` titles are generic | Medium     | `projects.$id.tsx`, `challenges.$id.tsx`, `sessions.$id.tsx` |
| 3   | Raw error strings in toasts (G2 residual)           | Low–Medium | ~30 component call-sites                                     |
| 4   | Icon-only withdraw button has no accessible name    | Low        | `connections.tsx`                                            |
| 5   | `FavoriteBadge` icon-only with hover-title          | Low        | `achievements.tsx`                                           |
| 6   | Skills page "workshop"/"hub" terminology            | Low        | `skills.$slug.tsx`                                           |
| 7   | Landing TBT (unchanged)                             | Medium     | `/` (performance)                                            |
| 8   | Minor radius/gradient deviations (unchanged)        | Low        | `u.$handle.tsx`, `profile`                                   |
