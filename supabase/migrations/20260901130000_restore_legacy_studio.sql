-- Restore public_studio_layout column dropped during Creation Studio migration.
-- This reverses 20260827124459_retire_public_studio_layout.sql so the legacy
-- WorkspaceGrid-based profile customization can persist owner-driven public
-- studio arrangements.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_studio_layout JSONB;
