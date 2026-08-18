# Credits Roll — Design Spec

> Created 2026-08-16. A design proposal, sequenced **after** Teams & crews and
> the reputation evidence trail (see `TETHYR_COLLABORATION_DEPTH_2026-08-16.md`
> and `TETHYR_MASTER_PLAN.md`).
> **Status (2026-08-18): implemented** — project, Studio, and team Credits rolls
> shipped (`lib/credits.ts`, `use-credits.ts`, `project-credits.tsx`,
> `profile-credits.tsx`). The evidence trail is compiled from `project_activity`
> + `project_contributors` rather than a `reputation_events` view, which is still
> a future enhancement.

---

## What It Is (plain explanation)

Every film ends with a credits roll — the names of everyone who made it. Tethyr
projects should end the same way.

A **Credits roll** is a single, auto-compiled, scrollable list of everyone who
built a project and *what they actually did*. It is the moment where the loop
closes: `Build → Contribute → Become known` rendered as one surface.

The key idea: **the Credits roll is not new data. It is a rendering layer on
top of the evidence the project already generates** — updates, milestones,
files, open-role fills, session outcomes, challenge passes, reputation events.
Nothing needs to be hand-maintained; the roll is compiled from what already
happened.

This makes reputation a **rollup of credits** instead of a bare number: "why
you're trusted" becomes a linkable list of the concrete things you shipped.

---

## Why It Earns Its Place (product justification)

1. **Closes the loop.** "Become known" currently has no single visible surface.
   Credits makes contribution legible at a glance.
2. **Evidence over score.** Matches the core pillar: recognition from visible
   contribution, never a gamified number.
3. **Work before metadata.** It is literally a list of work, ordered by
   project, not a self-reported résumé.
4. **No new data burden.** It reads existing tables; the project owner never
   curates a "credits" list by hand.

---

## Design Intent

- Feels **editorial and ceremonial**, not gamified. Think end-credits of a
  film, not a leaderboard.
- **Projects are the frame** — the roll belongs to the project page, near the
  end, after conversation and evidence.
- **Roles are earned, not claimed.** Credits entries come from real actions:
  "Shipped the onboarding flow", "Reviewed 3 challenge submissions", "Filled
  the 'Need: motion designer'".
- **Restrained styling** per the constitution: no gradients/glows; a quiet
  typographic list, subtle dividers, dynamic accent used only for the
  contributor's avatar ring or name tint.

---

## What a Credit Is

A credit is a single line built from an evidence event:

| Field | Source | Notes |
|---|---|---|
| `profile_id` / name | event actor | dedupe + group by person |
| `role` | project_contributors.role, team_members.role, or event type | creator / lead / core / mentor / contributor |
| `credit_text` | event → human sentence | e.g. "Created the project" |
| `evidence_link` | event's project/resource id | links to the milestone, file, session, need, challenge |
| `occurred_at` | event timestamp | orders the roll chronologically |
| `weight` | reputation delta on the event | powers tier math, not displayed as a score |

### Evidence sources (existing tables)

- `project_updates` — "Posted update 'Week 8'".
- `project_milestones` (completed) — "Completed milestone 'Beta launch'".
- `project_activity` / `activity_events` — generic contribution stream.
- `project_open_roles` (filled) — "Filled role 'Illustrator'".
- `project_needs` (filled) — "Answered 'Need: motion designer'".
- `reputation_events` — the authoritative trail (already written by triggers).
- (later) `session_links.outcome` — "Led session: API design review".
- (later) `challenge_participants.review_status = 'passed'` — "Passed challenge X".

`reputation_events` is the spine: if it already captures actor + project +
event type + delta, the Credits roll is a **view over it**, enriched with a
human-readable label and a link.

---

## The Surface

### Project page — "Credits" section (below People/Conversation, above footer)

```
── CREDITS ───────────────────────────────
Creator
  ▸ Maya Chen — Created the project · Jan 2026

Core
  ▸ Devon Okafor — Built the API layer · Feb 2026
  ▸ Priya Nair — Shipped onboarding flow · Mar 2026

Contributors
  ▸ Alex Ruiz — Filled "Need: motion designer" · Apr 2026
  ▸ Sam Lee — Completed milestone "Beta launch" · May 2026

Special thanks
  ▸ 4 mentors · 2 reviewers · 1 sponsor (collapsed)
```

- Grouped by role (Creator → Lead/Core → Contributors → Special thanks).
- Within a role, ordered chronologically (or by weight desc — **chronological
  is the default** so it reads like a story, not a ranking).
- Each line: name (links to `/u/:handle`), credit text, date.
- Avatar ring uses the contributor's dynamic accent — the only color.

### Studio — "Credited on" (rollup of the person's credits)

- Lists the projects someone is credited on, each with their role and the most
  recent credit text. Replaces/augments the bare reputation number with links
  ("Credited on **Tethyr**, **12 projects**").

### Team page (future) — the team's roll across all its projects.

---

## Compilation Logic

```
credits(project) =
  for each evidence event where project_id = X:
    map event → { actor, role, text, link, weight, at }
  group by actor
  merge credits per actor (keep the strongest role, latest at)
  order groups by role precedence, then by at
```

- **Role precedence:** creator > lead > core > mentor > contributor > thanks.
- **Dedupe:** same actor + same underlying entity appears once (a milestone
  shows once, not per sub-action).
- **Idempotent:** re-renderable from the trail at any time; nothing to
  hand-maintain.

### Suggested backend

A Postgres function or view (e.g. `project_credits(project_id)`) that unions
the evidence tables into one shape, so the client does one query instead of N.
Prefer a **SECURITY DEFINER view/function** (matching existing RLS helper
patterns) so it respects `is_project_visible` for private projects.

---

## States & Responsiveness

- **Empty:** a project with no events yet shows nothing (or "No credits yet —
  be the first to contribute.") — never an empty card.
- **Loading:** a quiet skeleton (few pulsing text lines), not a spinner wall.
- **Error:** inline "Couldn't load credits" with retry.
- **Mobile:** single column; role headers collapse to small caps; avatar ring
  shrinks; names truncate gracefully.
- **Reduced motion:** no scroll animation — a static list (the "roll" is a
  metaphor, not a literal marquee).

## Accessibility

- The section is a `<section aria-labelledby>` with an `h2` "Credits".
- It is a semantic list (`<ul>/<li>`) or definition list; not a table of
  numbers.
- Names are real links with visible focus; dates are `text-muted`.
- No meaning conveyed by color alone (accent ring is decorative).

## Anti-patterns to avoid

- ❌ Leaderboard with ranks/points/likes.
- ❌ A marquee/scrolling animation (respects reduced-motion anyway).
- ❌ Auto-generated "credits" people can edit to self-promote.
- ❌ A card per person (violates "not everything is a card").
- ❌ Requiring the owner to maintain the list.

## File Changes (when implemented)

- `supabase/migrations/…_project_credits.sql` — `project_credits` view/function.
- `src/hooks/use-credits.ts` — `useProjectCredits(projectId)`,
  `useStudioCredits(profileId)`.
- `src/components/tethyr/project/project-credits.tsx` — the roll.
- `src/components/tethyr/profile/…` — "Credited on" rollup (Studio).
- Wire into `projects.$id.tsx` (after People/Conversation) and `profile.tsx`.

## Open Questions

- Chronological vs. weight-ordered within a role? (Proposal: chronological.)
- Does "Special thanks" include non-project events (mentoring, reviews)?
  (Proposal: yes, but collapsed behind a "show all" toggle.)
- Should the roll appear on public projects only, or private too? (Proposal:
  respect project visibility; credits of a private project are visible only to
  owner + contributors.)
