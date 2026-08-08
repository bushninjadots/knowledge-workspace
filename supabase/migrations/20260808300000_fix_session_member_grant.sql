-- ---------------------------------------------------------------------------
-- Fix: "permission denied for function is_session_member"
--
-- public.is_session_member(uuid, uuid) is used by the sessions RLS policy
-- ("Members can view sessions"), but the migration that created it ran
--   REVOKE EXECUTE ... FROM PUBLIC, anon;
-- without re-granting to authenticated. Every authenticated query touching
-- public.sessions therefore failed with 42501 / HTTP 403.
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) TO authenticated;
