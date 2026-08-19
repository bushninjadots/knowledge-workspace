-- Let a member pin their favourite badge next to their name. The value is an
-- achievement_type label; it's plain text here so adding/renaming badge types
-- never requires a schema change.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_achievement text;

COMMENT ON COLUMN public.profiles.favorite_achievement IS
  'Achievement type the member chose to show next to their name.';
