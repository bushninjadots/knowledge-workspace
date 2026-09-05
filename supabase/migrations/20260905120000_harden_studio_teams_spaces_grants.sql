-- Harden function ACLs for Studio, Teams, and space tooling.
--
-- Several functions created by earlier migrations were recreated during
-- schema-drift repair, which re-surfaced Supabase's default EXECUTE grants
-- to anon/authenticated/PUBLIC. The REVOKE lines in the repair migration
-- did not land against the live database, so these functions are still
-- callable by roles they are not meant to serve. This migration is the
-- idempotent re-application of those revocations.
--
-- * publish_page_version / rollback_page_version are authenticated-only
--   (Studio publish + revert live in the editor).
-- * notify_team_invite is a SECURITY DEFINER trigger function; it must not
--   be executable by any client role.
-- * ban/unban/approve/reject_space_join_request and unread_message_counts
--   require a signed-in user.
REVOKE ALL ON FUNCTION public.publish_page_version(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_page_version(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_page_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_page_version(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.notify_team_invite() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.ban_space_member(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unban_space_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_space_join_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_space_join_request(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unread_message_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ban_space_member(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unban_space_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_space_join_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_space_join_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_message_counts() TO authenticated;

NOTIFY pgrst, 'reload schema';