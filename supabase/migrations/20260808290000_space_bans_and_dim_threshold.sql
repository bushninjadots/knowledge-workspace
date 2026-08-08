-- ============================================================================
-- Space bans + configurable auto-dim threshold
--
-- 1. space_bans — owners/moderators can ban a member from a space. A banned
--    user is removed from community_space_members (loses private-space access)
--    and is blocked from re-joining and from posting to the space. Bans are
--    reversible (lifted_at).
-- 2. community_spaces.report_auto_dim_threshold — how many open reports it
--    takes before a post is auto-dimmed in the feed (default 3).
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Space bans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_bans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at  timestamptz,
  UNIQUE (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS space_bans_space_idx ON public.space_bans(space_id, lifted_at);
CREATE INDEX IF NOT EXISTS space_bans_user_idx ON public.space_bans(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_bans TO authenticated;
GRANT ALL ON public.space_bans TO service_role;

ALTER TABLE public.space_bans ENABLE ROW LEVEL SECURITY;

-- Everyone can see their own bans; moderators see all bans in their space.
DO $$ BEGIN
  CREATE POLICY "Bans visible to moderators and the banned user"
    ON public.space_bans FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR public.is_space_owner_or_moderator(space_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Only owners/moderators create or lift bans.
DO $$ BEGIN
  CREATE POLICY "Moderators create bans"
    ON public.space_bans FOR INSERT TO authenticated
    WITH CHECK (public.is_space_owner_or_moderator(space_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Moderators lift bans"
    ON public.space_bans FOR UPDATE TO authenticated
    USING (public.is_space_owner_or_moderator(space_id, auth.uid()))
    WITH CHECK (public.is_space_owner_or_moderator(space_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Moderators delete bans"
    ON public.space_bans FOR DELETE TO authenticated
    USING (public.is_space_owner_or_moderator(space_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Active-ban check used by the join/post guards below.
CREATE OR REPLACE FUNCTION public.is_space_banned(p_space_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_bans b
    WHERE b.space_id = p_space_id
      AND b.user_id = p_user_id
      AND b.lifted_at IS NULL
  );
$$;

-- Block banned users from (re)joining a space.
CREATE OR REPLACE FUNCTION public.check_membership_not_banned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_space_banned(NEW.space_id, NEW.user_id) THEN
    RAISE EXCEPTION 'space_banned: You have been banned from this community.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membership_not_banned ON public.community_space_members;
CREATE TRIGGER trg_membership_not_banned
  BEFORE INSERT ON public.community_space_members
  FOR EACH ROW EXECUTE FUNCTION public.check_membership_not_banned();

-- Block banned users from posting to the space.
CREATE OR REPLACE FUNCTION public.check_post_not_banned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.space_id IS NOT NULL AND public.is_space_banned(NEW.space_id, NEW.author_id) THEN
    RAISE EXCEPTION 'space_banned: You have been banned from this community.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_not_banned ON public.posts;
CREATE TRIGGER trg_post_not_banned
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_post_not_banned();

-- Ban: validates the caller is a moderator, removes membership, records the ban.
CREATE OR REPLACE FUNCTION public.ban_space_member(
  p_space_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only owners and moderators can ban members.';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot ban yourself.';
  END IF;
  -- Owners can never be banned — a moderator must not be able to depose one.
  IF EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Space owners cannot be banned.';
  END IF;

  -- Remove their membership so private-space access is revoked.
  DELETE FROM public.community_space_members
  WHERE space_id = p_space_id AND user_id = p_user_id;

  INSERT INTO public.space_bans (space_id, user_id, banned_by, reason)
  VALUES (p_space_id, p_user_id, auth.uid(), p_reason)
  ON CONFLICT (space_id, user_id)
  DO UPDATE SET banned_by = auth.uid(), reason = p_reason, lifted_at = NULL, created_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.ban_space_member(uuid, uuid, text) TO authenticated;

-- Unban: lifts the ban (membership is NOT restored — they must re-join).
CREATE OR REPLACE FUNCTION public.unban_space_member(p_space_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only owners and moderators can lift bans.';
  END IF;

  UPDATE public.space_bans
  SET lifted_at = now()
  WHERE space_id = p_space_id AND user_id = p_user_id AND lifted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unban_space_member(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Configurable auto-dim threshold
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.community_spaces
    ADD COLUMN IF NOT EXISTS report_auto_dim_threshold integer NOT NULL DEFAULT 3;
  ALTER TABLE public.community_spaces
    ADD CONSTRAINT report_auto_dim_threshold_range
    CHECK (report_auto_dim_threshold BETWEEN 1 AND 10);
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';
