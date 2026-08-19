-- Teams (crews) get a short description and an editable profile picture so a
-- crew page reads as more than a name + roster. The description is editable by
-- team leads; the avatar lives in a dedicated private bucket that only leads
-- can write to, keyed by team id.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.teams.description IS
  'Short, plain-text summary of what this crew builds and who it is for.';

-- ---------------------------------------------------------------------------
-- Team avatar storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', false)
ON CONFLICT (id) DO NOTHING;

-- Public read: team avatars are shown on public crew pages.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team avatars are publicly readable" ON storage.objects;
  CREATE POLICY "Team avatars are publicly readable"
    ON storage.objects FOR SELECT USING (bucket_id = 'team-avatars');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leads can upload/replace/delete the team avatar. The path is
-- teams/<teamId>/... so the first folder identifies the team.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads upload team avatar" ON storage.objects;
  CREATE POLICY "Team leads upload team avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads update team avatar" ON storage.objects;
  CREATE POLICY "Team leads update team avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads delete team avatar" ON storage.objects;
  CREATE POLICY "Team leads delete team avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
