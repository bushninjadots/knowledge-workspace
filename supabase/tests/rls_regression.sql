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

SELECT plan(33);

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
-- 10. sessions: is_session_member() must be callable by authenticated users
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

SELECT * FROM finish();
ROLLBACK;
