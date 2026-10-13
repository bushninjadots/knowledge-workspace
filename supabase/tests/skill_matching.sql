-- ============================================================================
-- Skill matching notifications (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins 20261014120000_skill_matching.sql: an ask tagged with a skill reaches
-- people who share it (not the author, not people who don't), private spaces
-- only reach members, and nobody gets more than 3 a day.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(6);

INSERT INTO auth.users (id, email) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'asker5c11@test.local'),
  ('5c110002-0000-0000-0000-000000000000', 'expert5c11@test.local'),
  ('5c110003-0000-0000-0000-000000000000', 'other5c11@test.local');

INSERT INTO public.skills (id, slug, name, category) VALUES
  ('5c110000-0000-0000-0000-0000000000a1', 'zig-5c11', 'Zig 5c11', 'Web Development');

-- The asker and the expert both share the skill; the other person doesn't.
INSERT INTO public.profile_skills_teach (profile_id, skill_id) VALUES
  ('5c110001-0000-0000-0000-000000000000', '5c110000-0000-0000-0000-0000000000a1'),
  ('5c110002-0000-0000-0000-000000000000', '5c110000-0000-0000-0000-0000000000a1');

INSERT INTO public.community_spaces (id, name, slug, created_by, visibility) VALUES
  ('5c110000-0000-0000-0000-0000000000b1', 'Hidden 5c11', 'hidden-5c11',
   '5c110001-0000-0000-0000-000000000000', 'private');

CREATE TEMP VIEW matches AS
  SELECT user_id, title FROM public.notifications
   WHERE type = 'skill_match'
     AND user_id IN ('5c110001-0000-0000-0000-000000000000',
                     '5c110002-0000-0000-0000-000000000000',
                     '5c110003-0000-0000-0000-000000000000');

INSERT INTO public.posts (author_id, type, title, body, skills) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'question', 'How do allocators work?', '', '{zig-5c11}');

SELECT is(
  (SELECT string_agg(user_id::text, ',') FROM matches),
  '5c110002-0000-0000-0000-000000000000',
  'an ask reaches the person who shares the skill, not the author or anyone else'
);
SELECT is(
  (SELECT title FROM matches LIMIT 1),
  'asker5c11 needs a hand with Zig 5c11',
  'the notification says who and what'
);

INSERT INTO public.posts (author_id, type, title, body, skills) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'showcase', 'Look', '', '{zig-5c11}');
SELECT is((SELECT count(*)::int FROM matches), 1, 'showing work does not ping anyone');

INSERT INTO public.posts (author_id, type, title, body, skills, space_id) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'help_request', 'Secret help', '', '{zig-5c11}',
   '5c110000-0000-0000-0000-0000000000b1');
SELECT is((SELECT count(*)::int FROM matches), 1,
  'a private space ask does not reach non-members');

INSERT INTO public.posts (author_id, type, title, body, skills) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'collaboration_request', 'Build with me', '', '{zig-5c11}');
SELECT ok(
  EXISTS (SELECT 1 FROM matches WHERE title = 'asker5c11 is looking for someone with Zig 5c11'),
  'a collaboration call says it is looking for someone'
);

INSERT INTO public.posts (author_id, type, title, body, skills) VALUES
  ('5c110001-0000-0000-0000-000000000000', 'question', 'Q3', '', '{zig-5c11}'),
  ('5c110001-0000-0000-0000-000000000000', 'question', 'Q4', '', '{zig-5c11}');
SELECT is((SELECT count(*)::int FROM matches), 3, 'at most three matches a day per person');

SELECT * FROM finish();
ROLLBACK;
