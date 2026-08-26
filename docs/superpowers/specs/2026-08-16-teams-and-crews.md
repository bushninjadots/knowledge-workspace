# Teams & Crews — Design Spec

> Created 2026-08-16. A design proposal sequenced **after** Stage 4
> (Studio/dashboard simplification) per `TETHYR_COLLABORATION_DEPTH_2026-08-16.md`.
> **Status (2026-08-18): implemented** — `teams`/`team_members`/`team_projects`/
> `team_invites` tables, `/teams/:slug` route, and the team page shipped ahead of
> the Stage 4 sequencing (see `TETHYR_MASTER_PLAN.md` §5).

---

## The Problem It Solves

Tethyr's loop is strong at _discover work_ and _build_, but **collaboration has
no persistent identity**. A project re-declares its roster every time; there is
no "crew that builds together across projects." When the same 4 people ship
their third project together, Tethyr has no way to say "built by _that crew_".

Teams fix that: a **roster + a shipped-work record** — never a chat or feed.

---

## What a Team Is / Is Not

**Is:**

- A named, slugged group of people who build together.
- Anchored to projects via `team_projects` ("Built by **Crew Name**").
- A home for a roster with per-project roles layered on top.
- Discoverable through its **shipped work** (its projects are the flagship).

**Is not:**

- A chat room or feed (Community already owns conversation).
- A company/organization page with vanity metrics.
- A follower group or interest tag.

---

## The Shared Spine (schema)

Mirrors the migration sketch already drafted in the depth proposal:

```sql
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  avatar_url text,
  cover_url  text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'contributor'
             check (role in ('lead','core','contributor')),
  joined_at  timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table public.team_projects (
  team_id    uuid not null references public.teams(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (team_id, project_id)
);
```

### RLS (draft)

- `teams`/`team_members`/`team_projects`: readable by everyone (public), but
  writes restricted to team leads.
- Membership changes are lead-gated (add/remove member, promote to core/lead).
- A private project still only shows its team link to people who can see it.

### Open question (carried from the proposal)

Should a project belong to **at most one primary team** (mirroring one owner),
or many? **Proposal: one primary team** — keeps the project's People section
unambiguous, while individual contributors can still belong to many teams.

---

## Surfaces

### Project page — People section anchor

- Header becomes "Built by **Crew Name**" (when a primary team exists), with a
  link to the team page.
- The contributor roster stays; team members get a subtle "Crew" marker, with
  per-project roles layered on top of the team role.

### Team page (`/teams/:slug`)

Structure, in this order (work first):

```
Identity (name, cover, accent)
  → Shipped work (grid of the team's projects)
  → Roster (leads / core / contributors)
  → (later) Credits roll across all team projects
```

- **Shipped work is the flagship** — the projects, not an "about us" wall.
- Roster is grouped by role, names link to `/u/:handle`.
- "Join" is not a self-serve button; membership is lead-invited (preserves the
  evidence-over-claims principle). If a request flow is added later, it is
  owner-reviewed (mirroring challenge/join-request review, not auto-join).

### Studio — "Teams I build with"

- A compact list of the teams a person belongs to, each linking to the team
  page. Sits near "Credited on", reinforcing _who you build with_.

### Create flow

- A team is created from the project's People section ("Form a crew") or from
  the Studio. Minimal fields: name, slug (auto-suggested), cover.
- Invite-by-handle; invitees accept/decline via the existing notification
  destination map (a `team_invite` notification type).

---

## Interaction Model

- **Create:** owner → name/slug → creates `teams` row + self as `lead`.
- **Invite:** lead → invite by handle → `team_invite` notification → accept/decline.
- **Role change:** lead promotes/demotes; the event lands in the evidence trail
  (`activity_events`) so it appears in Credits later.
- **Attach project:** lead links a project → `team_projects` row → project
  People section shows "Built by Crew Name".
- **Leave:** member removes self; leads can remove members.

---

## States & Responsiveness

- **Empty roster:** "No members yet — invite your first collaborator."
- **Empty projects:** "No shipped work yet — attach a project."
- **Loading/error:** skeleton + inline retry, matching other Tethyr surfaces.
- **Mobile:** roster and projects stack; identity collapses to name + cover.

## Accessibility

- Team page uses a single `h1`, section `h2`s, semantic list for roster.
- Invite form has labelled fields; accept/decline buttons have accessible names.
- No color-only meaning; accent used sparingly (cover/avatar ring).

## Anti-patterns to avoid

- ❌ A team feed/chat (Community owns conversation).
- ❌ Follower counts or "top teams" leaderboards.
- ❌ Auto-join or open membership (evidence over claims).
- ❌ Turning the team page into a card-grid dashboard.

## File Changes (when implemented)

- `supabase/migrations/…_teams.sql` — tables, RLS, `team_invite` notification.
- `src/hooks/use-teams.ts` — query/mutation hooks.
- `src/routes/teams.$slug.tsx` — team page.
- `src/components/tethyr/team/…` — identity, roster, shipped-work, invite dialog.
- Wire "Built by Crew Name" into `project-people.tsx`; "Teams I build with"
  into the Studio.

## Sequencing

| Step                               | Precondition                       |
| ---------------------------------- | ---------------------------------- |
| Teams + members + projects tables  | Stage 4 done                       |
| Team page + "Built by Crew" anchor | Tables live                        |
| Team invite notifications          | Notification map extended          |
| Credits roll across teams          | Evidence trail + Credits spec done |
