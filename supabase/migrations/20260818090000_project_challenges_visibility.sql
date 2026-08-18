-- Link challenges to projects so a challenge can live on a project
-- (Stage 5: "make sessions and challenges visibly relate to projects").
-- Challenges stay world-readable like before; the new column only lets a
-- project page surface its own challenges.

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_challenges_project ON public.challenges(project_id);

-- A challenge can be linked to a project only by someone on that project's
-- team, so anyone can't decorate someone else's project page with challenges.
DROP POLICY IF EXISTS "Authenticated users insert challenges" ON public.challenges;
CREATE POLICY "Authenticated users insert challenges" ON public.challenges
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.project_contributors pc
        WHERE pc.project_id = challenges.project_id
          AND pc.profile_id = auth.uid()
      )
    )
  );
