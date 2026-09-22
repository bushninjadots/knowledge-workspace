-- ============================================================================
-- Harden EXECUTE grants on the 2026-09-22 grouped-count RPCs.
--
-- The four functions added earlier today declared
-- `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`
-- but still carry `anon=X` in their ACL: Supabase's default privileges grant
-- EXECUTE to anon explicitly on every new function, and revoking PUBLIC does
-- not strip an explicit grant. Only `REVOKE ... FROM PUBLIC, anon` does — the
-- same correction `20260905120000_harden_studio_teams_spaces_grants.sql` had to
-- make for the Studio/space RPCs and `20260908120000_performance_aggregates.sql`
-- made for match_projects.
--
-- Why it matters, in order of weight:
--   * community_daily_activity is SECURITY DEFINER, so its ACL is the only
--     thing standing between an unauthenticated caller and a global join/post
--     aggregate. The migration's intent ("the authenticated chart") was not
--     actually enforced.
--   * the other three are SECURITY INVOKER, so RLS still limited what they
--     could read — but they exist for the authenticated explore page and the
--     space moderation inbox, and an unused public grant on a definer-adjacent
--     surface is exactly the debt that grows into an incident.
--
-- Idempotent: re-running strips the grant again and re-asserts authenticated.
-- ============================================================================

REVOKE ALL ON FUNCTION public.explore_open_role_counts(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.explore_session_host_ids(uuid[], timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.space_reported_post_counts(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_daily_activity(timestamptz, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.explore_open_role_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.explore_session_host_ids(uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_reported_post_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_daily_activity(timestamptz, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
