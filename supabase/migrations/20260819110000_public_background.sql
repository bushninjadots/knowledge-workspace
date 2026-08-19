-- Optional background for the member's public Studio, distinct from the
-- private app-wide `background`. When null, the public Studio falls back to
-- `background`. Stored on the public profile record so visitors can render it
-- (owner-update + public-read RLS on profiles already covers the column).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_background JSONB;
