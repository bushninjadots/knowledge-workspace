-- Fix infinite recursion in community_space_members RLS policies.
-- Mirrors the sessions fix (20260725130000_fix_session_rls_recursion_final.sql):
-- membership checks must go through SECURITY DEFINER functions so the policy
-- lookup never re-triggers RLS on the same table.

CREATE OR REPLACE FUNCTION public.is_space_member(p_space_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id AND user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_space_owner_or_moderator(p_space_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id
      AND user_id = COALESCE(p_user_id, auth.uid())
      AND role IN ('owner', 'moderator')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_owner_or_moderator(uuid, uuid) TO authenticated;

-- ───────── community_space_members policies ─────────

DROP POLICY IF EXISTS "Members can see member list" ON public.community_space_members;
CREATE POLICY "Members can see member list" ON public.community_space_members
  FOR SELECT
  USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Users can join spaces" ON public.community_space_members;
CREATE POLICY "Users can join spaces" ON public.community_space_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave spaces" ON public.community_space_members;
CREATE POLICY "Users can leave spaces" ON public.community_space_members
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners and moderators can manage members" ON public.community_space_members;
CREATE POLICY "Owners and moderators can manage members" ON public.community_space_members
  FOR UPDATE
  USING (public.is_space_owner_or_moderator(space_id, auth.uid()))
  WITH CHECK (public.is_space_owner_or_moderator(space_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and moderators can remove members" ON public.community_space_members;
CREATE POLICY "Owners and moderators can remove members" ON public.community_space_members
  FOR DELETE
  USING (public.is_space_owner_or_moderator(space_id, auth.uid()));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
