-- Private community spaces must actually be private.
--
-- 20260818000000 added community_spaces.visibility and wired a Public/Private
-- toggle + "Private space" badges into the UI, but it never updated RLS: the
-- SELECT policies on community_spaces and posts still read `USING (true)`, so
-- a "private" space — and every post in it — stayed readable by everyone,
-- signed-out visitors included.
--
-- This mirrors the projects visibility fix (is_project_visible) and makes the
-- toggle real:
--   * community_spaces: private spaces are readable only by their creator + members.
--   * posts: posts in a private space are readable only by that space's members;
--     posts with no space (or in a public space) stay world-readable.
--
-- The predicate is inlined rather than wrapped in a SECURITY DEFINER helper
-- that queries community_spaces: a self-referencing helper breaks
-- `INSERT ... ON CONFLICT DO NOTHING`, because Postgres evaluates the SELECT
-- policy as a WITH CHECK on the speculative row and the helper's snapshot can't
-- see it. is_space_member() only reads community_space_members, so it is safe.

-- is_space_member is SECURITY DEFINER; grant it to anon too, since both tables
-- are readable signed-out and the policy must not raise a permission error for
-- anonymous visitors (it returns false for a NULL uid).
GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO anon;

-- ---------------------------------------------------------------------------
-- community_spaces: hide private spaces from non-members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Spaces are publicly readable" ON public.community_spaces;
CREATE POLICY "Spaces are publicly readable" ON public.community_spaces
  FOR SELECT
  USING (
    visibility = 'public'
    OR created_by = auth.uid()
    OR public.is_space_member(id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- posts: hide posts that live in a private space from non-members.
-- posts.space_id is nullable (posts outside any space stay world-readable).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts
  FOR SELECT
  USING (
    space_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.community_spaces s
      WHERE s.id = space_id
        AND (
          s.visibility = 'public'
          OR s.created_by = auth.uid()
          OR public.is_space_member(s.id, auth.uid())
        )
    )
  );

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
