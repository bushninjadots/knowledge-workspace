REVOKE EXECUTE ON FUNCTION public.trg_project_add_creator_contributor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_log_project_contributor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_endorsement_upgrade_level() FROM PUBLIC, anon, authenticated;