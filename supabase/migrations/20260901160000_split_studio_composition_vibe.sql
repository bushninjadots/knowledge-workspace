-- Keep Studio structure and visual tone independently addressable.
-- Existing personalityId values remain readable through application fallback.
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS composition_id text,
  ADD COLUMN IF NOT EXISTS vibe_id text;

UPDATE public.pages
SET composition_id = COALESCE(composition_id, (config ->> 'compositionId'), (config ->> 'personalityId')),
    vibe_id = COALESCE(vibe_id, (config ->> 'vibeId'), (config ->> 'personalityId'))
WHERE composition_id IS NULL OR vibe_id IS NULL;
