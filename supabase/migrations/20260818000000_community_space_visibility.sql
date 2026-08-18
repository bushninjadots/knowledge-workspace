-- Community space visibility (public/private).
--
-- The spaces settings UI, space header, landing, and profile-communities tabs
-- all reference community_spaces.visibility, but the original spaces migration
-- never added the column. Add it with a safe default so existing spaces stay
-- public and the private-space toggle actually persists.
ALTER TABLE public.community_spaces
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.community_spaces
  DROP CONSTRAINT IF EXISTS community_spaces_visibility_check;
ALTER TABLE public.community_spaces
  ADD CONSTRAINT community_spaces_visibility_check
  CHECK (visibility IN ('public', 'private'));
