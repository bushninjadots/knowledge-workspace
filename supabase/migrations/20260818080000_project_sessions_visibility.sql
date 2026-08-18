-- Project contributors can view the sessions linked to their project.
--
-- Sessions were previously readable only by the organizer and explicit
-- participants, which left a project's team unable to see the project's own
-- sessions on the project page. This closes that gap (Stage 5: "make sessions
-- visibly relate to projects") without making sessions world-readable — the
-- meeting URL/location stay inside the team.
--
-- Sessions with a NULL project_id keep their existing visibility (organizer +
-- participants only), because the EXISTS below can never match a null project.

DROP POLICY IF EXISTS "Project contributors view project sessions" ON public.sessions;
CREATE POLICY "Project contributors view project sessions" ON public.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.project_contributors pc
      WHERE pc.project_id = sessions.project_id
        AND pc.profile_id = auth.uid()
    )
  );
