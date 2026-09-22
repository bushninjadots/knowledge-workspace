-- ============================================================================
-- Query-load RPCs and RLS/index invariants (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Covers the 2026-09-22 performance hardening, whose failure mode was invisible
-- to typecheck, lint, and the unit tests:
--
--   * 20260922103000 / 20260922102000 replaced client-side counting and
--     bucketing with SQL functions, because a PostgREST aggregate select is
--     rejected by the bundled local PostgREST (PGRST123) while working on the
--     hosted stack. The functions are the contract now, so pin their identity,
--     their SECURITY mode, and their grants.
--   * 20260922104000 fixed the grants: `REVOKE ... FROM PUBLIC` does not strip
--     Supabase's default explicit EXECUTE grant to anon, so the four functions
--     shipped callable by unauthenticated users. Test 5 is the regression pin.
--   * 20260922100000 added trigram indexes for leading-wildcard search, and
--     20260922101000 rewrote every auth.uid() policy reference into a scalar
--     subquery. Both are easy to silently undo — a new policy written the old
--     way, or a column left unindexed — so both are asserted as sweeps rather
--     than as object pins.
--
-- SECURITY mode is the load-bearing detail: the three explore/moderation
-- functions are INVOKER because their counts must keep respecting the caller's
-- RLS, while community_daily_activity is DEFINER because a global activity
-- chart should count globally. A future "cleanup" that normalizes either way
-- breaks a deliberate decision.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(18);

-- ---------------------------------------------------------------------------
-- 1-4. Function identity, volatility, pinned search_path, and SECURITY mode.
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'explore_open_role_counts'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'p_project_ids uuid[]'
      AND p.provolatile = 's'
      AND p.prosecdef = false
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'explore_open_role_counts(uuid[]) is STABLE, SECURITY INVOKER, and pins search_path = public'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'explore_session_host_ids'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid)
          = 'p_profile_ids uuid[], p_now timestamp with time zone'
      AND p.provolatile = 's'
      AND p.prosecdef = false
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'explore_session_host_ids(uuid[], timestamptz) is STABLE, SECURITY INVOKER, and pins search_path = public'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'space_reported_post_counts'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'p_space_id uuid'
      AND p.provolatile = 's'
      AND p.prosecdef = false
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'space_reported_post_counts(uuid) is STABLE, SECURITY INVOKER, and pins search_path = public'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'community_daily_activity'
      AND n.nspname = 'public'
      AND pg_get_function_identity_arguments(p.oid) = 'p_since timestamp with time zone, p_days integer'
      AND p.provolatile = 's'
      AND p.prosecdef = true
      AND p.proconfig::text LIKE '%search_path=public%'
  ),
  'community_daily_activity(timestamptz, integer) is STABLE, SECURITY DEFINER, and pins search_path = public'
);

-- ---------------------------------------------------------------------------
-- 5-6. Grants. These four serve the authenticated explore page and the space
--      moderation inbox, so anon must not reach them — especially
--      community_daily_activity, whose DEFINER mode makes its ACL the only
--      thing preventing an unauthenticated global-aggregate read.
--      Test 5 is the regression pin for 20260922104000.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'explore_open_role_counts',
        'explore_session_host_ids',
        'space_reported_post_counts',
        'community_daily_activity'
      )
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'no grouped-count RPC is executable by anon'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('public.explore_open_role_counts(uuid[])'),
      ('public.explore_session_host_ids(uuid[], timestamptz)'),
      ('public.space_reported_post_counts(uuid)'),
      ('public.community_daily_activity(timestamptz, integer)')
    ) AS f(sig)
    WHERE NOT has_function_privilege('authenticated', f.sig, 'EXECUTE')
  ),
  'every grouped-count RPC is executable by authenticated'
);

-- ---------------------------------------------------------------------------
-- Fixtures. Synthetic rows keep the suite independent of the demo seed and are
-- rolled back with the transaction.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  _owner   uuid := 'aaaa1111-1111-1111-1111-111111111111';
  _other   uuid := 'bbbb2222-2222-2222-2222-222222222222';
  _project uuid := 'cccc3333-3333-3333-3333-333333333333';
  _post    uuid := 'dddd4444-4444-4444-4444-444444444444';
  _space   uuid := 'eeee5555-5555-5555-5555-555555555555';
  _alien   uuid := 'eeee6666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (_owner, 'query_load_owner@example.test'),
    (_other, 'query_load_other@example.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, display_name, handle) VALUES
    (_owner, 'Query Load Owner', 'query_load_owner'),
    (_other, 'Query Load Other', 'query_load_other')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (id, profile_id, title)
    VALUES (_project, _owner, 'Query Load Fixture');

  INSERT INTO public.posts (id, author_id, title, type)
    VALUES (_post, _owner, 'Query Load Fixture Post', 'discussion');

  -- Two open roles and one filled role: only the open ones may be counted.
  INSERT INTO public.project_open_roles (project_id, title, is_filled, filled_by) VALUES
    (_project, 'Open Role A', false, NULL),
    (_project, 'Open Role B', false, NULL),
    (_project, 'Filled Role', true, _other);

  -- Future scheduled sessions for _owner (two, to prove DISTINCT), plus one
  -- draft and one past session that must never be counted.
  INSERT INTO public.sessions (organizer_id, title, starts_at, status) VALUES
    (_owner, 'Upcoming Scheduled', now() + interval '1 day', 'scheduled'),
    (_owner, 'Upcoming Confirmed', now() + interval '2 days', 'confirmed'),
    (_owner, 'Upcoming Draft',     now() + interval '1 day', 'draft'),
    (_owner, 'Past Scheduled',     now() - interval '1 day', 'scheduled');

  -- One countable report, plus three that must be filtered out: another space,
  -- a resolved report, and a report with no post attached.
  INSERT INTO public.post_reports (post_id, reporter_id, reason, space_id_snapshot, status) VALUES
    (_post, _other, 'Countable report',  _space, 'open'),
    (_post, _other, 'Alien space',       _alien, 'open'),
    (_post, _other, 'Resolved report',   _space, 'resolved'),
    (NULL,  _other, 'No post attached',  _space, 'open');
END $$;

-- ---------------------------------------------------------------------------
-- 7-9. explore_open_role_counts: counts unfilled roles only, stays inside the
--      requested id set, and treats an empty array as "match nothing".
-- ---------------------------------------------------------------------------
SELECT is(
  (
    SELECT open_roles
    FROM public.explore_open_role_counts(ARRAY['cccc3333-3333-3333-3333-333333333333'::uuid])
    WHERE project_id = 'cccc3333-3333-3333-3333-333333333333'
  ),
  2::bigint,
  'explore_open_role_counts counts open roles and skips filled ones'
);

SELECT is_empty(
  $$
    SELECT 1
    FROM public.explore_open_role_counts(ARRAY['cccc3333-3333-3333-3333-333333333333'::uuid])
    WHERE project_id <> 'cccc3333-3333-3333-3333-333333333333'
  $$,
  'explore_open_role_counts never returns a project outside the requested ids'
);

SELECT is(
  (SELECT count(*) FROM public.explore_open_role_counts(ARRAY[]::uuid[])),
  0::bigint,
  'explore_open_role_counts with an empty id array matches no projects'
);

-- ---------------------------------------------------------------------------
-- 10-12. explore_session_host_ids: distinct organizers with an upcoming
--        scheduled/confirmed session, scoped to the requested ids.
-- ---------------------------------------------------------------------------
SELECT is(
  (
    SELECT array_agg(organizer_id ORDER BY organizer_id)
    FROM public.explore_session_host_ids(
      ARRAY['aaaa1111-1111-1111-1111-111111111111'::uuid]
    )
  ),
  ARRAY['aaaa1111-1111-1111-1111-111111111111'::uuid],
  'explore_session_host_ids returns one row per host, excluding draft and past sessions'
);

SELECT is_empty(
  $$
    SELECT 1
    FROM public.explore_session_host_ids(
      ARRAY['aaaa1111-1111-1111-1111-111111111111'::uuid]
    )
    WHERE organizer_id <> 'aaaa1111-1111-1111-1111-111111111111'
  $$,
  'explore_session_host_ids never returns an organizer outside the requested ids'
);

SELECT is(
  (SELECT count(*) FROM public.explore_session_host_ids(ARRAY[]::uuid[])),
  0::bigint,
  'explore_session_host_ids with an empty id array matches no hosts'
);

-- ---------------------------------------------------------------------------
-- 13-14. space_reported_post_counts: open reports attached to a post, scoped to
--        the space snapshot, and never a null post id.
-- ---------------------------------------------------------------------------
SELECT is(
  (
    SELECT reports
    FROM public.space_reported_post_counts('eeee5555-5555-5555-5555-555555555555'::uuid)
  ),
  1::bigint,
  'space_reported_post_counts counts only open reports for its own space'
);

SELECT is_empty(
  $$
    SELECT 1
    FROM public.space_reported_post_counts('eeee5555-5555-5555-5555-555555555555'::uuid)
    WHERE post_id IS NULL
  $$,
  'space_reported_post_counts never returns a null post id'
);

-- ---------------------------------------------------------------------------
-- 15-16. community_daily_activity returns a bounded, zero-filled day series —
--        the property that replaced two 500-row client-side counts.
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM public.community_daily_activity(now() - interval '6 days', 7)),
  7::bigint,
  'community_daily_activity returns one row per requested day'
);

SELECT ok(
  (
    SELECT count(DISTINCT day) = 7
       AND (max(day) - min(day)) = 6
       AND bool_and(joins IS NOT NULL AND posts IS NOT NULL)
    FROM public.community_daily_activity(now() - interval '6 days', 7)
  ),
  'community_daily_activity zero-fills the window with consecutive, non-null days'
);

-- ---------------------------------------------------------------------------
-- 17. The auth.uid() initplan sweep. Postgres renders the wrapped call as
--     "( SELECT auth.uid() AS uid)", so stripping every "select auth.uid()"
--     occurrence and looking for a leftover auth.uid() finds exactly the bare
--     per-row form the sweep removed. Any new policy written the old way fails
--     here before it becomes a per-row function call on a hot table.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT schemaname || '.' || tablename || ' → ' || policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        replace(lower(coalesce(qual, '')), 'select auth.uid()', '') LIKE '%auth.uid()%'
        OR replace(lower(coalesce(with_check, '')), 'select auth.uid()', '') LIKE '%auth.uid()%'
      )
  $$,
  'no public policy references auth.uid() outside a scalar subquery'
);

-- ---------------------------------------------------------------------------
-- 18. The trigram indexes backing leading-wildcard search. Asserted by name
--     because a dropped index is invisible until the tables grow.
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('profiles_display_name_trgm_idx'),
      ('profiles_handle_trgm_idx'),
      ('profiles_category_trgm_idx'),
      ('profiles_creator_title_trgm_idx'),
      ('skills_name_trgm_idx'),
      ('projects_title_trgm_idx'),
      ('projects_description_trgm_idx'),
      ('posts_title_trgm_idx'),
      ('posts_body_trgm_idx'),
      ('library_items_title_trgm_idx'),
      ('library_items_content_trgm_idx'),
      ('sessions_title_trgm_idx'),
      ('sessions_description_trgm_idx')
    ) AS i(name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = i.name
        AND indexdef LIKE '%gin_trgm_ops%'
    )
  ),
  'all 13 pg_trgm GIN indexes backing global search exist'
);

SELECT * FROM finish();

ROLLBACK;
