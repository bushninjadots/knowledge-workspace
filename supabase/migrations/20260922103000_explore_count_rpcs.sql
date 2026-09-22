-- ============================================================================
-- Grouped-count RPCs replacing client-side aggregate queries.
--
-- The explore page and space moderation used PostgREST aggregate selects
-- (select "project_id, count()"). That endpoint is environment-dependent:
-- stacks with `db_aggregate_functions_enabled = false` reject it with
-- PGRST123 (the bundled local PostgREST does), so the UI must not depend on
-- it. These plain SQL functions do the grouping in Postgres and behave
-- identically everywhere.
--
-- SECURITY INVOKER (the default) is deliberate: the previous client queries
-- ran under the caller's RLS, so counts only covered rows the caller could
-- already see. Invoker preserves that exactly.
-- ============================================================================

-- Open-role counts per project for the explore shelf/list badges.
CREATE OR REPLACE FUNCTION public.explore_open_role_counts(p_project_ids uuid[])
RETURNS TABLE (project_id uuid, open_roles bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.project_id, count(*)::bigint AS open_roles
  FROM public.project_open_roles r
  WHERE r.is_filled = false
    AND r.project_id = ANY (p_project_ids)
  GROUP BY r.project_id;
$$;

-- Distinct organizers with upcoming sessions (the "hosting sessions" signal).
CREATE OR REPLACE FUNCTION public.explore_session_host_ids(
  p_profile_ids uuid[],
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (organizer_id uuid)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT s.organizer_id
  FROM public.sessions s
  WHERE s.starts_at >= p_now
    AND s.status IN ('scheduled', 'confirmed', 'invitation_sent')
    AND s.organizer_id = ANY (p_profile_ids);
$$;

-- Open report counts per post inside one space (moderation badges).
CREATE OR REPLACE FUNCTION public.space_reported_post_counts(p_space_id uuid)
RETURNS TABLE (post_id uuid, reports bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT r.post_id, count(*)::bigint AS reports
  FROM public.post_reports r
  WHERE r.space_id_snapshot = p_space_id
    AND r.status = 'open'
    AND r.post_id IS NOT NULL
  GROUP BY r.post_id;
$$;

REVOKE ALL ON FUNCTION public.explore_open_role_counts(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.explore_session_host_ids(uuid[], timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.space_reported_post_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explore_open_role_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explore_session_host_ids(uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_reported_post_counts(uuid) TO authenticated;
