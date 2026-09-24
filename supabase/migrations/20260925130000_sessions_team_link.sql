-- Sessions can now be linked to a crew (team), mirroring the project link.
--
-- A session's crew attachment widens *read* visibility the same way project
-- membership does (20260818080000_project_sessions_visibility.sql): any crew
-- member can see the sessions attached to their crew, so a crew's sessions
-- surface for the whole team on the Sessions board. Meeting URLs/locations
-- stay inside the crew — the team-member EXISTS can never match a non-member.
-- Write access is unchanged: only the organizer may edit/delete a session, so
-- only the organizer can drag a card between columns on the board.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_team_id_idx ON public.sessions (team_id);

DROP POLICY IF EXISTS "Crew members view crew sessions" ON public.sessions;
CREATE POLICY "Crew members view crew sessions" ON public.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = sessions.team_id
        AND tm.profile_id = (SELECT auth.uid())
    )
  );

-- New column + policy must reach PostgREST (api) and the storage service.
NOTIFY pgrst, 'reload schema';