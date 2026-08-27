-- Reconcile Creative Studio columns without editing previously applied migrations.
-- This is intentionally idempotent so local and remote environments converge.

ALTER TABLE public.layouts
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.themes(id);

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS theme_overrides jsonb DEFAULT NULL;

COMMENT ON COLUMN public.pages.theme_overrides IS
  'User-customized theme token overrides merged on top of the base theme tokens.';
