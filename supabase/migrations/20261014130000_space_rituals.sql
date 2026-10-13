-- Rituals that bring people back to a space:
--
-- 1. Space sessions. sessions.community_id existed but nothing used it; it
--    now points at a space. Its owner or moderators schedule sessions there
--    (a critique hour, a co-working block), the space's members can see them
--    and mark themselves as going.
-- 2. A weekly ship thread. With community_spaces.weekly_thread on, the first
--    member to open the space in a new week starts "What did you ship this
--    week?" — pinned, posted as the space's owner, last week's unpinned.
--    No scheduler needed: ensure_weekly_thread() is idempotent per week.

-- ── 1. Space sessions ─────────────────────────────────────────────────────
UPDATE public.sessions s SET community_id = NULL
 WHERE community_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.community_spaces c WHERE c.id = s.community_id);

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_community_id_fkey,
  ADD CONSTRAINT sessions_community_id_fkey
    FOREIGN KEY (community_id) REFERENCES public.community_spaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_community_upcoming_idx
  ON public.sessions (community_id, starts_at) WHERE community_id IS NOT NULL;

-- Only a space's owner or moderators may put a session in it.
CREATE OR REPLACE FUNCTION public.check_space_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.community_id IS NOT NULL
     AND NOT public.is_space_owner_or_moderator(NEW.community_id, NEW.organizer_id) THEN
    RAISE EXCEPTION 'Only the space''s owner or moderators can schedule sessions in it'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_space_session() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS check_space_session ON public.sessions;
CREATE TRIGGER check_space_session
  BEFORE INSERT OR UPDATE OF community_id, organizer_id ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_space_session();

-- Can this person see / join the sessions of this space?
CREATE OR REPLACE FUNCTION public.can_join_space_session(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
     WHERE s.id = p_session_id AND s.community_id IS NOT NULL
       AND public.is_space_member(s.community_id, p_user_id));
$$;

REVOKE ALL ON FUNCTION public.can_join_space_session(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_join_space_session(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Space members view space sessions" ON public.sessions;
CREATE POLICY "Space members view space sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (community_id IS NOT NULL AND public.is_space_member(community_id, (SELECT auth.uid())));

-- Members say they're going (and can see who else is).
DROP POLICY IF EXISTS "Space members join space sessions" ON public.session_participants;
CREATE POLICY "Space members join space sessions" ON public.session_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND role = 'participant'
    AND status = 'accepted'
    AND public.can_join_space_session(session_id, (SELECT auth.uid()))
  );
DROP POLICY IF EXISTS "Space members see who is going" ON public.session_participants;
CREATE POLICY "Space members see who is going" ON public.session_participants
  FOR SELECT TO authenticated
  USING (public.can_join_space_session(session_id, (SELECT auth.uid())));

-- ── 2. Weekly ship thread ─────────────────────────────────────────────────
ALTER TABLE public.community_spaces
  ADD COLUMN IF NOT EXISTS weekly_thread boolean NOT NULL DEFAULT false;
GRANT UPDATE (weekly_thread) ON public.community_spaces TO authenticated;
GRANT INSERT (weekly_thread) ON public.community_spaces TO authenticated;

-- Start this week's thread if the space wants one and it doesn't exist yet.
-- Returns the thread's post id (null when the space has it turned off or the
-- caller isn't a member).
CREATE OR REPLACE FUNCTION public.ensure_weekly_thread(p_space_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space public.community_spaces%ROWTYPE;
  _week timestamptz := date_trunc('week', now());
  _id uuid;
BEGIN
  SELECT * INTO _space FROM public.community_spaces WHERE id = p_space_id;
  IF NOT FOUND OR NOT _space.weekly_thread
     OR NOT public.is_space_member(p_space_id, auth.uid()) THEN
    RETURN NULL;
  END IF;

  -- One thread per space per week, even if two members arrive at once.
  PERFORM pg_advisory_xact_lock(hashtext('weekly-thread:' || p_space_id::text));

  SELECT id INTO _id FROM public.posts
   WHERE space_id = p_space_id AND flair = 'Weekly' AND created_at >= _week
   ORDER BY created_at LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  UPDATE public.posts SET is_pinned = false
   WHERE space_id = p_space_id AND flair = 'Weekly' AND is_pinned;

  INSERT INTO public.posts (author_id, type, title, body, space_id, flair, is_pinned)
  VALUES (
    _space.created_by, 'discussion', 'What did you ship this week?',
    'Week of ' || to_char(_week, 'FMMonth FMDD') || '. Share one thing you shipped, learned or '
      || 'got stuck on — big or small. Reply to someone else''s too.',
    p_space_id, 'Weekly', true)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_weekly_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_thread(uuid) TO authenticated;
