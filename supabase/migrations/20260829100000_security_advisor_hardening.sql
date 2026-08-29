-- Security advisor hardening

-- Migration bookkeeping is internal and must never be exposed through the API.
ALTER TABLE public.migrated_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.migrated_pages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.migrated_pages TO service_role;
DROP POLICY IF EXISTS "Migrated pages are publicly readable" ON public.migrated_pages;
DROP POLICY IF EXISTS "Migration owners can read mappings" ON public.migrated_pages;
CREATE POLICY "Migration owners can read mappings"
  ON public.migrated_pages FOR SELECT TO authenticated
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (
      owner_type = 'project'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = migrated_pages.owner_id
          AND p.profile_id = auth.uid()
      )
    )
  );

-- Submission URLs, notes, and review state are private to the participant and
-- challenge creator. Public challenge discovery remains available via challenges.
REVOKE SELECT ON public.challenge_participants FROM anon;
DROP POLICY IF EXISTS "Public read participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants are publicly readable" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants and creators can read submissions" ON public.challenge_participants;
CREATE POLICY "Participants and creators can read submissions"
  ON public.challenge_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_participants.challenge_id
        AND c.created_by = auth.uid()
    )
  );

-- Repository URLs remain visible only where the project itself is visible;
-- metadata may contain integration details and is restricted to project owners
-- and contributors. The safe view exposes public fields without metadata.
DROP POLICY IF EXISTS "Project repositories are publicly readable" ON public.project_repositories;
DROP POLICY IF EXISTS "Project repositories are readable for visible projects" ON public.project_repositories;
CREATE POLICY "Project repositories are readable for visible projects"
  ON public.project_repositories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_repositories.project_id
        AND (
          p.profile_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_contributors pc
            WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
          )
          OR COALESCE(p.visibility, 'public') = 'public'
        )
    )
  );

REVOKE SELECT ON public.project_repositories_safe FROM anon, authenticated;
CREATE OR REPLACE VIEW public.project_repositories_safe AS
SELECT id, project_id, provider, url, created_at, updated_at
FROM public.project_repositories;
GRANT SELECT ON public.project_repositories_safe TO anon, authenticated;

-- This RPC is an authenticated maintenance action, not a public API method.
REVOKE ALL ON FUNCTION public.reseed_default_templates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseed_default_templates() TO authenticated;
ALTER FUNCTION public.reseed_default_templates() SET search_path = public;

NOTIFY pgrst, 'reload schema';
