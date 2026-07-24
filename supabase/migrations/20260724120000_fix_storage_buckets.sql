-- Fix missing storage buckets and policies.
-- Buckets referenced in code but never created in migrations.

-- Create missing buckets (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('banners', 'banners', true),
  ('project-media', 'project-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (ensure they exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
  CREATE POLICY "Public can view avatars"
    ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
  CREATE POLICY "Users upload own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
  CREATE POLICY "Users update own avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
  CREATE POLICY "Users delete own avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage policies for banners
DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners readable to authenticated" ON storage.objects;
  CREATE POLICY "Banners readable to authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'banners');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners owner insert" ON storage.objects;
  CREATE POLICY "Banners owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners owner update" ON storage.objects;
  CREATE POLICY "Banners owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners owner delete" ON storage.objects;
  CREATE POLICY "Banners owner delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Storage policies for project-media
DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media readable to authenticated" ON storage.objects;
  CREATE POLICY "Project media readable to authenticated"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'project-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner insert" ON storage.objects;
  CREATE POLICY "Project media owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner update" ON storage.objects;
  CREATE POLICY "Project media owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner delete" ON storage.objects;
  CREATE POLICY "Project media owner delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Public read for project-media (needed for sharing)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media is publicly accessible" ON storage.objects;
  CREATE POLICY "Project media is publicly accessible"
    ON storage.objects FOR SELECT USING (bucket_id = 'project-media');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Public read for avatars (overrides the authenticated-only policy above for public profiles)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN null; END $$;
