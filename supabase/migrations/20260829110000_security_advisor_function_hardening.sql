-- Security advisor follow-up: harden exposed SECURITY DEFINER routines.
-- Trigger functions remain callable only by PostgreSQL internally; exposed RPCs
-- are limited to the roles that use them from the application.

-- These counters retain SECURITY DEFINER because they update cached fields that
-- callers should not update directly. Their search path is fixed below. The
-- guards keep this follow-up migration safe when an older remote database has
-- not yet created one of the optional RPCs.
DO $$
BEGIN
  IF to_regprocedure('public.increment_usage_count(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.increment_usage_count(uuid) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.increment_usage_count(uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.increment_usage_count(uuid) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.increment_fork_count(uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.increment_fork_count(uuid) SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.increment_fork_count(uuid) FROM anon;
    GRANT EXECUTE ON FUNCTION public.increment_fork_count(uuid) TO authenticated, service_role;
  END IF;
END
$$;

-- The aggregate RPC intentionally counts all members, but is not anonymous.
REVOKE EXECUTE ON FUNCTION public.community_space_member_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.community_space_member_counts() TO authenticated;

-- Authenticated maintenance only.
REVOKE ALL ON FUNCTION public.reseed_default_templates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseed_default_templates() TO authenticated;
ALTER FUNCTION public.reseed_default_templates() SET search_path = public;

-- Authenticated mutation RPCs must not be callable anonymously.
REVOKE EXECUTE ON FUNCTION public.vote_on_poll(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_space_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decline_project_role_application(uuid, uuid, uuid) FROM anon;

-- Explicit, deterministic search paths for exposed SECURITY DEFINER RPCs.
ALTER FUNCTION public.vote_on_poll(uuid, integer) SET search_path = public;
ALTER FUNCTION public.mark_space_read(uuid) SET search_path = public;
ALTER FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.decline_project_role_application(uuid, uuid, uuid) SET search_path = public;

NOTIFY pgrst, 'reload schema';
