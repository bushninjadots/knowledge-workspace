-- Realtime for public Studio + read receipts in space chat.
--
-- 1. Stream `profiles` changes so a viewer's public Studio reflects the
--    member's backdrop/banner/name updates live.
-- 2. `community_space_members.last_read_at` — when a member last saw the
--    space — powers unread message highlights. Streamed so the divider
--    updates across tabs.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.community_space_members
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

ALTER TABLE public.community_space_members REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_space_members;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
