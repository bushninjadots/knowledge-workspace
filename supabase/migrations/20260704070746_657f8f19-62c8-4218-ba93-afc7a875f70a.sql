
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_caption text CHECK (banner_caption IS NULL OR char_length(banner_caption) <= 60);
