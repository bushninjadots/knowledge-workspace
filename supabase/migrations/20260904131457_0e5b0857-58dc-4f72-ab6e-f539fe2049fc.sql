ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS background jsonb,
  ADD COLUMN IF NOT EXISTS public_background jsonb,
  ADD COLUMN IF NOT EXISTS evidence_shelf jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS favorite_achievement text;