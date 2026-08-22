-- Security advisor: function_search_path_mutable / RPC surface hardening
--
-- Several app-facing RPCs were granted EXECUTE to PUBLIC (and therefore to the
-- `anon` role) in addition to `authenticated`. They all operate on the caller
-- via auth.uid() and must never be callable by an unauthenticated request:
--   * approve_space_join_request / reject_space_join_request
--   * ban_space_member / unban_space_member
--   * mark_space_read
--
-- Revoke the PUBLIC grant so only authenticated users can invoke them. The
-- owner (postgres) and `authenticated` grants are left untouched.

REVOKE EXECUTE ON FUNCTION public.approve_space_join_request(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_space_join_request(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ban_space_member(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unban_space_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_space_read(uuid) FROM PUBLIC;

-- The RLS helper predicates (is_session_*, is_space_*) intentionally keep
-- their PUBLIC grant: they are evaluated by policies for the `anon` role on
-- public surfaces (public Studio, public spaces), and they read through
-- auth.uid() only. They are SECURITY DEFINER but pure, side-effect-free
-- STABLE predicates with a pinned search_path (see 20260822000000).
