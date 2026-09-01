-- Drop the legacy public_studio_layout column. The block page system fully
-- replaced the WorkspaceGrid-based profile customization (see
-- docs/superpowers/plans/2026-09-01-studio-expressive-redesign.md).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS public_studio_layout;