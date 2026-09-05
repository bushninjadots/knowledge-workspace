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

SELECT plan(108);

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

-- Storage: owner can upload into her project's folder (valid library ext).
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/owner-file.pdf',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '23. owner can upload into the project folder'
);

-- EXPECT: covers still work — owner can upload into her own uid folder.
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', '11111111-1111-1111-1111-111111111111/cover.png',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '24. cover upload into owner''s uid folder still allowed'
);

-- EXPECT: contributor can upload into the project's folder.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bob-file.pdf',
              '22222222-2222-2222-2222-222222222222', '{"size": 1000}')$$,
  '25. contributor can upload into the project folder'
);

-- EXPECT: eve (non-member) cannot upload into the project's folder.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/eve-file.pdf',
              '33333333-3333-3333-3333-333333333333', '{"size": 1000}')$$,
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

-- A non-member cannot self-join a private space (no self-serve access).
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.community_space_members(space_id, user_id, role)
      VALUES ('f0f0f0f0-0000-4000-8000-000000000001',
              '22222222-2222-2222-2222-222222222222', 'member')$$,
  NULL, '48. a non-member cannot self-join a private space'
);

-- ---------------------------------------------------------------------------
-- 13. Team membership: no self-granted lead, and a crew keeps its last lead
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.teams(id, name, slug, created_by)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000001', 'Alice Crew', 'alice-crew',
          '11111111-1111-1111-1111-111111111111')
  ON CONFLICT (id) DO NOTHING;

SELECT throws_ok(
  $$DELETE FROM public.team_members
      WHERE team_id = 'b0b0b0b0-0000-4000-8000-000000000001'
        AND profile_id = '11111111-1111-1111-1111-111111111111'$$,
  NULL, '49. the last lead cannot remove themself'
);

SELECT throws_ok(
  $$UPDATE public.team_members SET role = 'contributor'
      WHERE team_id = 'b0b0b0b0-0000-4000-8000-000000000001'
        AND profile_id = '11111111-1111-1111-1111-111111111111'$$,
  NULL, '50. the last lead cannot demote themself'
);

INSERT INTO public.team_invites(team_id, profile_id, invited_by)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000001',
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111')
  ON CONFLICT DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.team_members(team_id, profile_id, role)
      VALUES ('b0b0b0b0-0000-4000-8000-000000000001',
              '22222222-2222-2222-2222-222222222222', 'lead')$$,
  NULL, '51. an invitee cannot self-insert as lead'
);

INSERT INTO public.team_members(team_id, profile_id, role)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000001',
          '22222222-2222-2222-2222-222222222222', 'contributor')
  ON CONFLICT DO NOTHING;
SELECT is(
  (SELECT count(*) FROM public.team_members
    WHERE team_id = 'b0b0b0b0-0000-4000-8000-000000000001'
      AND profile_id = '22222222-2222-2222-2222-222222222222'
      AND role = 'contributor')::bigint,
  1::bigint,
  '52. an invitee can join as contributor'
);

-- ---------------------------------------------------------------------------
-- 14. Space membership: no self-granted owner, moderators can't depose owners
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.community_spaces(id, name, slug, description, created_by, visibility, join_type)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000002', 'Alice Space', 'alice-space-2', 'x',
          '11111111-1111-1111-1111-111111111111', 'public', 'auto')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.community_space_members(space_id, user_id, role)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000002',
          '11111111-1111-1111-1111-111111111111', 'owner')
  ON CONFLICT DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.community_space_members(space_id, user_id, role)
      VALUES ('b0b0b0b0-0000-4000-8000-000000000002',
              '22222222-2222-2222-2222-222222222222', 'owner')$$,
  NULL, '53. a non-member cannot self-insert as space owner'
);

INSERT INTO public.community_space_members(space_id, user_id, role)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000002',
          '22222222-2222-2222-2222-222222222222', 'member')
  ON CONFLICT DO NOTHING;
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
UPDATE public.community_space_members SET role = 'moderator'
  WHERE space_id = 'b0b0b0b0-0000-4000-8000-000000000002'
    AND user_id = '22222222-2222-2222-2222-222222222222';

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
DELETE FROM public.community_space_members
  WHERE space_id = 'b0b0b0b0-0000-4000-8000-000000000002'
    AND user_id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT count(*) FROM public.community_space_members
    WHERE space_id = 'b0b0b0b0-0000-4000-8000-000000000002'
      AND user_id = '11111111-1111-1111-1111-111111111111'
      AND role = 'owner')::bigint,
  1::bigint,
  '54. a moderator cannot remove an owner'
);

-- ---------------------------------------------------------------------------
-- 15. Role applications: applicants can't self-accept
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.projects(id, profile_id, title, visibility)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000003',
          '11111111-1111-1111-1111-111111111111', 'Alice Roles', 'public')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_open_roles(id, project_id, title)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000004',
          'b0b0b0b0-0000-4000-8000-000000000003', 'Tester')
  ON CONFLICT (id) DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.project_role_applications(role_id, profile_id, status)
      VALUES ('b0b0b0b0-0000-4000-8000-000000000004',
              '22222222-2222-2222-2222-222222222222', 'accepted')$$,
  NULL, '55. an applicant cannot self-accept an application'
);

-- ---------------------------------------------------------------------------
-- 16. Session participants: no self-granted organizer role
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.sessions(id, organizer_id, title)
  VALUES ('b0b0b0b0-0000-4000-8000-000000000005',
          '11111111-1111-1111-1111-111111111111', 'Alice Session')
  ON CONFLICT (id) DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$INSERT INTO public.session_participants(session_id, profile_id, role)
      VALUES ('b0b0b0b0-0000-4000-8000-000000000005',
              '22222222-2222-2222-2222-222222222222', 'organizer')$$,
  NULL, '56. a user cannot self-insert as session organizer'
);

-- ---------------------------------------------------------------------------
-- 17. Project sessions: project contributors can read the project's sessions
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.sessions(id, organizer_id, title, project_id)
  VALUES ('c0c0c0c0-0000-4000-8000-000000000006',
          '11111111-1111-1111-1111-111111111111',
          'Alice Project Sync',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  ON CONFLICT (id) DO NOTHING;

-- Bob is a contributor of the project but neither organizer nor participant
-- of the session; the new policy should let the team read it.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT is(
  (SELECT count(*) FROM public.sessions
    WHERE id = 'c0c0c0c0-0000-4000-8000-000000000006')::bigint,
  1::bigint,
  '57. a project contributor can read the project''s sessions'
);

-- Eve is neither a contributor nor a participant: still hidden.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.sessions
    WHERE id = 'c0c0c0c0-0000-4000-8000-000000000006')::bigint,
  0::bigint,
  '58. a non-contributor cannot read the project''s sessions'
);

-- ---------------------------------------------------------------------------
-- 18. Project challenges: linking requires being on the project's team
-- ---------------------------------------------------------------------------
-- Eve is not on Alice's project, so she cannot hang a challenge on it.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$INSERT INTO public.challenges(title, description, created_by, project_id)
      VALUES ('Eve Challenge', 'x', '33333333-3333-3333-3333-333333333333',
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  NULL, '59. a non-contributor cannot link a challenge to a project'
);

-- Bob is a contributor of Alice's project, so linking works.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT lives_ok(
  $$INSERT INTO public.challenges(title, description, created_by, project_id)
      VALUES ('Bob Challenge', 'x', '22222222-2222-2222-2222-222222222222',
              'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  '60. a project contributor can link a challenge to the project'
);

-- ---------------------------------------------------------------------------
-- 19. Curated starter challenges: labeled by the Tethyr team only
-- ---------------------------------------------------------------------------
-- Anyone can read starter challenges (they are public like all challenges).
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT is(
  (SELECT count(*) FROM public.challenges WHERE is_starter)::bigint,
  5::bigint,
  '61. starter challenges are world-readable'
);

-- A regular user cannot spoof the curated label.
SELECT throws_ok(
  $$INSERT INTO public.challenges(title, description, created_by, is_starter)
      VALUES ('Fake Starter', 'x', '33333333-3333-3333-3333-333333333333', true)$$,
  NULL, '62. a non-curator cannot create a starter challenge'
);

-- Updating an existing challenge to is_starter = true is also blocked.
-- (Bob created 'Bob Challenge', so he can update it — but not relabel it.)
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT throws_ok(
  $$UPDATE public.challenges
     SET is_starter = true
    WHERE title = 'Bob Challenge'$$,
  NULL, '63. a non-curator cannot relabel a challenge as a starter'
);

-- The curator (Tethyr Team account) can insert a starter challenge.
SELECT pg_temp.as_user('a1d676d3-1a76-401f-bc30-0e4195569e27');
SELECT lives_ok(
  $$INSERT INTO public.challenges(title, description, created_by, is_starter)
      VALUES ('Curated Starter', 'x', 'a1d676d3-1a76-401f-bc30-0e4195569e27', true)$$,
  '64. the curator can create a starter challenge'
);

-- ---------------------------------------------------------------------------
-- 20. Role application races + auto-decline
-- ---------------------------------------------------------------------------
-- Alice creates a project + one open role; Bob and Eve both apply.
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.projects(id, profile_id, title)
  VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          '11111111-1111-1111-1111-111111111111',
          'Race Project')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.project_open_roles(id, project_id, title)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          'Designer')
  ON CONFLICT (id) DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
INSERT INTO public.project_role_applications(id, role_id, profile_id)
  VALUES ('dddddddd-dddd-dddd-dddd-ddddddddddd1',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
          '22222222-2222-2222-2222-222222222222')
  ON CONFLICT DO NOTHING;

SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
INSERT INTO public.project_role_applications(id, role_id, profile_id)
  VALUES ('dddddddd-dddd-dddd-dddd-ddddddddddd2',
          'cccccccc-cccc-cccc-cccc-cccccccccccc',
          '33333333-3333-3333-3333-333333333333')
  ON CONFLICT DO NOTHING;

-- A non-owner cannot accept (or decline) someone's application.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
SELECT throws_ok(
  $$SELECT public.accept_project_role_application(
      'dddddddd-dddd-dddd-dddd-ddddddddddd1',
      '22222222-2222-2222-2222-222222222222',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  NULL, '65. non-owner cannot accept a role application'
);

-- Owner accepts Bob: accepted, role filled, Eve auto-declined.
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT lives_ok(
  $$SELECT public.accept_project_role_application(
      'dddddddd-dddd-dddd-dddd-ddddddddddd1',
      '22222222-2222-2222-2222-222222222222',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '66. owner accepts the application'
);
SELECT is(
  (SELECT status FROM public.project_role_applications
    WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1'),
  'accepted', '67. accepted application is marked accepted'
);
SELECT is(
  (SELECT status FROM public.project_role_applications
    WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2'),
  'declined', '68. rival application is auto-declined when the role fills'
);
SELECT is(
  (SELECT is_filled FROM public.project_open_roles
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  true, '69. open role is marked filled after accept'
);

-- Accepting the now-filled role (or an already-decided app) is rejected.
SELECT throws_ok(
  $$SELECT public.accept_project_role_application(
      'dddddddd-dddd-dddd-dddd-ddddddddddd2',
      '33333333-3333-3333-3333-333333333333',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  NULL, '70. accepting after the role is filled is rejected'
);
SELECT throws_ok(
  $$SELECT public.decline_project_role_application(
      'dddddddd-dddd-dddd-dddd-ddddddddddd2',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  NULL, '71. declining an already-decided application is rejected'
);

-- ---------------------------------------------------------------------------
-- 11. Storage upload hardening: extension allowlists + size caps.
--     The client validators (src/lib/validators.ts) are mirrored server-side
--     in public.is_allowed_storage_upload, used by every INSERT/UPDATE
--     storage policy. These tests pin that behaviour.
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- EXPECT: an executable is rejected even though the folder is owned.
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('avatars', '11111111-1111-1111-1111-111111111111/evil.exe',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  NULL, '72. avatars reject disallowed extension (.exe)'
);

-- EXPECT: an SVG (script-capable) is rejected for avatars, not just exe.
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.svg',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  NULL, '73. avatars reject SVG (embedded-script vector)'
);

-- EXPECT: an oversized image is rejected even with a valid extension.
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png',
              '11111111-1111-1111-1111-111111111111', '{"size": 8388609}')$$,
  NULL, '74. avatars reject image over 8 MB'
);

-- EXPECT: a valid avatar still lands.
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '75. avatars accept a valid PNG'
);

-- EXPECT: proofs allow PDF but reject executables.
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('skill-proofs', '11111111-1111-1111-1111-111111111111/cert.pdf',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '76. skill-proofs accept a PDF'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('skill-proofs', '11111111-1111-1111-1111-111111111111/cert.exe',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  NULL, '77. skill-proofs reject .exe'
);

-- EXPECT: library-files allow code files (a core use case) but cap size.
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('library-files', '11111111-1111-1111-1111-111111111111/code.ts',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  '78. library-files accept a TS file'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('library-files', '11111111-1111-1111-1111-111111111111/big.mov',
              '11111111-1111-1111-1111-111111111111', '{"size": 209715201}')$$,
  NULL, '79. library-files reject video over 200 MB'
);

-- EXPECT: the same gate applies to project-media (video is allowed up to its cap).
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/demo.mp4',
              '11111111-1111-1111-1111-111111111111', '{"size": 209715200}')$$,
  '80. project-media accept a 200 MB video'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/demo.mp4',
              '11111111-1111-1111-1111-111111111111', '{"size": 209715201}')$$,
  NULL, '81. project-media reject video over 200 MB'
);

-- EXPECT: a video path with a 60 MB payload (50 MB default cap) is rejected.
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('project-media', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/big.pdf',
              '11111111-1111-1111-1111-111111111111', '{"size": 52428801}')$$,
  NULL, '82. project-media reject non-media file over 50 MB'
);

-- EXPECT: banner/background/team-avatar buckets share the image gate.
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('banners', '11111111-1111-1111-1111-111111111111/banner.svg',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  NULL, '83. banners reject SVG'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('backgrounds', '11111111-1111-1111-1111-111111111111/bg.exe',
              '11111111-1111-1111-1111-111111111111', '{"size": 1000}')$$,
  NULL, '84. backgrounds reject .exe'
);

-- EXPECT: challenge submissions accept a PDF but reject an executable.
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('challenge-submissions',
              '22222222-2222-2222-2222-222222222222/submission.pdf',
              '22222222-2222-2222-2222-222222222222', '{"size": 1000}')$$,
  '85. challenge-submissions accept a PDF'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner, metadata)
      VALUES ('challenge-submissions',
              '22222222-2222-2222-2222-222222222222/submission.exe',
              '22222222-2222-2222-2222-222222222222', '{"size": 1000}')$$,
  NULL, '86. challenge-submissions reject .exe'
);

-- ---------------------------------------------------------------------------
-- 12. Community posts upload limits: images, body, title, link scheme.
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- EXPECT: a valid post with one small data-URL image still lands.
SELECT lives_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, images)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000001',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Img post',
              'hello', ARRAY['data:image/png;base64,iVBORw0KGgo='])$$,
  '87. post with a valid data-URL image is accepted'
);

-- EXPECT: more than 4 images is rejected server-side.
SELECT throws_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, images)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000002',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Img flood',
              'hello', ARRAY[
                'data:image/png;base64,AAAA', 'data:image/png;base64,BBBB',
                'data:image/png;base64,CCCC', 'data:image/png;base64,DDDD',
                'data:image/png;base64,EEEE'])$$,
  NULL, '88. more than 4 post images is rejected'
);

-- EXPECT: an oversized base64 image (> 12 MB) is rejected.
SELECT throws_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, images)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000003',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Big img',
              'hello', ARRAY['data:image/png;base64,' || repeat('A', 12582912)])$$,
  NULL, '89. oversized post image (> 12 MB) is rejected'
);

-- EXPECT: an image element that isn't an image/http(s) URL is rejected.
SELECT throws_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, images)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000004',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Bad img',
              'hello', ARRAY['javascript:alert(1)'])$$,
  NULL, '90. post image must be data:image or http(s) URL'
);

-- EXPECT: a javascript: link_url is rejected (stored-XSS guard).
SELECT throws_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, link_url)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000005',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Bad link',
              'hello', 'javascript:alert(1)')$$,
  NULL, '91. javascript: link_url is rejected'
);

-- EXPECT: a normal https link is fine.
SELECT lives_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body, link_url)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000006',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Good link',
              'hello', 'https://example.com/work')$$,
  '92. https link_url is accepted'
);

-- EXPECT: body beyond the 2000-char composer cap is rejected.
SELECT throws_ok(
  $$INSERT INTO public.posts(id, author_id, type, title, body)
      VALUES ('e0e0e0e0-0000-4000-8000-000000000007',
              '11111111-1111-1111-1111-111111111111', 'discussion', 'Long body',
              repeat('x', 2001))$$,
  NULL, '93. post body over 2000 chars is rejected'
);

-- ---------------------------------------------------------------------------
-- 13. OAuth profile creation: handle_new_user picks up provider names.
-- ---------------------------------------------------------------------------
-- Google/Apple send full_name, GitHub sends user_name/name. The auto-created
-- profile should use it instead of falling back to the email prefix.
-- (auth.users inserts run as postgres — same as the fixture at the top.)
SELECT set_config('role', 'postgres', true);
INSERT INTO auth.users(id, email, raw_user_meta_data)
  VALUES ('44444444-4444-4444-4444-444444444444', 'dev@example.com',
          '{"full_name": "Jane Dev", "avatar_url": "https://example.com/jane.png"}')
  ON CONFLICT (id) DO NOTHING;

SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT is(
  (SELECT display_name FROM public.profiles
    WHERE id = '44444444-4444-4444-4444-444444444444'),
  'Jane Dev',
  '94. OAuth full_name becomes the profile display name'
);

-- EXPECT: a generated handle is still assigned (unique, claimable later).
SELECT is(
  (SELECT count(*) FROM public.profiles
    WHERE id = '44444444-4444-4444-4444-444444444444'
      AND handle LIKE 'user\_%')::bigint,
  1::bigint,
  '95. OAuth sign-in still gets a generated handle'
);

-- EXPECT: GitHub's user_name key works too.
SELECT set_config('role', 'postgres', true);
INSERT INTO auth.users(id, email, raw_user_meta_data)
  VALUES ('55555555-5555-5555-5555-555555555555', 'builder@example.com',
          '{"user_name": "Builder Gal"}')
  ON CONFLICT (id) DO NOTHING;

SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
SELECT is(
  (SELECT display_name FROM public.profiles
    WHERE id = '55555555-5555-5555-5555-555555555555'),
  'Builder Gal',
  '96. GitHub user_name becomes the profile display name'
);


-- ---------------------------------------------------------------------------
-- 14. Function ACLs: studio/teams/space RPCs must not be callable by anon.
--     (Regression: schema-drift repair re-surfaced Supabase's default
--     EXECUTE grants to PUBLIC/anon on the recreated functions.)
-- ---------------------------------------------------------------------------
-- Studio publish/rollback are signed-in editor actions.
SELECT is(
  has_function_privilege('anon', 'public.publish_page_version(uuid)', 'EXECUTE'),
  false,
  '97. anonymous cannot execute publish_page_version'
);
SELECT is(
  has_function_privilege('authenticated', 'public.publish_page_version(uuid)', 'EXECUTE'),
  true,
  '98. authenticated can execute publish_page_version'
);
SELECT is(
  has_function_privilege('anon', 'public.rollback_page_version(uuid, integer)', 'EXECUTE'),
  false,
  '99. anonymous cannot execute rollback_page_version'
);
SELECT is(
  has_function_privilege('authenticated', 'public.rollback_page_version(uuid, integer)', 'EXECUTE'),
  true,
  '100. authenticated can execute rollback_page_version'
);

-- notify_team_invite is a SECURITY DEFINER trigger function — no client role.
SELECT is(
  has_function_privilege('anon', 'public.notify_team_invite()', 'EXECUTE'),
  false,
  '101. anonymous cannot execute notify_team_invite'
);
SELECT is(
  has_function_privilege('authenticated', 'public.notify_team_invite()', 'EXECUTE'),
  false,
  '102. authenticated cannot execute notify_team_invite'
);

-- Space bans and unread counts require a signed-in user.
SELECT is(
  has_function_privilege('anon', 'public.ban_space_member(uuid, uuid, text)', 'EXECUTE'),
  false,
  '103. anonymous cannot execute ban_space_member'
);
SELECT is(
  has_function_privilege('authenticated', 'public.ban_space_member(uuid, uuid, text)', 'EXECUTE'),
  true,
  '104. authenticated can execute ban_space_member'
);
SELECT is(
  has_function_privilege('anon', 'public.unban_space_member(uuid, uuid)', 'EXECUTE'),
  false,
  '105. anonymous cannot execute unban_space_member'
);
SELECT is(
  has_function_privilege('authenticated', 'public.unban_space_member(uuid, uuid)', 'EXECUTE'),
  true,
  '106. authenticated can execute unban_space_member'
);
SELECT is(
  has_function_privilege('anon', 'public.unread_message_counts()', 'EXECUTE'),
  false,
  '107. anonymous cannot execute unread_message_counts'
);
SELECT is(
  has_function_privilege('authenticated', 'public.unread_message_counts()', 'EXECUTE'),
  true,
  '108. authenticated can execute unread_message_counts'
);


SELECT * FROM finish();
ROLLBACK;
