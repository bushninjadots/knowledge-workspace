-- Fix infinite recursion in session RLS policies once and for all.
-- Both is_session_organizer AND is_session_participant MUST be SECURITY DEFINER functions.
-- This ensures neither function triggers RLS on the opposite table when evaluated.

CREATE OR REPLACE FUNCTION public.is_session_organizer(p_session_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND organizer_id = COALESCE(p_user_id, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants
    WHERE session_id = p_session_id
      AND profile_id = COALESCE(p_user_id, auth.uid())
      AND status IN ('accepted', 'invited', 'pending')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_session_organizer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_participant(uuid, uuid) TO authenticated;

-- ───────── Sessions policies ─────────

DROP POLICY IF EXISTS "Organizer CRUD sessions" ON public.sessions;
CREATE POLICY "Organizer CRUD sessions" ON public.sessions
  FOR ALL
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Participants view sessions" ON public.sessions;
CREATE POLICY "Participants view sessions" ON public.sessions
  FOR SELECT USING (
    auth.uid() = organizer_id
    OR public.is_session_participant(id, auth.uid())
  );

-- ───────── Session participants policies ─────────

DROP POLICY IF EXISTS "Organizer manage participants" ON public.session_participants;
CREATE POLICY "Organizer manage participants" ON public.session_participants
  FOR ALL
  USING (public.is_session_organizer(session_id, auth.uid()))
  WITH CHECK (public.is_session_organizer(session_id, auth.uid()));

DROP POLICY IF EXISTS "Participants view own rows" ON public.session_participants;
CREATE POLICY "Participants view own rows" ON public.session_participants
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Participants update own status" ON public.session_participants;
CREATE POLICY "Participants update own status" ON public.session_participants
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ───────── Session resources policies ─────────

DROP POLICY IF EXISTS "Participants CRUD resources" ON public.session_resources;
CREATE POLICY "Participants CRUD resources" ON public.session_resources
  FOR ALL
  USING (
    public.is_session_organizer(session_id, auth.uid())
    OR public.is_session_participant(session_id, auth.uid())
  )
  WITH CHECK (
    public.is_session_organizer(session_id, auth.uid())
    OR public.is_session_participant(session_id, auth.uid())
  );

-- ───────── Session notes policies ─────────

DROP POLICY IF EXISTS "Participants CRUD notes" ON public.session_notes;
CREATE POLICY "Participants CRUD notes" ON public.session_notes
  FOR ALL
  USING (
    public.is_session_organizer(session_id, auth.uid())
    OR public.is_session_participant(session_id, auth.uid())
  )
  WITH CHECK (
    public.is_session_organizer(session_id, auth.uid())
    OR public.is_session_participant(session_id, auth.uid())
  );
