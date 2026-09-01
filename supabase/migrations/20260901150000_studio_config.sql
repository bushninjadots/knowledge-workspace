-- Studio config: editable appearance, personality, and density settings for a
-- page. Stored as JSONB on the pages row so edits are cheap and schema-light.
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pages.config IS
  'StudioConfig JSON: radius, typography, density, accent mode/color, and the active personality preset id.';