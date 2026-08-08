-- ============================================================================
-- Join request notifications
--
-- The approve/reject RPCs (20260808200000) resolve membership but stay silent:
-- the requester never learns the outcome until they happen to look. This
-- migration re-creates both RPCs to send a notification on approve and on
-- reject (notifications.type is free text, so no enum changes needed).
--
-- Safe to re-run: CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_space_join_request(p_space_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space_name text;
  _actor_name text;
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to approve join requests';
  END IF;

  INSERT INTO public.community_space_members (space_id, user_id, role)
  VALUES (p_space_id, p_user_id, 'member')
  ON CONFLICT (space_id, user_id) DO NOTHING;

  DELETE FROM public.community_space_join_requests
  WHERE space_id = p_space_id AND user_id = p_user_id;

  SELECT name INTO _space_name FROM public.community_spaces WHERE id = p_space_id;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.insert_notification(
    p_user_id,
    auth.uid(),
    'join_approved',
    'Your request to join ' || COALESCE(_space_name, 'a community') || ' was approved — welcome in!',
    COALESCE(_actor_name, 'An owner') || ' approved your membership request.',
    'community_space',
    p_space_id,
    jsonb_build_object('space_id', p_space_id, 'space_name', _space_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_space_join_request(p_space_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space_name text;
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to reject join requests';
  END IF;

  DELETE FROM public.community_space_join_requests
  WHERE space_id = p_space_id AND user_id = p_user_id;

  SELECT name INTO _space_name FROM public.community_spaces WHERE id = p_space_id;

  PERFORM public.insert_notification(
    p_user_id,
    auth.uid(),
    'join_rejected',
    'Your request to join ' || COALESCE(_space_name, 'a community') || ' was declined',
    'The owner declined your membership request. You can request again later.',
    'community_space',
    p_space_id,
    jsonb_build_object('space_id', p_space_id, 'space_name', _space_name)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
