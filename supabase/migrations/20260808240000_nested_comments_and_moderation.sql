-- ============================================================================
-- Nested comment threads + community moderation
--
-- 1. comments.parent_id — lets replies nest under a parent comment (a reply to
--    the post has NULL parent_id). The existing flat read policy is unchanged;
--    the UI rebuilds the tree from the flat list.
-- 2. Moderation: space owners/moderators may delete posts that live in their
--    space, comments on those posts, and shares from their space — the missing
--    moderation levers for enforcing community rules.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Nested comments
-- ---------------------------------------------------------------------------
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_idx ON public.comments(parent_id);

-- ---------------------------------------------------------------------------
-- 2. Moderation: owners/moderators can remove content in their space
-- ---------------------------------------------------------------------------

-- Posts posted into a space (posts.space_id) can be deleted by that space's
-- owners/moderators — authors can already delete their own.
DO $$ BEGIN
  CREATE POLICY "Space owners and moderators can delete posts in their space"
    ON public.posts FOR DELETE TO authenticated
    USING (
      posts.space_id IS NOT NULL
      AND public.is_space_owner_or_moderator(posts.space_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Comments on posts that live in a space can be deleted by the space's
-- owners/moderators (authors can already delete their own).
DO $$ BEGIN
  CREATE POLICY "Space owners and moderators can delete comments in their space"
    ON public.comments FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = comments.post_id
          AND p.space_id IS NOT NULL
          AND public.is_space_owner_or_moderator(p.space_id, auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Owners/moderators can unshare a post from their space (a moderation action
-- distinct from the sharer's own unshare).
DO $$ BEGIN
  CREATE POLICY "Space owners and moderators can unshare posts from their space"
    ON public.post_space_shares FOR DELETE TO authenticated
    USING (public.is_space_owner_or_moderator(space_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';
