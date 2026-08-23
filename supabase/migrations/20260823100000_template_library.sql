-- Stage 14 — Template library: usage tracking and metadata fields.
-- Adds catalog fields to the existing layouts table when is_template = true.

-- 1. Usage count — incremented each time a template is applied.
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.layouts.usage_count IS 'How many times this template has been applied. Only meaningful when is_template = true.';

-- 2. Description for template catalog.
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN public.layouts.description IS 'Optional description shown in the template library.';

-- 3. Category for template browsing.
ALTER TABLE public.layouts ADD COLUMN IF NOT EXISTS category text;
COMMENT ON COLUMN public.layouts.category IS 'Browsing category (minimal, developer, portfolio, documentation, startup, community, creative, experimental).';

-- 4. Index for sorting by usage (popular templates).
CREATE INDEX IF NOT EXISTS layouts_template_usage_idx ON public.layouts (usage_count DESC) WHERE is_template = true;

-- 5. Verify RLS already covers updates (created_by only) — no new policies needed.

-- 6. RPC function to increment usage count atomically.
CREATE OR REPLACE FUNCTION public.increment_usage_count(template_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.layouts
  SET usage_count = usage_count + 1
  WHERE id = template_id AND is_template = true;
$$;

COMMENT ON FUNCTION public.increment_usage_count IS 'Bump usage count when a template is applied.';

-- Everyone can call this (it only increments a counter for public templates).
GRANT EXECUTE ON FUNCTION public.increment_usage_count TO anon, authenticated, service_role;