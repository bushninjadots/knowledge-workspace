## Goal

1. Make sign-up / login actually work (currently the forms have no handlers).
2. Build the full creator profile system on top of it.

## Step 1 — Enable Lovable Cloud

Auth + database + storage (for profile photos) all need a backend. I'll enable Cloud, then wire Supabase auth.

## Step 2 — Auth that works

- Wire `signup.tsx` to `supabase.auth.signUp` (email + password, `emailRedirectTo: window.location.origin`).
- Wire `login.tsx` to `supabase.auth.signInWithPassword`.
- Add toasts for success/error, redirect to `/dashboard` on success.
- Add a root `onAuthStateChange` listener and a sign-out button in the dashboard.
- Move `/dashboard` under `src/routes/_authenticated/` so it's gated (integration-managed layout).

## Step 3 — Database schema (migration)

Tables in `public`:

- `profiles` — one row per user, auto-created via trigger on `auth.users` insert.
  Columns: `id (uuid pk → auth.users)`, `display_name`, `handle (unique)`, `bio`, `avatar_url`, `country`, `timezone`, `languages text[]`, `category`, `years_experience int`, `portfolio_links jsonb`, `social_links jsonb`, `available_days text[]`, `available_times text[]`, `teaching_style`, `learning_goals`, timestamps.
- `skills` — controlled catalog. Columns: `id`, `slug (unique)`, `name`, `category`, `icon`. Seeded with the list the user mentioned (Premiere Pro, DaVinci, AE, Motion Graphics, Photoshop, Illustrator, SEO, WordPress, Photography, Music Production, Streaming, YouTube Growth, Social Media, Programming, etc.) grouped by category.
- `profile_skills_teach` — `(profile_id, skill_id)` join.
- `profile_skills_learn` — `(profile_id, skill_id)` join.

RLS:

- `profiles`: public SELECT (so profiles are viewable), owner-only INSERT/UPDATE/DELETE.
- `skills`: public SELECT, no writes from clients.
- join tables: public SELECT, owner-only writes (where `profile_id = auth.uid()`).

GRANTs on every public table per project rules.

A trigger on `auth.users` insert creates a `profiles` row with `display_name` and `handle` taken from signup metadata.

Storage bucket `avatars` (public) with owner-only write policies.

## Step 4 — Profile UI

New route `src/routes/_authenticated/profile.tsx` (the user's own profile, editable). Public view at `/u/$handle` is out of scope for this turn — say so explicitly.

Layout: modern creator portfolio (NOT LinkedIn).

- **Header card**: large avatar with upload, display name, handle, category badge, country/timezone, completeness ring (0–100%).
- **About card**: bio, languages (chips), years of experience.
- **Skills I Teach** + **Skills I Want To Learn**: two cards, each opens a picker dialog backed by the `skills` table — searchable, grouped by category, multi-select. No free text.
- **Availability card**: day chips (Mon–Sun) + time-of-day chips (Mornings / Afternoons / Evenings / Late night).
- **Teaching style** + **Learning goals**: textarea cards.
- **Links card**: portfolio links + social links (typed: website, YouTube, Instagram, X, TikTok, Twitch, GitHub, LinkedIn).

Each card has an inline Edit button → opens a Dialog with the relevant form, saves via a server function (`updateProfile`, `setTeachSkills`, `setLearnSkills`, `uploadAvatar`).

Completeness % is computed client-side from filled sections (12 sections, 100/12 each).

Dashboard sidebar gets a "Profile" link.

## Step 5 — Server functions

In `src/lib/profile.functions.ts` (client-safe path):

- `getMyProfile` — returns profile + teach/learn skills.
- `updateProfile` — partial update, zod-validated.
- `setTeachSkills(skillIds[])` / `setLearnSkills(skillIds[])` — replace join rows.
- `listSkills` — public, returns the catalog grouped by category (uses server publishable client, no auth needed).

All write fns use `requireSupabaseAuth`.

## Out of scope for this turn

- Public profile pages at `/u/$handle`.
- Discovery / search of other creators.
- Endorsements, sessions, messaging.

## Technical notes

- Skills seeded via migration (catalog data lives in schema migration).
- Avatar upload uses Supabase Storage `avatars` bucket, path `${userId}/avatar.${ext}`.
- All colors stay on existing Tethyr tokens — green/purple accents, dark surfaces, rounded cards.
