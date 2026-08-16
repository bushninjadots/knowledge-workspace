# Tethyr Collaboration Depth — Proposal

> Created 2026-08-16. This is a design proposal, not an implementation mandate.
> It intentionally sequences behind Stages 1–6 in `TETHYR_IMPLEMENTATION_STAGES.md`
> (the operating rule: no new top-level features while a higher-priority stage is
> incomplete). The only piece prototyped immediately is the smallest, lowest-risk
> one: **project "need help now"**.

## The problem

Tethyr's loop is strong at *discover work* and *build*, but thin in the middle —
*collaborate* and *become known*. Three concrete symptoms:

1. **Collaboration has no persistent identity.** A project re-declares its roster
   every time. There is no "crew that builds together across projects."
2. **A project can't say what it needs right now.** Open roles are a formal
   application flow buried in the People tab; there is no lightweight, urgent
   "help us this week" signal (Stage 3's "needed-next" gap).
3. **Sessions are floating events.** Video meetings exist but have no project/team
   home and produce no lasting evidence.

## The shared spine

Three new top-level objects (built later), two link tables, and one exposed table:

```
teams            → id, name, slug, avatar, cover, created_by
team_members     → team_id, profile_id, role (lead/core/contributor), joined_at
project_needs    → id, project_id, title, note, urgency, is_filled, filled_by   ← built now
team_projects    → team_id, project_id
session_links    → session_id, team_id?, project_id?, outcome
```

`reputation_events` already exists (written by the existing triggers) — the
evidence trail only needs to *expose* it, not create it.

## The features

### 1. Teams & crews
A team is a roster + a shipped-work record — never a chat or feed. `team_projects`
makes the team the project's *People* anchor ("Built by **Crew Name**"), with
per-project roles layered on top. Surfaces: project People section, Studio
"Teams I build with", and a Team page whose flagship is its shipped work.

### 2. Project "need help now" *(prototyped — see below)*
A lightweight, urgent ask pinned at the top of the project workspace, feeding
Explore. Filling a need records a `need_filled` activity event.

### 3. Recurring sessions
Extend `sessions` with recurrence + `session_links`. A team owns a recurring
meetup (roster auto-invited); a session can record an **outcome** (decision /
milestone / recap) that lands in the project as evidence.

### 4. Reputation evidence trail
Expose `reputation_events` publicly: score → tier → linked proof. Studio shows
"why you're trusted" instead of a bare number, and this becomes the data source
for team-level stats (evidence, not vanity metrics).

### 5. Stage 5 connectors
- Library → project with explicit `visibility` (private / team / public).
- Messages → project-anchored threads ("feedback on Project X").

### 6. Credits (the unifier)
Every project ships with a film-style **Credits roll** — auto-compiled from the
evidence trail (updates, milestones, files, session outcomes, filled needs,
challenge passes). Reputation becomes a *rollup* of credits; discovery can search
"who's credited on projects like this." Credits is a rendering layer on top of the
evidence all five features already feed.

## Sequenced rollout

| Order | Step | Precondition |
|---|---|---|
| **Now** | `project_needs` table + RLS + activity trigger + project UI + Explore | None beyond existing `is_project_visible` |
| After Stage 3 | Link needs → skill catalog for match scoring; recurring sessions | Project workspace hierarchy stable |
| After Stage 4 | Teams + team_members + team_projects + team page | Studio/dashboard simplified |
| After Stage 5 | Expose reputation events; Library/Messages connectors | Supporting systems wired to work |
| Last | Credits rendering layer | Evidence trail live |

## Migration sketch (for the later steps)

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  avatar_url text,
  cover_url text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'contributor' check (role in ('lead','core','contributor')),
  joined_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table public.team_projects (
  team_id uuid not null references public.teams(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (team_id, project_id)
);
```

(`session_links` is a schema change to the existing `sessions` table, so it is
deferred until the sessions surface is revisited.)

## Open questions
- Should a project belong to at most one team, or many? (Proposal: one primary
  team, mirroring one owner — keeps People unambiguous.)
- Should "filling a need" award reputation immediately, or only after the owner
  confirms? (Proposal: owner-confirm, mirroring challenge review — avoids
  self-award farming.)
