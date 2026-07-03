
REVOKE EXECUTE ON FUNCTION public.log_activity(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_connection() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_profile_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_skill_teach() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_skill_learn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_skill_wishlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_project() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
