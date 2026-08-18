# Tethyr — Master Plan & Guide

> Consolidated from `TETHYR_PRODUCT.md`, `TETHYR_IMPLEMENTATION_STAGES.md`,
> `ROADMAP.md`, `TETHYR_COLLABORATION_DEPTH_2026-08-16.md`, and the
> `TETHYR_FULL_SITE_AUDIT_2026-08-16.md`. This is a working plan, not a
> replacement for the canonical constitution (`AGENTS.md`).

---

## 1. What Tethyr Is

Tethyr is the collaboration network where builders — developers, designers,
writers, musicians, researchers, founders, artists — **create projects together
in public, grow through real contributions, and become known for what they
make, not what they claim.**

North star: *"It's where people build things together and get known for what
they make."*

It is **not** LinkedIn, Discord, GitHub, Behance, a job board, a skill
marketplace, or a generic SaaS dashboard. It borrows from all of them and
commits to none.

### The primary loop

```
DISCOVER → Explore work → Find people → Collaborate → Build
        → Contribute → Become known → DISCOVER
```

Every feature must strengthen at least one transition. If it doesn't, its
product justification must be explicit.

### The four pillars

- **Build** — projects are the center of the ecosystem.
- **Connect** — people meet through work, skills, communities, sessions.
- **Grow** — learning through collaboration, mentoring, challenges, contributing.
- **Earn Reputation** — evidence-based, never self-declared, never popularity.

---

## 2. Who It's For

1. **The maker who wants collaborators and recognition** — finds people,
   contributes to real work, and builds a reputation grounded in visible
   evidence.
2. **The project owner** — runs a living project (README, milestones, open
   roles, contributors) and needs to attract the right people.

---

## 3. What Exists Today

**Identity** — profiles ("Your Studio"), handles, creator titles, banners,
accent colors, availability badges, profile completeness, reputation tiers,
GitHub connect + contribution graph.

**Projects (flagship)** — README-first workspace, timeline, milestones, weekly
updates, open roles + apply/accept/decline flow, contributors, discussions,
files/repos (signed URLs), gallery/resources, activity, public/private
visibility, 3D project shelf.

**Skills** — teach/learn model, ~130-skill catalog, per-skill hub pages,
verification, endorsements, match scoring.

**Collaboration** — sessions (calendar, wizard, availability, resources,
notes, requests), connections, DMs, project role applications.

**Community** — 14 post types, spaces (join requests/moderation/bans),
challenges (creator-gated review → reputation), polls, nested comments,
link posts + flair, reporting.

**Discovery** — Explore (Projects / People / Opportunities), global search,
skill-matched suggestions.

**Library** — notes (TipTap), files, links, collections, tags, favorites, pins.

**Notifications** — feed, dropdown, canonical destination map.

**Dashboard** — priority flow + draggable `WorkspaceGrid`.

**Landing** — hero, stats, how-it-works, trending skills, featured projects,
activity, spaces.

---

## 4. What the Team Wants

The operating intent is **coherence before expansion** — the product already
has enough breadth. The three-layer backlog:

### Layer A — Harden the existing loop (Stages 0–6)
- Verify remote migrations; end-to-end collaboration/challenge flow; RLS +
  authenticated browser coverage.
- Re-compose the project workspace (Stage 3).
- Simplify dashboard/studio (Stage 4).
- Connect Library/Messages/Sessions/Challenges back to work (Stage 5).
- Replace `supabase as any`; a11y/keyboard/perf coverage (Stage 6).

### Layer B — Roadmap Phases 7–9
- Phase 7 — Opportunity Layer (browse by need). *Partially live.*
- Phase 8 — Dashboard (everything actionable). *Mostly live.*
- Phase 9 — Knowledge Layer (projects generate docs/resources).

### Layer C — Collaboration Depth (newest thinking)
Diagnosis: the loop is strong at *discover* and *build* but **thin in the
middle — collaborate and become known.** Proposed shared spine:

1. **Teams & crews** — persistent roster + shipped-work record (spec:
   `docs/superpowers/specs/2026-08-16-teams-and-crews.md`).
2. **Project "need help now"** — lightweight urgent ask. *Being built now*
   (`project_needs` + `skill_id`).
3. **Recurring sessions with outcomes** — a session records a
   decision/milestone/recap that lands in the project as evidence.
4. **Reputation evidence trail** — expose `reputation_events`.
5. **Stage 5 connectors** — Library→project visibility, Messages→project threads.
6. **Credits (the unifier)** — film-style Credits roll per project (spec:
   `docs/superpowers/specs/2026-08-16-credits-roll-design.md`).

---

## 5. Execution Plan (dependency order)

| Phase | Work | Status |
|---|---|---|
| A1 | Apply pending migrations (incl. `project_needs`, `teams`) | done — 8 migrations pushed 2026-08-18 |
| A2 | Fix audit P0/P1 findings (see §7) | done this session |
| A3 | Replace `supabase as any` (Stage 6) | queued |
| B | Project page re-composition (Stage 3) | queued |
| C | Dashboard/studio simplification (Stage 4) | queued |
| D | Stage 5 connectors (Library/Messages → project) | queued |
| E | Teams & crews + recurring sessions + evidence trail | teams & crews done; recurring sessions + evidence trail pending |
| E+ | Credits roll rendering layer | done |
| F | Opportunity/Knowledge layer polish | deferred |
| G | Video/audio sessions, calendar sync, push/email, API, native | deferred until evidence |

---

## 6. Working Guide

**Before changing anything:**
1. Read `docs/README.md` for precedence, then the doc that owns your area.
2. Search for an existing route/component/hook/`src/lib` owner first.
3. For significant UI/product changes, follow `TETHYR_UX_RULES.md` and write
   the reasoning proposal *before* editing JSX.

**While building:**
- Reuse existing conventions; add a library only if it's already a dependency.
- Put DB access in the Supabase patterns; respect RLS; add a **migration** for
  any schema/RLS/policy change; invalidate React Query keys after mutations.
- Follow the border/radius hierarchy; sections over cards; accent, don't decorate.
- Smallest change that improves coherence or the loop.

**After building:**
- `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`, `npm run smoke`.
- Review desktop + mobile, keyboard/screen-reader, loading/empty/error states.

**Operational notes:**
- Lovable sync — never force-push or rewrite published history.
- `supabase db push` is remote-only; apply migrations locally too
  (`npx supabase db reset`).
- Private storage buckets → always `useSignedStorageUrl` / `SignedImage`.

---

## 7. Audit P0/P1 — Fix Log (2026-08-16)

Resolved this session:

1. ✅ **Raw `error.message` leak** — `notifications.tsx` `errorComponent`
   rendered `error?.message`; replaced with a friendly fallback.
2. ✅ **Auth toasts** — `login.tsx` (×2) and `signup.tsx` (×1) now route
   `error` through `getAuthErrorMessage()` instead of raw `.message`.
3. ✅ **Unlabelled icon-only toolbar buttons** — `note-editor.tsx`
   `ToolbarButton` now sets `aria-label` (was `title` only).
4. ✅ **Terminology drift** — `u.$handle.tsx` empty state "Not sharing any
   studios yet." → "Not sharing any skills yet."
5. ✅ **Canonical links silently dropped** — `seo.ts` `canonicalLinks` now
   falls back to `window.location.origin` when `VITE_PUBLIC_SITE_URL` is unset.

Already resolved in the working tree (verified, no action needed):
- `library.$id.tsx` page title + icon `aria-label`s.
- `skills.$slug.tsx` mobile tab `aria-label`s.
- Friendly `errorComponent`s across `dashboard`, `u.$handle`, `projects.$id`,
  `login`, `signup`, `skills.$slug`, `sessions`, `sessions.$id`, `community`,
  `profile`, `messages`.
- `projects.$id.tsx` title — generic SSR fallback plus a client-side
  `document.title` effect that swaps in the human-readable project title.

Deferred (out of P0/P1 scope):
- Landing TBT 940ms (needs profiling; framer-motion/animation sequences).
- Stable OG image for `__root.tsx` (still a dated Lovable R2 preview URL; needs a brand asset).

Since resolved in the working tree (verified, no action needed):
- Generic titles on `challenges/:id` / `sessions/:id` (client-side `document.title` effects now swap in the entity name).
- Bare-text loading states on `/projects/:id`, `/u/:handle` (both now render `animate-pulse` skeletons).
- Signup "By joining you agree…" placeholder (reworded to a community-norms statement; no Terms/Privacy pages exist yet).

---

## 8. Next Sessions (suggested)

1. Re-compose the project workspace (Stage 3) around `project_needs`.
2. Implement recurring sessions with outcomes + expose the `reputation_events`
   evidence trail (the remaining half of Layer C item 5/E).
3. Finish Stage 6 (`as any` removal + a11y/keyboard coverage).
