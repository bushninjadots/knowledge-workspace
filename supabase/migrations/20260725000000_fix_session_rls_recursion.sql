-- Fix infinite recursion in session RLS policies.
--
-- Root cause: "Participants view sessions" policy queries session_participants,
-- and "Organizer manage participants" (FOR ALL) queries sessions → circular reference.
-- Same chain affects session_resources and session_notes policies.
--
-- Fix: SECURITY DEFINER function to check organizer status (bypasses RLS),
-- then rewrite all cross-table policies to use it.

-- ───────── Security definer function ─────────

CREATE OR REPLACE FUNCTION public.is_session_organizer(session_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE PARALLEL SAFE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = session_uuid AND organizer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_session_organizer(uuid) TO authenticated;

-- ───────── Sessions policies (replace to use function) ─────────

DROP POLICY IF EXISTS "Organizer CRUD sessions" ON public.sessions;
CREATE POLICY "Organizer CRUD sessions" ON public.sessions
  FOR ALL
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Participants view sessions" ON public.sessions;
CREATE POLICY "Participants view sessions" ON public.sessions
  FOR SELECT USING (
    auth.uid() = organizer_id
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = sessions.id
        AND sp.profile_id = auth.uid()
        AND sp.status IN ('accepted', 'invited', 'pending')
    )
  );

-- ───────── Session participants policies ─────────

DROP POLICY IF EXISTS "Organizer manage participants" ON public.session_participants;
CREATE POLICY "Organizer manage participants" ON public.session_participants
  FOR ALL
  USING (public.is_session_organizer(session_participants.session_id))
  WITH CHECK (public.is_session_organizer(session_participants.session_id));

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
    public.is_session_organizer(session_resources.session_id)
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_resources.session_id
        AND sp.profile_id = auth.uid()
        AND sp.status IN ('accepted', 'invited', 'pending')
    )
  )
  WITH CHECK (
    public.is_session_organizer(session_resources.session_id)
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_resources.session_id
        AND sp.profile_id = auth.uid()
        AND sp.status IN ('accepted', 'invited', 'pending')
    )
  );

-- ───────── Session notes policies ─────────

DROP POLICY IF EXISTS "Participants CRUD notes" ON public.session_notes;
CREATE POLICY "Participants CRUD notes" ON public.session_notes
  FOR ALL
  USING (
    public.is_session_organizer(session_notes.session_id)
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_notes.session_id
        AND sp.profile_id = auth.uid()
        AND sp.status IN ('accepted', 'invited', 'pending')
    )
  )
  WITH CHECK (
    public.is_session_organizer(session_notes.session_id)
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_notes.session_id
        AND sp.profile_id = auth.uid()
        AND sp.status IN ('accepted', 'invited', 'pending')
    )
  );
