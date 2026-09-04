DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'lesson_learned';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'feedback_request';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'open_role';
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS uploaded_files jsonb DEFAULT '[]';

COMMENT ON COLUMN projects.uploaded_files IS 'Array of uploaded files with name, path, size, type, and uploaded_at. Files live in project-media bucket.';

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

DO $$ BEGIN
  ALTER TABLE public.projects ADD COLUMN visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE INDEX IF NOT EXISTS projects_visibility_idx ON public.projects (visibility);

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

NOTIFY pgrst, 'reload schema';