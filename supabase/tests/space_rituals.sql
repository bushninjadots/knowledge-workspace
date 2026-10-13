-- ============================================================================
-- Space rituals: space sessions and the weekly ship thread (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261014130000_space_rituals.sql.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(11);

INSERT INTO auth.users (id, email) VALUES
  ('a1700001-0000-0000-0000-000000000000', 'owner-a170@test.local'),
  ('a1700002-0000-0000-0000-000000000000', 'member-a170@test.local'),
  ('a1700003-0000-0000-0000-000000000000', 'outsider-a170@test.local');

INSERT INTO public.community_spaces (id, name, slug, created_by, visibility, weekly_thread) VALUES
  ('a1700000-0000-0000-0000-0000000000a1', 'Ritual room', 'ritual-room-a170',
   'a1700001-0000-0000-0000-000000000000', 'private', true);
INSERT INTO public.community_space_members (space_id, user_id, role) VALUES
  ('a1700000-0000-0000-0000-0000000000a1', 'a1700001-0000-0000-0000-000000000000', 'owner'),
  ('a1700000-0000-0000-0000-0000000000a1', 'a1700002-0000-0000-0000-000000000000', 'member');

-- ── A member can't schedule in the space; the owner can ────────────────────
SELECT set_config('request.jwt.claims',
  '{"sub":"a1700002-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$INSERT INTO public.sessions (organizer_id, title, session_type, community_id, starts_at)
    VALUES ('a1700002-0000-0000-0000-000000000000', 'Rogue hour', 'workshop',
            'a1700000-0000-0000-0000-0000000000a1', now() + interval '1 day')$$,
  '42501', NULL, 'a member cannot schedule a session in the space'
);

RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"a1700001-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$INSERT INTO public.sessions (id, organizer_id, title, session_type, community_id, starts_at, status)
    VALUES ('a1700000-0000-0000-0000-0000000000b1', 'a1700001-0000-0000-0000-000000000000',
            'Critique hour', 'workshop', 'a1700000-0000-0000-0000-0000000000a1',
            now() + interval '1 day', 'scheduled')$$,
  'the owner schedules a critique hour'
);

-- ── Members see it and can go; outsiders can't ────────────────────────────
RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"a1700002-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.sessions WHERE id = 'a1700000-0000-0000-0000-0000000000b1'),
  1, 'a member sees the space session'
);
SELECT lives_ok(
  $$INSERT INTO public.session_participants (session_id, profile_id, role, status)
    VALUES ('a1700000-0000-0000-0000-0000000000b1', 'a1700002-0000-0000-0000-000000000000',
            'participant', 'accepted')$$,
  'a member says they are going'
);
SELECT throws_ok(
  $$INSERT INTO public.session_participants (session_id, profile_id, role, status)
    VALUES ('a1700000-0000-0000-0000-0000000000b1', 'a1700002-0000-0000-0000-000000000000',
            'mentor', 'accepted')$$,
  NULL, NULL, 'members cannot give themselves another role'
);

SELECT isnt(public.ensure_weekly_thread('a1700000-0000-0000-0000-0000000000a1'), NULL,
  'a member opening the space starts this week''s thread');
SELECT is(public.ensure_weekly_thread('a1700000-0000-0000-0000-0000000000a1'),
  (SELECT id FROM public.posts WHERE space_id = 'a1700000-0000-0000-0000-0000000000a1' AND flair = 'Weekly'),
  'opening it again returns the same thread');
SELECT is(
  (SELECT author_id::text || '|' || is_pinned FROM public.posts
    WHERE space_id = 'a1700000-0000-0000-0000-0000000000a1' AND flair = 'Weekly'),
  'a1700001-0000-0000-0000-000000000000|true',
  'the thread is pinned and posted as the owner'
);

RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"a1700003-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.sessions WHERE id = 'a1700000-0000-0000-0000-0000000000b1'),
  0, 'an outsider does not see a private space''s session'
);
SELECT throws_ok(
  $$INSERT INTO public.session_participants (session_id, profile_id, role, status)
    VALUES ('a1700000-0000-0000-0000-0000000000b1', 'a1700003-0000-0000-0000-000000000000',
            'participant', 'accepted')$$,
  '42501', NULL, 'an outsider cannot join a space session'
);
SELECT is(public.ensure_weekly_thread('a1700000-0000-0000-0000-0000000000a1'), NULL,
  'an outsider cannot start the thread');

SELECT * FROM finish();
ROLLBACK;
