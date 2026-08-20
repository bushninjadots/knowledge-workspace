-- Let each project choose how visitors encounter its work without creating
-- another settings surface. The project page keeps the identity and workbench
-- fixed, while the preset controls emphasis and section navigation.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS presentation_preset text NOT NULL DEFAULT 'story-first';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_presentation_preset_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_presentation_preset_check
  CHECK (presentation_preset IN ('story-first', 'demo-first', 'process-first', 'collaboration-first'));
