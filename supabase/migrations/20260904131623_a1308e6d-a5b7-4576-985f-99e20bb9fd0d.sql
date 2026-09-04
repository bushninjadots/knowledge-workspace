DROP POLICY IF EXISTS "Owner or self can add contributor" ON public.project_contributors;
DO $$ BEGIN
  CREATE POLICY "Owner can add contributor"
  ON public.project_contributors FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_contributors.project_id AND p.profile_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS "Organizer can add participants" ON public.session_participants;
DO $$ BEGIN
  CREATE POLICY "Organizer can add participants"
  ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
