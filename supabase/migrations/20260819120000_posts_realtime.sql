-- Stream community space chat over Supabase Realtime.
-- posts/comments are already in the supabase_realtime publication; REPLICA
-- IDENTITY FULL makes UPDATE/DELETE payloads carry the full row so the client
-- can refetch and reconcile without missing data.
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
