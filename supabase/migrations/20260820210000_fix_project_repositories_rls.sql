-- Fix project_repositories public-read policy for private projects (S6)
-- The old policy "Project repositories are publicly readable" used USING (true),
-- which leaks repository details (URLs, metadata) for private projects.
DROP POLICY IF EXISTS "Project repositories are publicly readable"
  ON public.project_repositories;

CREATE POLICY "Public can view project repositories"
  ON public.project_repositories
  FOR SELECT
  USING (
    public.is_project_visible(project_id)
  );

-- Exclude access_token from client queries (S5)
-- Create a view that omits the metadata column (which can contain tokens)
-- and exposes only safe columns.
CREATE OR REPLACE VIEW public.project_repositories_safe AS
  SELECT id, project_id, provider, url, created_at, updated_at
  FROM public.project_repositories;

-- Allow anon and authenticated to read the safe view
GRANT SELECT ON public.project_repositories_safe TO anon, authenticated;
