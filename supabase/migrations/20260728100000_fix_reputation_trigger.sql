-- Fix trg_reputation_community_post: remove dead-code check for 'post' (not a valid enum value)
-- KNOWN_ISSUES.md #4 documented this as fixed but the migration file was never updated.
-- The trigger now awards +2 reputation for ALL community post types.

CREATE OR REPLACE FUNCTION public.trg_reputation_community_post()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  PERFORM public.log_contribution(
    NEW.author_id,
    'community',
    'community_post_created',
    2,
    jsonb_build_object('post_id', NEW.id, 'post_type', NEW.type::text)
  );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
