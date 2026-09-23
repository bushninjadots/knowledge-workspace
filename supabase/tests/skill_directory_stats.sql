CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(7);

-- Function exists with the right identity (p_skill_ids uuid[]), is STABLE, and
-- pins search_path to public so it cannot be hijacked via the search path.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'skill_directory_stats'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'p_skill_ids uuid[]'
      AND p.provolatile = 's'
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'skill_directory_stats(uuid[]) exists, is STABLE, and pins search_path = public'
);

-- SECURITY INVOKER: counts must respect the caller's RLS (private-project
-- needs are visible only to their members), so this must never be DEFINER.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'skill_directory_stats'
      AND n.nspname = 'public'
      AND p.prosecdef
  ),
  'skill_directory_stats is SECURITY INVOKER (respects RLS)'
);

-- Grants: the directory and hub are public pages, so anon and authenticated
-- both need EXECUTE, mirroring the superseded skill_profile_counts grant.
SELECT ok(
  has_function_privilege('anon', 'public.skill_directory_stats(uuid[])', 'EXECUTE'),
  'skill_directory_stats is executable by anon'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.skill_directory_stats(uuid[])', 'EXECUTE'),
  'skill_directory_stats is executable by authenticated'
);

-- Behavior: sharing / growing / projects / open needs are counted *separately*
-- (a profile both sharing and growing is counted once per relationship; a
-- filled need is not counted), and skills with no activity still appear with
-- zeros.
DO $$
DECLARE
  _p1 uuid := '11111111-1111-1111-1111-111111111111';
  _p2 uuid := '22222222-2222-2222-2222-222222222222';
  _s1 uuid;
  _s2 uuid;
  _s3 uuid;
  _proj uuid;
  _b1s bigint; _b1g bigint; _b1p bigint; _b1n bigint;
  _b2s bigint; _b2g bigint; _b2p bigint; _b2n bigint;
  _b3s bigint; _b3g bigint; _b3p bigint; _b3n bigint;
  _r RECORD;
BEGIN
  SELECT id INTO _s1 FROM public.skills ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO _s2 FROM public.skills ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO _s3 FROM public.skills ORDER BY name LIMIT 1 OFFSET 2;

  SELECT COALESCE(sharing_count,0), COALESCE(growing_count,0),
         COALESCE(project_count,0), COALESCE(need_count,0)
    INTO _b1s, _b1g, _b1p, _b1n
    FROM public.skill_directory_stats(ARRAY[_s1]) WHERE skill_id = _s1;
  SELECT COALESCE(sharing_count,0), COALESCE(growing_count,0),
         COALESCE(project_count,0), COALESCE(need_count,0)
    INTO _b2s, _b2g, _b2p, _b2n
    FROM public.skill_directory_stats(ARRAY[_s2]) WHERE skill_id = _s2;
  SELECT COALESCE(sharing_count,0), COALESCE(growing_count,0),
         COALESCE(project_count,0), COALESCE(need_count,0)
    INTO _b3s, _b3g, _b3p, _b3n
    FROM public.skill_directory_stats(ARRAY[_s3]) WHERE skill_id = _s3;

  INSERT INTO auth.users (id, email) VALUES
    (_p1, 'stats_1@example.test'), (_p2, 'stats_2@example.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, handle) VALUES
    (_p1, 'Stats One', 'stats_one'), (_p2, 'Stats Two', 'stats_two')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (profile_id, title) VALUES
    (_p1, 'Stats fixture project') RETURNING id INTO _proj;

  -- _p1 shares and grows _s1; _p2 shares _s1 and _s2.
  INSERT INTO public.profile_skills_teach (profile_id, skill_id)
    SELECT _p1, _s1 UNION ALL SELECT _p2, _s1 UNION ALL SELECT _p2, _s2;
  INSERT INTO public.profile_skills_learn (profile_id, skill_id)
    SELECT _p1, _s1;
  -- The project uses _s1 and _s2; it has an open need for _s1 and a filled one.
  INSERT INTO public.project_skills (project_id, skill_id)
    SELECT _proj, _s1 UNION ALL SELECT _proj, _s2;
  INSERT INTO public.project_needs (project_id, title, skill_id, is_filled) VALUES
    (_proj, 'Open need for s1', _s1, false),
    (_proj, 'Filled need for s1', _s1, true);

  SELECT sharing_count, growing_count, project_count, need_count INTO _r
    FROM public.skill_directory_stats(ARRAY[_s1]) WHERE skill_id = _s1;
  IF _r.sharing_count <> _b1s + 2 THEN
    RAISE EXCEPTION 's1 sharing: expected %, got %', _b1s + 2, _r.sharing_count;
  END IF;
  IF _r.growing_count <> _b1g + 1 THEN
    RAISE EXCEPTION 's1 growing: expected %, got %', _b1g + 1, _r.growing_count;
  END IF;
  IF _r.project_count <> _b1p + 1 THEN
    RAISE EXCEPTION 's1 projects: expected %, got %', _b1p + 1, _r.project_count;
  END IF;
  IF _r.need_count <> _b1n + 1 THEN
    RAISE EXCEPTION 's1 open needs: expected %, got % (filled need must not count)', _b1n + 1, _r.need_count;
  END IF;

  SELECT sharing_count, growing_count, project_count, need_count INTO _r
    FROM public.skill_directory_stats(ARRAY[_s2]) WHERE skill_id = _s2;
  IF _r.sharing_count <> _b2s + 1 THEN
    RAISE EXCEPTION 's2 sharing: expected %, got %', _b2s + 1, _r.sharing_count;
  END IF;
  IF _r.growing_count <> _b2g THEN
    RAISE EXCEPTION 's2 growing should be unchanged: expected %, got %', _b2g, _r.growing_count;
  END IF;
  IF _r.project_count <> _b2p + 1 THEN
    RAISE EXCEPTION 's2 projects: expected %, got %', _b2p + 1, _r.project_count;
  END IF;

  SELECT sharing_count, growing_count, project_count, need_count INTO _r
    FROM public.skill_directory_stats(ARRAY[_s3]) WHERE skill_id = _s3;
  IF _r.sharing_count <> _b3s OR _r.growing_count <> _b3g
     OR _r.project_count <> _b3p OR _r.need_count <> _b3n THEN
    RAISE EXCEPTION 's3 should be untouched: got %,%,%,%', _r.sharing_count, _r.growing_count, _r.project_count, _r.need_count;
  END IF;
END $$;

SELECT ok(true, 'skill_directory_stats counts sharing/growing/projects/needs separately, skips filled needs, keeps zero-count skills');

-- Filtering: NULL means "no filtering" (all skills), while an explicit empty
-- array is a filter that matches nothing.
SELECT is(
  (SELECT count(*) FROM public.skill_directory_stats(ARRAY[]::uuid[])),
  0::bigint,
  'skill_directory_stats with an empty skill id array matches no skills'
);

SELECT ok(
  (SELECT count(*) FROM public.skill_directory_stats(NULL)) > 0,
  'skill_directory_stats with NULL returns all skills'
);

SELECT * FROM finish();

ROLLBACK;