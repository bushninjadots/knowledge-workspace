-- Read receipts in space chat: a SECURITY DEFINER RPC so a member can advance
-- their own read cursor without widening the members-table UPDATE policy (which
-- is deliberately restricted to owners/moderators). The function verifies the
-- caller is actually a member before touching the row.
CREATE OR REPLACE FUNCTION public.mark_space_read(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  UPDATE public.community_space_members
  SET last_read_at = now()
  WHERE space_id = p_space_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_space_read(uuid) TO authenticated;
