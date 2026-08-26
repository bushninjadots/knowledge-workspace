# Tethyr Full Site Audit — Page by Page

> Date: 2026-08-16
> Method: live dev server (127.0.0.1) + SSR curl checks + Lighthouse (landing) + source-level review of all 22 routes.
> Precedence: this is a dated audit. `AGENTS.md`, `TETHYR_PRODUCT.md`, and `TETHYR_UX_RULES.md` remain authoritative.

## Scope

All routes in `src/routes/` were inspected. Public pages were checked via SSR HTML (status, title, meta, canonical, robots) and Lighthouse. Authenticated pages were reviewed at source level; their runtime `head` is set client-side because `_authenticated/route.tsx` uses `ssr: false`.

Severity follows `TETHYR_UX_RULES.md`: **Critical** (blocks usability/access/safety), **High**, **Medium**, **Low**.

---

## 1. Global / shell findings

### G1 — Canonical URLs are silently dropped when `VITE_PUBLIC_SITE_URL` is unset — Medium

`src/lib/seo.ts` `canonicalLinks()` returns `[]` when `VITE_PUBLIC_SITE_URL` is missing, so **no** `<link rel="canonical">` is emitted on any route. In contrast `renderSitemap()` falls back to the request origin in non-production.

- Confirmed: `/`, `/login`, `/projects/:id`, `/u/:handle`, `/skills/:slug` all returned `canonical=` empty in SSR.
- The README documents `VITE_PUBLIC_SITE_URL` as production-required, so production is fine — but the silent drop is a robustness gap. Recommend falling back to request origin (like sitemap) or logging a warning, rather than emitting nothing.

### G2 — Raw `error.message` leaked in route error components — Medium

The following routes render a Supabase/network error string directly to the user in their `errorComponent`/error state:

- `dashboard.tsx`, `u.$handle.tsx`, `projects.$id.tsx`, `signup.tsx`, `login.tsx`, `skills.$slug.tsx`, `_authenticated/sessions.tsx`, `sessions.$id.tsx`, `community.tsx`, `profile.tsx`, `messages.tsx`

These can expose internal table/column/RLS details. Recommend a friendly, non-technical fallback with the raw message moved to `console.error` / error reporting.

### G3 — Authenticated `head` is client-rendered only — Informational

`_authenticated/route.tsx` sets `ssr: false`, so SSR HTML for `/explore`, `/community`, etc. always shows the root marketing title/description. Every authenticated route _does_ define its own `title` (verified), and they are `noindex` via `robotsMeta()`, so this is acceptable. Not a defect; recorded so future SEO work isn't surprised by it.

### G4 — Pervasive `supabase as any` — Low (known)

Most data queries use `(supabase as any)`. Already tracked in `TETHYR_IMPLEMENTATION_STAGES.md` Stage 6 ("Replace high-risk `as any` boundaries"). No action beyond the existing plan.

### G5 — Hardcoded root OG image — Low

`__root.tsx` pins `og:image` / `twitter:image` to a dated Lovable R2 preview URL. Consider a stable brand asset.

---

## 2. Page-by-page findings

### `/` — Landing (public)

- **Lighthouse (desktop):** Performance **72**, Accessibility **98**, Best Practices **96**, SEO **100**.
- **Performance:** Total Blocking Time **940 ms** is the sole drag (score 6/100). FCP 0.2s, LCP 0.3s, CLS 0.003, Speed Index 0.8s are all excellent. Investigate the main-thread cost (large JS + `framer-motion` / `animate-stagger`/`animate-room-enter` sequences) rather than images.
- **Composition:** Hero uses radial gradients, `blur-[120px]`, `text-gradient-brand`, and `shadow-glow-green`. This is the established landing language and reads intentionally, but it is the single largest deviation from the "no gradients/glows/blur" guardrail. Leave as-is unless the landing itself is redesigned.
- Structure (Navbar → hero → stats → How it works → Trending skills → Featured projects → Activity → Spaces → CTA → Footer) is coherent and matches the discovery loop.
- Auth-aware CTAs (Dashboard/Explore/Studio vs Join/Log in) are correct, with a skeleton while auth resolves.

### `/login`, `/signup`, `/reset-password` (public)

- Strong overall: per-page titles, descriptions, `noindex` robots, canonical, labelled inputs, autocomplete hints, and `safeRedirectPath` open-redirect guards.
- `reset-password.tsx` has robust recovery-session detection with an expired-link state.
- **Low — signup:** the closing line "By joining you agree to build with respect…" is a placeholder with no linked Terms/Privacy.
- **Low — signup:** craft picker renders up to 36 skills and is optional; fine, but it loads the full catalog for a single-choice field.

### `/projects/:id` — flagship project workspace (public)

- **Good:** README-first structure (`ProjectReadmeTab` above the tab bar) matches the product narrative "README → identity → work → people → conversation → evidence".
- **Good:** keyboard shortcuts (1–4 switch tabs, `/` opens search) with an input-focus guard.
- **Medium — title is the raw UUID.** `head` sets `Project ${params.id} — Tethyr`; the tab title never becomes the human-readable project title, and the description is generic. A non-existent id also shows `Project 0000… — Tethyr` in SSR before the client renders "Project not found".
- **Medium (shared G2):** `errorComponent` renders `error.message` raw.
- **Low:** loading state is a bare "Loading…" string (no skeleton, unlike other pages).
- **Low:** `supabase as any` in the detail/contributors/signed-URL query with a schema-fallback loop (deliberate migration-compat shim — keep, but document).

### `/u/:handle` — public studio (public)

- **Medium — terminology drift.** "Skills they share" is titled **"Studios"**, and "skills they're growing" is titled **"Currently learning"**. Canonical language (per Stage 1 and `TETHYR_PRODUCT.md`) is "Skills I share" / "Skills I'm growing". "Studios" also collides with "Your Studio" (the profile itself). Recommend renaming to the canonical labels.
- **Low:** banner uses `rounded-t-3xl` inside a `rounded-xl` container (radius mismatch).
- **Low:** avatar ring uses `bg-gradient-brand`.
- **Low:** title/description are fine but generic; the tab title is `@handle` (good).
- Good: endorsements, Connect/Follow, contributed-projects split (Built vs Contributing to), and signed-URL handling for avatar/banner.

### `/skills/:slug` — skill hub (public)

- **Medium — a11y:** tab labels use `hidden sm:inline`, so on mobile the tab buttons are icon-only and lose their accessible name (the text is removed from the accessibility tree, not just visually hidden). Use `sr-only` for the label instead.
- **Low:** title is the raw slug (`typescript — Tethyr`), not the display name.
- **Low:** "related skills" query fetches 6 arbitrary `project_skills` rows and dedupes in JS — not a true co-occurrence relation.
- Good: explicit not-found state, stats, empty states for teachers/learners, category badges.

### `/dashboard` (authenticated)

- **Good:** single-owner workspace chrome (Stage 1 complete), `DashboardStateBoundary` for signed-out/loading/error/stale-error/authed branches, noindex + canonical + title.
- **Good:** priority flow (Welcome → first-session → next steps → Today) sits above the customizable `WorkspaceGrid`.
- **Low:** "This week" module counts activity events but labels the number "reputation" — mildly misleading.
- **Low:** the welcome header applies a `text-gradient` to "what's next?" (accent usage; acceptable but worth watching).
- **Low:** applications/opportunities queries use `as any`.

### `/explore` (authenticated)

- **Good:** three views (Projects / People / Opportunities), persisted filters, need chips, skill-match and popularity sort, batched application-status query, sidebar quick-stats, and explicit empty states.
- **Low:** the segmented tab control uses `aria-pressed` on buttons instead of `role="tablist"`/`role="tab"` (works, but semantically a radio/segmented control would be more accurate).
- **Low:** People cards render an initial in a colored square, not the profile avatar (avatar isn't selected in the creators query).
- **Low:** "Need {Designer|Developer|…}" chip labels read awkwardly.

### `/profile` — "Your Studio" (authenticated)

- **Good:** uses canonical "Skills I share" / "Skills I'm growing" labels; rich tab structure (overview/skills/projects/communities/activity); strong error ("Couldn't load your studio") and loading ("Setting up your studio…") states.
- **Low:** "Skills I'm growing" uses a curly apostrophe (') while "Skills I share" uses a straight one — typographic inconsistency.
- **Low:** profile fields save via `supabase.from("profiles").update(...)` with `as any` shapes in places.

### `/library` and `/library/:id` (authenticated)

- **Medium — `/library/:id` has no `head`**, so its tab title falls back to the root marketing title "Tethyr — Build together…".
- **Medium — a11y:** `/library/:id` icon-only buttons (back, star/favorite, pin, delete) have **no `aria-label`**. Favorite/pin also communicate state by color alone (though the icon glyph changes, so this is borderline).
- **Low:** the title field is a bare `<input placeholder="Untitled">` with no label.
- Good: loading spinner, "Item not found" state, save/unsaved-changes tracking, signed-URL handling for uploads.

### `/community`, `/messages`, `/notifications`, `/sessions`, `/sessions/:id`, `/challenges`, `/challenges/:id`, `/spaces/:slug/settings`, `/spaces/:slug/reports` (authenticated)

- All set per-page titles (client-side) — good.
- **Low:** `challenges/:id` and `sessions/:id` use generic titles ("Challenge — Tethyr", "Session — Tethyr") rather than the entity name (same pattern as the project UUID title, but less severe since these are noindex).
- **Medium (shared G2):** `community.tsx`, `messages.tsx`, `sessions.tsx`, `sessions.$id.tsx` leak raw `error.message`.

---

## 3. Cross-cutting observations

1. **Design-system compliance is generally good.** Borders and radii mostly follow the hierarchy (`rounded-xl` sections, `rounded-lg/xl` cards, `rounded-full` tags/avatars). The main deviations are the landing hero gradient/glow treatments and a few radius mismatches (`u.$handle` banner).
2. **State coverage is strong.** Loading, empty, error, and not-found states are explicit nearly everywhere. The weakest are the bare-text loading states on `/projects/:id` and `/u/:handle`.
3. **Ownership is clean on the dashboard/Studio** (Stage 1 work holds). The project page correctly keeps README as homepage with deeper views behind the tab bar.
4. **Terminology** is mostly canonical on authenticated surfaces but drifts on the public profile ("Studios" / "Currently learning") and the skills page ("workshop"/"hub").
5. **Accessibility** is high on the landing (98) but has targeted gaps: mobile skill-tab labels, unlabelled icon buttons in the library editor, and raw error strings that are also poor for screen readers.

---

## 4. Priority order

| #   | Finding                                                           | Severity | Where                            |
| --- | ----------------------------------------------------------------- | -------- | -------------------------------- |
| 1   | Unlabelled icon-only controls (library editor, mobile skill tabs) | High     | `/library/:id`, `/skills/:slug`  |
| 2   | Raw `error.message` leaks in error components                     | Medium   | 11 routes (G2)                   |
| 3   | Public profile terminology drift ("Studios"/"Currently learning") | Medium   | `/u/:handle`                     |
| 4   | Canonical links silently dropped without `VITE_PUBLIC_SITE_URL`   | Medium   | `src/lib/seo.ts`                 |
| 5   | Project page title = raw UUID, not project name                   | Medium   | `/projects/:id`                  |
| 6   | `/library/:id` missing page title                                 | Medium   | `/library/:id`                   |
| 7   | Landing TBT 940ms                                                 | Medium   | `/`                              |
| 8   | Generic titles on challenge/session detail                        | Low      | `challenges/:id`, `sessions/:id` |
| 9   | Bare-text loading states                                          | Low      | `/projects/:id`, `/u/:handle`    |
| 10  | Minor radius/typography/gradient deviations                       | Low      | `/u/:handle`, `/profile`         |

No Critical findings were identified. The core loop surfaces (landing, project workspace, studio, explore) are coherent and match the product definition.
