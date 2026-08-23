-- Layout improvements for the Creativity Studio:
-- 1. theme_id on layouts so templates can carry their own theme
-- 2. Fix any project page layouts where created_by isn't auth.uid()

-- Add theme_id to layouts (optional reference to a theme).
DO $$ BEGIN
  ALTER TABLE public.layouts ADD COLUMN theme_id uuid REFERENCES public.themes(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Add description to layouts if not present (for template metadata).
DO $$ BEGIN
  ALTER TABLE public.layouts ADD COLUMN description text;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Fix: any layout created_by that's not a valid auth.user UUID should
-- be reassigned to the page owner's profile ID (which IS auth.uid()).
-- This only applies to project page layouts where created_by was set
-- to the project UUID instead of the user's UUID.
UPDATE public.layouts l
SET created_by = (
  SELECT p.owner_id
  FROM public.pages p
  WHERE p.layout_id = l.id
  AND p.owner_type = 'project'
  LIMIT 1
)
WHERE l.is_template = false
AND l.created_by IS NOT NULL
AND l.created_by IN (
  SELECT id FROM public.projects
)
AND EXISTS (
  SELECT 1 FROM public.pages p
  WHERE p.layout_id = l.id AND p.owner_type = 'project'
);

-- Seed the 11 templates with proper theme_id references so they have
-- distinct visual identities when applied.
UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000012'  -- Terminal
WHERE name = 'Terminal Developer' AND is_template = true;

UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000010'  -- Minimal
WHERE name = 'Minimal Portfolio' AND is_template = true;

UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000017'  -- Cyberpunk
WHERE name = 'Cyberpunk Project' AND is_template = true;

UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000013'  -- Paper
WHERE name = 'Paper Profile' AND is_template = true;

UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000022'  -- Midnight
WHERE name = 'Midnight Docs' AND is_template = true;

UPDATE public.layouts
SET theme_id = '00000000-0000-0000-0000-000000000021'  -- Sunset
WHERE name = 'Sunset Studio' AND is_template = true;