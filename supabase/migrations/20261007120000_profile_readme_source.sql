-- Where a member's profile README came from on GitHub, so it can be synced
-- again later ("Sync from GitHub"): { repo: "owner/name", synced_at }.
-- NULL when the README was written on Tethyr or never imported. Syncing is
-- always manual and previewed first; nothing overwrites the README on its own.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS readme_source JSONB;

COMMENT ON COLUMN public.profiles.readme_source IS
  'GitHub source of the profile README ({ repo, synced_at }); NULL = not imported.';
