-- ============================================================================
-- GitHub account snapshots (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261014140000_profile_github.sql: snapshots are public to read, only
-- the server writes them (nobody can fake their numbers), and a member can
-- clear their own.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(5);

INSERT INTO auth.users (id, email) VALUES
  ('9a100001-0000-0000-0000-000000000000', 'ghsnap9a1@test.local'),
  ('9a100002-0000-0000-0000-000000000000', 'other9a1@test.local');
INSERT INTO public.profile_github (profile_id, username, snapshot) VALUES
  ('9a100001-0000-0000-0000-000000000000', 'someone', '{"followers": 3}');

SET LOCAL ROLE anon;
SELECT is((SELECT username FROM public.profile_github
            WHERE profile_id = '9a100001-0000-0000-0000-000000000000'),
  'someone', 'anyone can read a snapshot');

RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"9a100001-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$UPDATE public.profile_github SET snapshot = '{"followers": 1000000}'
     WHERE profile_id = '9a100001-0000-0000-0000-000000000000'$$,
  '42501', NULL, 'a member cannot edit their own numbers');
SELECT throws_ok(
  $$INSERT INTO public.profile_github (profile_id, username, snapshot)
    VALUES ('9a100002-0000-0000-0000-000000000000', 'fake', '{}')$$,
  '42501', NULL, 'nobody can write a snapshot from the browser');

RESET ROLE;
SELECT set_config('request.jwt.claims',
  '{"sub":"9a100002-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.profile_github WHERE profile_id = '9a100001-0000-0000-0000-000000000000';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.profile_github
            WHERE profile_id = '9a100001-0000-0000-0000-000000000000'),
  1, 'someone else cannot clear it');

SELECT set_config('request.jwt.claims',
  '{"sub":"9a100001-0000-0000-0000-000000000000","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.profile_github WHERE profile_id = '9a100001-0000-0000-0000-000000000000';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.profile_github
            WHERE profile_id = '9a100001-0000-0000-0000-000000000000'),
  0, 'the member can clear their own (Disconnect)');

SELECT * FROM finish();
ROLLBACK;
