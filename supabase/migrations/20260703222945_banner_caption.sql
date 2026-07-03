-- Optional fun caption shown over the profile banner (emoji-friendly, plain
-- UTF-8 text column). Kept short via a check constraint; enforcement of the
-- exact limit also happens client-side for a snappier UX.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_caption text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_banner_caption_length'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_banner_caption_length
      CHECK (banner_caption IS NULL OR char_length(banner_caption) <= 60);
  END IF;
END $$;

-- Nudge PostgREST to pick up the new column immediately instead of waiting
-- for its next automatic schema refresh.
NOTIFY pgrst, 'reload schema';
