CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(6);

-- Function exists with the right identity (p_skill_ids uuid[]), is STABLE, and
-- pins search_path to public so it cannot be hijacked via the search path.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'skill_profile_counts'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'p_skill_ids uuid[]'
      AND p.provolatile = 's'
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'skill_profile_counts(uuid[]) exists, is STABLE, and pins search_path = public'
);

-- Grants: the directory is a public page, so anon and authenticated both need
-- EXECUTE, mirroring the trending_skills grant.
SELECT ok(
  has_function_privilege('anon', 'public.skill_profile_counts(uuid[])', 'EXECUTE'),
  'skill_profile_counts is executable by anon'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.skill_profile_counts(uuid[])', 'EXECUTE'),
  'skill_profile_counts is executable by authenticated'
);

-- Behavior: counts DISTINCT profiles across teach and learn, so someone who
-- both teaches and learns a skill is counted once, and skills with no takers
-- still appear with a zero count.
DO $$
DECLARE
  _p1 uuid := '11111111-1111-1111-1111-111111111111';
  _p2 uuid := '22222222-2222-2222-2222-222222222222';
  _a uuid;
  _b uuid;
  _c uuid;
  _base_a bigint;
  _base_b bigint;
  _base_c bigint;
  _got bigint;
BEGIN
  SELECT id INTO _a FROM public.skills ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO _b FROM public.skills ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO _c FROM public.skills ORDER BY name LIMIT 1 OFFSET 2;

  SELECT COALESCE(profile_count, 0) INTO _base_a
    FROM public.skill_profile_counts(ARRAY[_a]) WHERE skill_id = _a;
  SELECT COALESCE(profile_count, 0) INTO _base_b
    FROM public.skill_profile_counts(ARRAY[_b]) WHERE skill_id = _b;
  SELECT COALESCE(profile_count, 0) INTO _base_c
    FROM public.skill_profile_counts(ARRAY[_c]) WHERE skill_id = _c;

  INSERT INTO auth.users (id, email) VALUES
    (_p1, 'skill_1@example.test'), (_p2, 'skill_2@example.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, handle) VALUES
    (_p1, 'Skill One', 'skill_one'), (_p2, 'Skill Two', 'skill_two')
  ON CONFLICT (id) DO NOTHING;

  -- _p1 teaches and learns _a; _p2 teaches _a and _b.
  INSERT INTO public.profile_skills_teach (profile_id, skill_id)
    SELECT _p1, _a;
  INSERT INTO public.profile_skills_learn (profile_id, skill_id)
    SELECT _p1, _a;
  INSERT INTO public.profile_skills_teach (profile_id, skill_id)
    SELECT _p2, _a;
  INSERT INTO public.profile_skills_teach (profile_id, skill_id)
    SELECT _p2, _b;

  SELECT COALESCE(profile_count, 0) INTO _got
    FROM public.skill_profile_counts(ARRAY[_a]) WHERE skill_id = _a;
  IF _got <> _base_a + 2 THEN
    RAISE EXCEPTION 'skill % counts distinct profiles across teach+learn: expected %, got %', _a, _base_a + 2, _got;
  END IF;

  SELECT COALESCE(profile_count, 0) INTO _got
    FROM public.skill_profile_counts(ARRAY[_b]) WHERE skill_id = _b;
  IF _got <> _base_b + 1 THEN
    RAISE EXCEPTION 'skill % counts teach profiles: expected %, got %', _b, _base_b + 1, _got;
  END IF;

  SELECT COALESCE(profile_count, 0) INTO _got
    FROM public.skill_profile_counts(ARRAY[_c]) WHERE skill_id = _c;
  IF _got <> _base_c THEN
    RAISE EXCEPTION 'skill % should be unchanged: expected %, got %', _c, _base_c, _got;
  END IF;
END $$;

SELECT ok(true, 'skill_profile_counts counts distinct profiles and keeps zero-count skills');

-- Filtering: NULL means "no filtering" (all skills), while an explicit empty
-- array is a filter that matches nothing.
SELECT is(
  (SELECT count(*) FROM public.skill_profile_counts(ARRAY[]::uuid[])),
  0::bigint,
  'skill_profile_counts with an empty skill id array matches no skills'
);

SELECT ok(
  (SELECT count(*) FROM public.skill_profile_counts(NULL)) > 0,
  'skill_profile_counts with NULL returns all skills'
);

SELECT * FROM finish();

ROLLBACK;