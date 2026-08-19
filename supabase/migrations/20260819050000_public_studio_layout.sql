-- Public Studio layout is intentionally stored on the public profile record.
-- The profile table is already publicly readable and owner-updatable, so the
-- layout can be rendered for visitors without exposing private workspace prefs.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_studio_layout JSONB;
