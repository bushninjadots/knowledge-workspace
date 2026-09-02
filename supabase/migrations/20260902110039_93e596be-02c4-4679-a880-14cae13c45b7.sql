ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS composition_id text,
  ADD COLUMN IF NOT EXISTS vibe_id text;

DROP POLICY IF EXISTS "Authenticated can read skill proof files" ON storage.objects;
CREATE POLICY "Owner can read skill proof files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'skill-proofs'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);