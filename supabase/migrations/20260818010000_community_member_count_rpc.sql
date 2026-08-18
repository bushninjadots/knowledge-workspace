-- Expose community-space member counts without leaking the member list.
--
-- `community_space_members` SELECT is RLS-limited to spaces you've already
-- joined, so the "N members" label on unjoined spaces rendered as "0 members"
-- (the count query couldn't see any rows). This SECURITY DEFINER aggregate
-- returns only the aggregate count per space (no user ids), which is public
-- info and safe to expose alongside the already-visible space list.
CREATE OR REPLACE FUNCTION public.community_space_member_counts()
RETURNS TABLE (space_id uuid, member_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.space_id, count(*)::bigint
  FROM public.community_space_members m
  GROUP BY m.space_id;
$$;

REVOKE ALL ON FUNCTION public.community_space_member_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_space_member_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_space_member_counts() TO anon;
