-- ============================================================================
-- Tethyr RLS regression tests (pgTAP)
-- ============================================================================
-- Run with: supabase test db   (or hand-run against a scratch DB, never prod)
--
-- * "alice", "bob", "eve" are seeded auth.users
-- * pg_temp.as_user(uid) switches role + JWT claims to simulate a signed-in user
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixture setup (idempotent for local scratch DBs)
-- ---------------------------------------------------------------------------
DO $$
DECLARE _u uuid;
BEGIN
  FOREACH _u IN ARRAY ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  ] LOOP
    INSERT INTO auth.users(id, email) VALUES (_u, _u::text || '@test.local')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.profiles(id, display_name, handle)
      VALUES (_u, 'user_' || substr(_u::text,1,4), 'u' || substr(_u::text,1,6))
      ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- helper: pretend to be `uid`
CREATE OR REPLACE FUNCTION pg_temp.as_user(uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
END $$;

SELECT plan(48);

-- ---------------------------------------------------------------------------
-- 1. profiles: anyone can SELECT, only owner can UPDATE
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');

SELECT is(
  (SELECT count(*) FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111')::bigint,
  1::bigint,
  '1. anyone can read a public profile (bob sees alice)'
);

-- RLS silently filters USING rows — verify the value is unchanged, not an error.
CREATE TEMP TABLE _profile_before AS
  SELECT display_name FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET display_name = 'hacked'
  WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT display_name FROM public.profiles
    WHERE id = '11111111-1111-1111-1111-111111111111'),
  (SELECT display_name FROM _profile_before),
  '2. cross-user profile update rejected (bob cannot change alice)'
);

-- ---------------------------------------------------------------------------
-- 2. handle format constraint
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
  $$UPDATE public.profiles SET handle = 'has space'
      WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  NULL, '3. invalid handle (spaces) rejected by check constraint'
);

-- ---------------------------------------------------------------------------
-- 3. connections: addressee cannot forge requester_id
-- ---------------------------------------------------------------------------
INSERT INTO public.connections(requester_id, addressee_id)
  VALUES ('11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222')
  ON CONFLICT DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$UPDATE public.connections
      SET requester_id = '33333333-3333-3333-3333-333333333333'
      WHERE addressee_id = '22222222-2222-2222-2222-222222222222'$$,
  NULL, '4. requester_id tamper blocked by immutable-fields trigger'
);

SELECT throws_ok(
  $$UPDATE public.connections SET status = 'pending'
      WHERE addressee_id = '22222222-2222-2222-2222-222222222222'$$,
  NULL, '5. resetting status back to pending is rejected'
);

-- EXPECT: valid accept succeeds.
UPDATE public.connections SET status = 'accepted'
  WHERE addressee_id = '22222222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT count(*) FROM public.connections
    WHERE status = 'accepted'
      AND requester_id = '11111111-1111-1111-1111-111111111111'
      AND addressee_id = '22222222-2222-2222-2222-222222222222')::bigint,
  1::bigint,
  '6. addressee can accept a connection'
);

-- ---------------------------------------------------------------------------
-- 4. messages: only participants can read/insert
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.messages(connection_id, sender_id, body)
  SELECT id, '11111111-1111-1111-1111-111111111111', 'hello bob'
    FROM public.connections
    WHERE requester_id = '11111111-1111-1111-1111-111111111111'
      AND addressee_id = '22222222-2222-2222-2222-222222222222';

SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.messages)::bigint,
  0::bigint,
  '7. third party (eve) cannot read the thread'
);

-- Eve opens a pending request to alice so she has a connection row to target.
INSERT INTO public.connections(requester_id, addressee_id)
  VALUES ('33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111')
  ON CONFLICT DO NOTHING;

SELECT throws_ok(
  $$INSERT INTO public.messages(connection_id, sender_id, body)
      SELECT id, '33333333-3333-3333-3333-333333333333', 'sneaky'
        FROM public.connections
        WHERE requester_id = '33333333-3333-3333-3333-333333333333'$$,
  NULL, '8. insert on a non-accepted connection is rejected'
);

-- ---------------------------------------------------------------------------
-- 5. activity_events: nobody but definer functions can insert
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT throws_ok(
  $$INSERT INTO public.activity_events(profile_id, kind, metadata)
      VALUES ('11111111-1111-1111-1111-111111111111', 'fake', '{}')$$,
  NULL, '9. direct activity insert blocked (SECURITY DEFINER path only)'
);

-- ---------------------------------------------------------------------------
-- 6. project_contributors / project_skills: owner-only writes, public reads
-- ---------------------------------------------------------------------------
INSERT INTO public.projects(profile_id, title)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Alice''s SaaS')
  ON CONFLICT DO NOTHING;

SELECT is(
  (SELECT count(*) FROM public.project_contributors
    WHERE profile_id = '11111111-1111-1111-1111-111111111111' AND role = 'creator')::bigint,
  1::bigint,
  '10. creator row auto-added by insert trigger'
);

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.project_contributors(project_id, profile_id, role)
      SELECT id, '22222222-2222-2222-2222-222222222222', 'contributor'
        FROM public.projects WHERE title = 'Alice''s SaaS'$$,
  NULL, '11. bob cannot self-join without owner approval'
);

SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$INSERT INTO public.project_contributors(project_id, profile_id, role)
      SELECT id, '22222222-2222-2222-2222-222222222222', 'mentor'
        FROM public.projects WHERE title = 'Alice''s SaaS'$$,
  NULL, '12. eve cannot add others to a project she does not own'
);

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
DELETE FROM public.project_contributors
  WHERE profile_id = '11111111-1111-1111-1111-111111111111' AND role = 'creator';
SELECT is(
  (SELECT count(*) FROM public.project_contributors
    WHERE profile_id = '11111111-1111-1111-1111-111111111111' AND role = 'creator')::bigint,
  1::bigint,
  '13. creator row protected from non-owner removal'
);

SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$INSERT INTO public.project_skills(project_id, skill_id)
      SELECT p.id, s.id FROM public.projects p, public.skills s
        WHERE p.title = 'Alice''s SaaS' LIMIT 1$$,
  NULL, '14. non-owner cannot manage project_skills'
);

-- ---------------------------------------------------------------------------
-- 7. skill_endorsements: no self-endorsement, no forging endorsed_by
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.profile_skills_teach(profile_id, skill_id)
  SELECT '11111111-1111-1111-1111-111111111111', id FROM public.skills LIMIT 1
  ON CONFLICT DO NOTHING;

SELECT throws_ok(
  $$INSERT INTO public.skill_endorsements(profile_id, skill_id, endorsed_by)
      SELECT '11111111-1111-1111-1111-111111111111', id, '11111111-1111-1111-1111-111111111111'
        FROM public.skills LIMIT 1$$,
  NULL, '15. self-endorsement blocked'
);

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.skill_endorsements(profile_id, skill_id, endorsed_by)
      SELECT '11111111-1111-1111-1111-111111111111', id, '33333333-3333-3333-3333-333333333333'
        FROM public.skills LIMIT 1$$,
  NULL, '16. cannot forge an endorsement on someone else''s behalf'
);

INSERT INTO public.skill_endorsements(profile_id, skill_id, endorsed_by)
  SELECT '11111111-1111-1111-1111-111111111111', id, '22222222-2222-2222-2222-222222222222'
    FROM public.skills LIMIT 1;
SELECT is(
  (SELECT count(*) FROM public.skill_endorsements
    WHERE profile_id = '11111111-1111-1111-1111-111111111111')::bigint,
  1::bigint,
  '17. real endorsement succeeds'
);

-- ---------------------------------------------------------------------------
-- 8. project visibility + project-media storage
--    Alice creates a PRIVATE project; files live under the project folder.
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.projects(id, profile_id, title, visibility)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'Alice Private', 'private')
  ON CONFLICT (id) DO NOTHING;

SELECT is(
  (SELECT count(*) FROM public.project_contributors
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND role = 'creator')::bigint,
  1::bigint,
  '18. private project also gets a creator contributor row'
);

INSERT INTO public.project_contributors(project_id, profile_id, role)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '22222222-2222-2222-2222-222222222222', 'contributor');

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT is(
  (SELECT count(*) FROM public.projects
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  1::bigint,
  '19. contributor can see the private project'
);

SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.projects
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  0::bigint,
  '20. non-member cannot see the private project'
);

-- anon cannot see it either.
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
SELECT is(
  (SELECT count(*) FROM public.projects
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  0::bigint,
  '21. anonymous cannot see the private project'
);

SELECT is(
  (SELECT count(*) FROM public.projects WHERE title = 'Alice''s SaaS')::bigint,
  1::bigint,
  '22. anonymous can still see alice''s public project'
);

-- Storage: owner can upload into her project's folder.
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/owner-file.bin',
              '11111111-1111-1111-1111-111111111111')$$,
  '23. owner can upload into the project folder'
);

-- EXPECT: covers still work — owner can upload into her own uid folder.
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('project-media', '11111111-1111-1111-1111-111111111111/cover.png',
              '11111111-1111-1111-1111-111111111111')$$,
  '24. cover upload into owner''s uid folder still allowed'
);

-- EXPECT: contributor can upload into the project's folder.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bob-file.bin',
              '22222222-2222-2222-2222-222222222222')$$,
  '25. contributor can upload into the project folder'
);

-- EXPECT: eve (non-member) cannot upload into the project's folder.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/eve-file.bin',
              '33333333-3333-3333-3333-333333333333')$$,
  NULL, '26. non-member project upload rejected'
);

-- ---------------------------------------------------------------------------
-- 9. Child-table privacy: the same private project, queried directly.
--    The visibility-aware SELECT policies must hold on every gated table.
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.project_updates(project_id, author_id, title, body)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'Private update', 'secret');
INSERT INTO public.project_discussions(project_id, author_id, title, body)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'Private discussion', 'secret');
INSERT INTO public.project_activity(project_id, actor_id, kind, title)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '11111111-1111-1111-1111-111111111111', 'milestone_done', 'secret event');

-- Contributor can read the private child rows.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT is(
  (SELECT count(*) FROM public.project_updates
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  1::bigint,
  '27. contributor can read private project updates'
);
SELECT is(
  (SELECT count(*) FROM public.project_discussions
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  1::bigint,
  '28. contributor can read private project discussions'
);

-- Non-member cannot read ANY of the private child rows.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.project_updates
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  0::bigint,
  '29. non-member cannot read private project updates'
);
SELECT is(
  (SELECT count(*) FROM public.project_discussions
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  0::bigint,
  '30. non-member cannot read private project discussions'
);
SELECT is(
  (SELECT count(*) FROM public.project_activity
    WHERE project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::bigint,
  0::bigint,
  '31. non-member cannot read private project activity'
);

-- ---------------------------------------------------------------------------
-- 10. challenge review: participants cannot self-award passes
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.challenges(id, title, description, created_by, status)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Review challenge', 'Review fixture',
          '11111111-1111-1111-1111-111111111111', 'active')
  ON CONFLICT (id) DO NOTHING;
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
INSERT INTO public.challenge_participants(
    id, challenge_id, user_id, status
  )
  VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
          '22222222-2222-2222-2222-222222222222', 'in_progress')
  ON CONFLICT (id) DO NOTHING;
UPDATE public.challenge_participants
  SET status = 'completed', review_status = 'submitted', submitted_at = now(),
      submission_url = 'https://example.test/submission'
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

SELECT throws_ok(
  $$UPDATE public.challenge_participants
      SET review_status = 'passed'
      WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  NULL, '34. participant cannot self-award a challenge pass'
);

SELECT throws_ok(
  $$UPDATE public.challenge_participants
      SET submission_url = NULL
      WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  NULL, '35. participant cannot submit without evidence'
);

SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
UPDATE public.challenge_participants
  SET review_status = 'rejected', reviewer_note = 'Add more evidence', reviewed_at = now()
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
UPDATE public.challenge_participants
  SET review_status = 'submitted', status = 'completed', submitted_at = now(),
      submission_url = 'https://example.test/resubmission', reviewer_note = NULL, reviewed_at = NULL
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
UPDATE public.challenge_participants
  SET review_status = 'passed', reviewed_at = now()
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT is(
  (SELECT review_status FROM public.challenge_participants
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'passed',
  '36. challenge creator can pass another participant after resubmission'
);
SELECT is(
  (SELECT submission_url FROM public.challenge_participants
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'https://example.test/resubmission',
  '37. participant can resubmit evidence after rejection'
);

INSERT INTO public.challenge_participants(id, challenge_id, user_id, status)
  VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
          '11111111-1111-1111-1111-111111111111', 'completed')
  ON CONFLICT (id) DO NOTHING;
SELECT throws_ok(
  $$UPDATE public.challenge_participants
      SET review_status = 'passed'
      WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  NULL, '38. challenge creator cannot pass their own participation'
);

SELECT is(
  (SELECT count(*) FROM public.contribution_log
    WHERE profile_id = '22222222-2222-2222-2222-222222222222'
      AND action = 'challenge_completed'
      AND metadata->>'challenge_id' = 'cccccccc-cccc-cccc-cccc-cccccccccccc')::bigint,
  1::bigint,
  '39. reputation is awarded once after a creator-approved pass'
);

-- ---------------------------------------------------------------------------
-- 11. sessions: is_session_member() must be callable by authenticated users
--     (regression: 42501 "permission denied for function is_session_member")
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.sessions(organizer_id, title)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Alice''s Build Session');

SELECT is(
  (SELECT count(*) FROM public.sessions
    WHERE organizer_id = '11111111-1111-1111-1111-111111111111')::bigint,
  1::bigint,
  '32. organizer can read her own sessions'
);

-- The policy evaluates is_session_member() for rows owned by someone else;
-- before the grant it raised 42501 instead of filtering.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.sessions
    WHERE organizer_id = '11111111-1111-1111-1111-111111111111')::bigint,
  0::bigint,
  '33. non-member session read filtered (no permission-denied error)'
);

-- ---------------------------------------------------------------------------
-- 12. Community space privacy: private spaces + their posts are hidden
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.community_spaces(id, name, slug, description, created_by, visibility)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000001', 'Alice Private Space', 'alice-private-space',
          'secret', '11111111-1111-1111-1111-111111111111', 'private')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.community_space_members(space_id, user_id, role)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'owner')
  ON CONFLICT DO NOTHING;
INSERT INTO public.posts(id, author_id, type, title, space_id)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000002',
          '11111111-1111-1111-1111-111111111111', 'discussion',
          'Private space post', 'f0f0f0f0-0000-4000-8000-000000000001')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO public.community_spaces(id, name, slug, description, created_by, visibility)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000003', 'Alice Public Space', 'alice-public-space',
          'open', '11111111-1111-1111-1111-111111111111', 'public')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.posts(id, author_id, type, title, space_id)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000004',
          '11111111-1111-1111-1111-111111111111', 'discussion',
          'Public space post', 'f0f0f0f0-0000-4000-8000-000000000003')
  ON CONFLICT (id) DO NOTHING;

-- Non-member cannot see the private space or its posts.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT is(
  (SELECT count(*) FROM public.community_spaces
    WHERE id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  '40. non-member cannot see a private space'
);
SELECT is(
  (SELECT count(*) FROM public.posts
    WHERE space_id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  '41. non-member cannot see posts in a private space'
);

-- Anonymous cannot see it either.
SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
SELECT is(
  (SELECT count(*) FROM public.community_spaces
    WHERE id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  '42. anonymous cannot see a private space'
);
SELECT is(
  (SELECT count(*) FROM public.posts
    WHERE space_id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  0::bigint,
  '43. anonymous cannot see posts in a private space'
);

-- Creator can still see her own private space + its posts.
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT is(
  (SELECT count(*) FROM public.community_spaces
    WHERE id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  1::bigint,
  '44. creator can see her private space'
);
SELECT is(
  (SELECT count(*) FROM public.posts
    WHERE space_id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  1::bigint,
  '45. creator can see posts in her private space'
);

-- Public spaces stay world-readable.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.community_spaces
    WHERE id = 'f0f0f0f0-0000-4000-8000-000000000003')::bigint,
  1::bigint,
  '46. non-member can see a public space'
);
SELECT is(
  (SELECT count(*) FROM public.posts
    WHERE space_id = 'f0f0f0f0-0000-4000-8000-000000000003')::bigint,
  1::bigint,
  '47. non-member can see posts in a public space'
);

-- A member who joins the private space can then see it.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
INSERT INTO public.community_space_members(space_id, user_id, role)
  VALUES ('f0f0f0f0-0000-4000-8000-000000000001',
          '22222222-2222-2222-2222-222222222222', 'member')
  ON CONFLICT DO NOTHING;
SELECT is(
  (SELECT count(*) FROM public.community_spaces
    WHERE id = 'f0f0f0f0-0000-4000-8000-000000000001')::bigint,
  1::bigint,
  '48. a member can see a private space after joining'
);

SELECT * FROM finish();
ROLLBACK;
