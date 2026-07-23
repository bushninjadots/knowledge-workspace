# Phase 6 — Community Evolution (Temporary Roadmap)

> Created: 2026-07-22
> Status: IN PROGRESS — awaiting implementation
> Last session: Analyzed gaps, planned full Phase 6, user confirmed: challenges = new table + detail page, no staged rollout.

---

## What Phase 6 Solves

The community feed is currently a flat list of posts. Phase 6 makes it **purpose-driven** — every post type has a home, every nav item works, and challenges give the community a shared activity layer.

**Core loop strengthened:** Discover → Learn → Collaborate → Build → Earn Reputation → Unlock Opportunities

---

## Step 6.1 — Add Missing Post Types

Add to `PostType` union in `src/hooks/use-community.ts`:

- `lesson_learned` — "What I learned from X"
- `feedback_request` — "Review my project/approach"
- `open_role` — "Looking for [role] on [project]"

Update:

- `src/lib/community-data.ts` — POST_TYPE_LABEL entries
- `src/components/tethyr/community/composer-bar.tsx` — QUICK_ACTIONS entries + ACTION_ICON
- `src/routes/_authenticated/community.tsx` — TYPE_FILTERS will auto-update from POST_TYPE_LABEL

No migration needed — these are just new values in the existing `type` column (text/enum).

---

## Step 6.2 — Create Challenges Tables

New migration: `supabase/migrations/20260722150000_challenges.sql`

### `challenges` table

```sql
id              uuid primary key default gen_random_uuid()
title           text not null
description     text not null
type            text not null default 'skill'  -- skill | project | learning
skills          text[] not null default '{}'
difficulty      text not null default 'intermediate'  -- beginner | intermediate | advanced
start_date      timestamptz
end_date        timestamptz
max_participants integer
status          text not null default 'active'  -- draft | active | completed | archived
created_by      uuid not null references auth.users(id)
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

### `challenge_participants` table

```sql
id          uuid primary key default gen_random_uuid()
challenge_id uuid not null references challenges(id) on delete cascade
user_id     uuid not null references auth.users(id)
status      text not null default 'joined'  -- joined | in_progress | completed
progress    jsonb default '{}'
joined_at   timestamptz not null default now()
unique(challenge_id, user_id)
```

RLS policies:

- Everyone can read active/completed challenges
- Only authenticated users can create challenges
- Challenge creators can update their own challenges
- Participants can update their own participation

Index on `challenges(status, created_at)` for feed queries.

---

## Step 6.3 — Challenge Hooks

New file: `src/hooks/use-challenges.ts`

Hooks:

- `useChallenges(filters?)` — list challenges with optional status filter
- `useChallenge(id)` — single challenge with participants
- `useCreateChallenge()` — insert challenge
- `useJoinChallenge()` — add participant
- `useUpdateChallengeProgress()` — update participant progress
- `useLeaveChallenge()` — remove participant
- `useUserChallenges(userId)` — challenges a user is participating in

All use `(supabase as any)` pattern since types aren't regenerated.

---

## Step 6.4 — Challenge Creation Flow

Extend the composer or add a "Create Challenge" button in the community header.

Challenge creation form (inline or modal):

- Title
- Description (markdown)
- Type: Skill Challenge / Project Challenge / Learning Challenge
- Skills involved (tag input)
- Difficulty: Beginner / Intermediate / Advanced
- Start date (optional)
- End date (optional)
- Max participants (optional)

On submit → insert into `challenges` table → show in feed.

---

## Step 6.5 — Challenge Cards in Feed

New component: `src/components/tethyr/community/challenge-card.tsx`

Challenge card shows:

- Title + description preview
- Type badge (Skill / Project / Learning)
- Difficulty badge
- Skills tags
- Participant count / max participants
- Time remaining (if has end_date)
- Join/Leave button
- Progress indicator (if joined)

When "Challenges" nav is selected, filter feed to show only challenges (queried from `challenges` table, not `posts`).

---

## Step 6.6 — Challenge Detail Page

New route: `src/routes/_authenticated/challenges.$id.tsx`

Page layout:

- Full challenge info (title, description, type, difficulty, skills)
- Participant list with progress
- Join/Leave button
- Progress tracker (if joined)
- Discussion section (reuse comments from posts table, or create `challenge_comments` table)
- Back to community link

---

## Step 6.7 — Nav Routing + Empty States

Update `src/routes/_authenticated/community.tsx`:

- "Challenges" nav → show challenges from `challenges` table (not posts)
- Update empty states for all nav items to be contextually accurate
- Remove dead-end "Coming soon" messages where we now have real features

Update `src/components/tethyr/community/left-sidebar.tsx`:

- Show challenge count badge on "Challenges" nav item
- Update icon if needed

Update `src/components/tethyr/community/right-sidebar.tsx`:

- Add "Active Challenges" widget showing top 3 active challenges
- Replace "No challenges yet" with real data

---

## Files to Create/Modify

### New files

- `src/hooks/use-challenges.ts` — challenge CRUD hooks
- `src/components/tethyr/community/challenge-card.tsx` — challenge card component
- `src/routes/_authenticated/challenges.$id.tsx` — challenge detail page
- `supabase/migrations/20260722150000_challenges.sql` — database migration

### Modified files

- `src/hooks/use-community.ts` — add new post types to PostType union
- `src/lib/community-data.ts` — add POST_TYPE_LABEL entries for new types
- `src/components/tethyr/community/composer-bar.tsx` — add new types to QUICK_ACTIONS + ACTION_ICON
- `src/routes/_authenticated/community.tsx` — challenge feed routing, nav routing fixes
- `src/components/tethyr/community/left-sidebar.tsx` — challenge count badge
- `src/components/tethyr/community/right-sidebar.tsx` — active challenges widget

---

## Verification

After implementation:

1. `npx tsc --noEmit` — no type errors
2. Apply migration in Supabase SQL Editor
3. `npm run dev` — app loads without errors
4. Community page: all nav items work, no dead ends
5. Challenges: can create, join, view detail, track progress
6. Post types: new types appear in composer and feed filters
7. Git commit + push

---

## Next Phase

Phase 7 — Opportunity Layer (Browse by need: Need Designer / Need Musician / etc.)
