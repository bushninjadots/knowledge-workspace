-- ============================================================================
-- Daily community activity aggregate for the communities dashboard chart.
--
-- use-community-activity.ts previously fetched up to 500 member-join rows and
-- 500 post rows and bucketed them client-side. That scaled with activity
-- volume, and once either stream crossed 500 (or PostgREST's 1000-row hard
-- cap) days silently lost counts. A SECURITY DEFINER aggregate does the
-- bucketing in Postgres and returns at most one row per day.
--
-- The definer wraps the bare tables so the chart keeps its old semantics —
-- the previous client queries rode RLS ("only spaces you've joined" for
-- member rows), which made the numbers dependent on the viewer's memberships.
-- A global activity chart should count globally; the definer makes that
-- explicit and stable. Post count is space-scoped (space_id not null) to match
-- the old `.not("space_id", "is", null)` filter.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.community_daily_activity(
  p_since timestamptz,
  p_days integer
)
RETURNS TABLE (day date, joins bigint, posts bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(
      (p_since AT TIME ZONE 'utc')::date,
      ((p_since AT TIME ZONE 'utc')::date + (p_days - 1)),
      interval '1 day'
    )::date AS day
  ),
  join_counts AS (
    SELECT (joined_at AT TIME ZONE 'utc')::date AS day, count(*) AS joins
    FROM public.community_space_members
    WHERE joined_at >= p_since
    GROUP BY 1
  ),
  post_counts AS (
    SELECT (created_at AT TIME ZONE 'utc')::date AS day, count(*) AS posts
    FROM public.posts
    WHERE created_at >= p_since
      AND space_id IS NOT NULL
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(j.joins, 0)::bigint,
    COALESCE(p.posts, 0)::bigint
  FROM days d
  LEFT JOIN join_counts j ON j.day = d.day
  LEFT JOIN post_counts p ON p.day = d.day
  ORDER BY d.day;
$$;

REVOKE ALL ON FUNCTION public.community_daily_activity(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_daily_activity(timestamptz, integer) TO authenticated;
