-- Self-declared-only proof wasn't giving anyone useful signal. Creators need
-- to say how experienced they actually are, and back it up with a real
-- uploaded file instead of only a pasted link.

DO $$ BEGIN
  CREATE TYPE public.skill_experience_level AS ENUM (
    'beginner',
    'intermediate',
    'advanced',
    'expert'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profile_skills_teach
  ADD COLUMN IF NOT EXISTS experience_level public.skill_experience_level
    NOT NULL DEFAULT 'intermediate';

-- Storage for uploaded proof files (certificates, screenshots, portfolio
-- exports). `proof_url` now holds either a pasted link OR the public URL of
-- a file uploaded to this bucket — same column, two ways to fill it in.
INSERT INTO storage.buckets (id, name, public)
VALUES ('skill-proofs', 'skill-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Skill proof files are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'skill-proofs');

CREATE POLICY "Owner can upload skill proof files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can replace skill proof files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can delete skill proof files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
