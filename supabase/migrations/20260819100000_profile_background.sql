-- Profile background customization: a backdrop shown behind the user's whole
-- Tethyr space (colors, patterns, or an uploaded image). Stored on the public
-- profile record so it follows the member across devices and can be rendered
-- on their public Studio too. Owner-update + public-read RLS on profiles
-- already covers the column.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS background JSONB;

-- Background images live in their own public bucket (mirrors banners).
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Background images are publicly accessible" ON storage.objects;
  CREATE POLICY "Background images are publicly accessible"
    ON storage.objects FOR SELECT USING (bucket_id = 'backgrounds');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Background owner insert" ON storage.objects;
  CREATE POLICY "Background owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Background owner update" ON storage.objects;
  CREATE POLICY "Background owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Background owner delete" ON storage.objects;
  CREATE POLICY "Background owner delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN null; END $$;
