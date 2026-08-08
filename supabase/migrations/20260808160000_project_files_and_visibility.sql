-- ============================================================================
-- Project files + visibility fixes
--
-- 1) project-media storage policies rejected every project *file* upload: they
--    required the first path folder to be the uploader's auth.uid(), but the
--    app stores project files under the *project id* (e.g.
--    `<projectId>/<timestamp>-<name>`), so every upload failed with an RLS
--    error. Allow the project owner + contributors to manage objects inside
--    their project's folder. Cover images are uploaded under the owner's own
--    uid folder (e.g. `<userId>/<uuid>.png`), so the owner's own folder stays
--    allowed too — covers are associated with a project via `cover_url`.
--
-- 2) Add a public/private `visibility` option to projects and make RLS hide
--    private projects from everyone except the owner and contributors.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Project file storage (project-media bucket)
-- ---------------------------------------------------------------------------
-- Helper: is this object inside a project folder the user can write to?
-- Either the uploader's own uid folder (covers) or a project they own/join.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner insert" ON storage.objects;
  CREATE POLICY "Project media owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner update" ON storage.objects;
  CREATE POLICY "Project media owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner delete" ON storage.objects;
  CREATE POLICY "Project media owner delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- 2. Project public/private visibility
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS projects_visibility_idx ON public.projects (visibility);

-- Private projects are only visible to their owner + contributors. Public
-- projects (the default) remain visible to everyone, signed-out included.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Projects viewable by everyone" ON public.projects;
  CREATE POLICY "Projects viewable by everyone" ON public.projects
    FOR SELECT USING (
      visibility = 'public'
      OR profile_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_contributors pc
        WHERE pc.project_id = id AND pc.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
