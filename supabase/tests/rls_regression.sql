-- ============================================================================
-- Tethyr RLS regression tests
-- ============================================================================
-- These are hand-runnable regression tests. Run them against a scratch project
-- (never production) with the SQL editor. Each block leaves a comment describing
-- the EXPECTED outcome. Any block whose result differs from the expectation is
-- a regression.
--
-- Convention:
--   * "alice" and "bob" are two seeded auth.users
--   * "eve" is a third unrelated user used for tamper checks
--   * SET LOCAL role + request.jwt.claims simulates a signed-in user via RLS
-- ============================================================================

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

-- ---------------------------------------------------------------------------
-- 1. profiles: anyone can SELECT, only owner can UPDATE
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');

-- EXPECT: returns alice's row (public read allowed).
SELECT count(*) AS profiles_public_read
  FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111';

-- EXPECT: raises "new row violates row-level security policy" — bob updating alice.
DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET display_name = 'hacked'
      WHERE id = '11111111-1111-1111-1111-111111111111';
    RAISE NOTICE 'REGRESSION: bob was allowed to update alice';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: cross-user profile update rejected';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 2. handle format constraint
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');

-- EXPECT: raises check_violation for empty / spaces / unicode / too long.
DO $$ BEGIN
  BEGIN
    UPDATE public.profiles SET handle = 'has space'
      WHERE id = '11111111-1111-1111-1111-111111111111';
    RAISE NOTICE 'REGRESSION: handle format constraint did not fire';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: invalid handle rejected';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 3. connections: addressee cannot forge requester_id
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.connections(requester_id, addressee_id)
  VALUES ('11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222')
  ON CONFLICT DO NOTHING;

SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');

-- EXPECT: immutable-fields trigger raises exception.
DO $$ BEGIN
  BEGIN
    UPDATE public.connections
      SET requester_id = '33333333-3333-3333-3333-333333333333'
      WHERE addressee_id = '22222222-2222-2222-2222-222222222222';
    RAISE NOTICE 'REGRESSION: addressee rewrote requester_id';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'OK: requester_id tamper blocked';
  END;
END $$;

-- EXPECT: setting status to something other than accepted/declined is blocked.
DO $$ BEGIN
  BEGIN
    UPDATE public.connections SET status = 'pending'
      WHERE addressee_id = '22222222-2222-2222-2222-222222222222';
    RAISE NOTICE 'REGRESSION: bogus status accepted';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: invalid status rejected';
  END;
END $$;

-- EXPECT: valid accept succeeds.
UPDATE public.connections SET status = 'accepted'
  WHERE addressee_id = '22222222-2222-2222-2222-222222222222';

-- ---------------------------------------------------------------------------
-- 4. messages: only participants can read/insert
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.messages(connection_id, sender_id, body)
  SELECT id, '11111111-1111-1111-1111-111111111111', 'hello bob'
    FROM public.connections
    WHERE requester_id = '11111111-1111-1111-1111-111111111111'
      AND addressee_id = '22222222-2222-2222-2222-222222222222';

-- Third party (eve) MUST NOT read the message.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');

-- EXPECT: 0 rows.
SELECT count(*) AS eve_can_read_messages FROM public.messages;

-- EXPECT: insert as non-participant is rejected.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.messages(connection_id, sender_id, body)
      SELECT id, '33333333-3333-3333-3333-333333333333', 'sneaky'
        FROM public.connections LIMIT 1;
    RAISE NOTICE 'REGRESSION: eve inserted into someone else''s thread';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: non-participant insert rejected';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 5. activity_events: nobody but definer functions can insert
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.activity_events(profile_id, kind, metadata)
      VALUES ('11111111-1111-1111-1111-111111111111', 'fake', '{}');
    RAISE NOTICE 'REGRESSION: direct activity insert allowed';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: activity insert blocked (SECURITY DEFINER path only)';
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 6. project_contributors / project_skills: owner-only writes, public reads
-- ---------------------------------------------------------------------------
SELECT pg_temp.as_user('11111111-1111-1111-1111-111111111111');
INSERT INTO public.projects(profile_id, title)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Alice''s SaaS')
  ON CONFLICT DO NOTHING;

-- EXPECT: creator row was auto-added by the insert trigger.
SELECT count(*) AS should_be_1 FROM public.project_contributors
  WHERE profile_id = '11111111-1111-1111-1111-111111111111' AND role = 'creator';

-- Bob adds himself as a contributor (self-join is allowed).
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
INSERT INTO public.project_contributors(project_id, profile_id, role)
  SELECT id, '22222222-2222-2222-2222-222222222222', 'contributor'
    FROM public.projects WHERE title = 'Alice''s SaaS';

-- EXPECT: eve cannot add bob (or anyone but herself) to alice's project.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.project_contributors(project_id, profile_id, role)
      SELECT id, '22222222-2222-2222-2222-222222222222', 'mentor'
        FROM public.projects WHERE title = 'Alice''s SaaS';
    RAISE NOTICE 'REGRESSION: eve added bob to a project she does not own';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: non-owner cannot add other contributors';
  END;
END $$;

-- EXPECT: bob cannot delete alice's creator row (only alice or Bob's own row).
SELECT pg_temp.as_user('22222222-2222-2222-2222-222222222222');
DO $$ BEGIN
  BEGIN
    DELETE FROM public.project_contributors
      WHERE profile_id = '11111111-1111-1111-1111-111111111111' AND role = 'creator';
    RAISE NOTICE 'REGRESSION: bob removed the project creator';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: creator row protected from non-owner removal';
  END;
END $$;

-- EXPECT: eve cannot attach skills to alice's project.
SELECT pg_temp.as_user('33333333-3333-3333-3333-333333333333');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.project_skills(project_id, skill_id)
      SELECT p.id, s.id FROM public.projects p, public.skills s
        WHERE p.title = 'Alice''s SaaS' LIMIT 1;
    RAISE NOTICE 'REGRESSION: eve tagged a skill on someone else''s project';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'OK: non-owner cannot manage project_skills';
  END;
END $$;

ROLLBACK;
