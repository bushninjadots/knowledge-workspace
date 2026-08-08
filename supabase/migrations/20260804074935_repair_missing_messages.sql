-- ============================================================================
-- Repair: recreate the `messages` object set that migration 20260704070738
-- claims to have created but never actually landed on this database.
--
-- Background: `20260704070738` is recorded as applied in
-- supabase_migrations.schema_migrations, but the `messages` table, the
-- `connections.intro_message` column and the `trg_log_message()` function are
-- missing (verified against the remote schema). The consolidated migration
-- `20260804074936` (pending) creates a trigger ON public.messages, so the
-- whole push fails on that missing table.
--
-- This migration recreates exactly those objects idempotently. On a healthy
-- database (like the local dev DB) every statement is a no-op; on the drifted
-- remote it fills in what's missing before the pending migrations run.
--
-- Safe to re-run: all statements are guarded.
-- ============================================================================

-- connections.intro_message (missing on remote)
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS intro_message text CHECK (char_length(intro_message) <= 500);

-- Direct messages between two users (only allowed once connected)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_connection ON public.messages(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Read: either party of the underlying accepted connection
DO $$ BEGIN
  CREATE POLICY "Participants can read messages"
    ON public.messages FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.id = messages.connection_id
          AND c.status = 'accepted'
          AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Send: only as yourself, only inside an accepted connection you belong to
DO $$ BEGIN
  CREATE POLICY "Participants can send messages"
    ON public.messages FOR INSERT TO authenticated
    WITH CHECK (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.id = messages.connection_id
          AND c.status = 'accepted'
          AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Mark-as-read: only the recipient may update read_at
DO $$ BEGIN
  CREATE POLICY "Recipient can mark read"
    ON public.messages FOR UPDATE TO authenticated
    USING (
      sender_id <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.id = messages.connection_id
          AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
      )
    )
    WITH CHECK (
      sender_id <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.id = messages.connection_id
          AND (c.requester_id = auth.uid() OR c.addressee_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sender may delete their own messages
DO $$ BEGIN
  CREATE POLICY "Sender can delete own messages"
    ON public.messages FOR DELETE TO authenticated
    USING (sender_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Log activity when a new message is sent
CREATE OR REPLACE FUNCTION public.trg_log_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _recipient uuid;
BEGIN
  SELECT CASE WHEN c.requester_id = NEW.sender_id THEN c.addressee_id ELSE c.requester_id END
    INTO _recipient
  FROM public.connections c WHERE c.id = NEW.connection_id;
  IF _recipient IS NOT NULL THEN
    PERFORM public.log_activity(_recipient, 'message_received',
      jsonb_build_object('from', NEW.sender_id, 'connection_id', NEW.connection_id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_messages_activity ON public.messages;
CREATE TRIGGER trg_messages_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_message();

REVOKE EXECUTE ON FUNCTION public.trg_log_message() FROM PUBLIC, anon, authenticated;

-- Realtime: stream row changes so dashboard/messages update live
ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.activity_events REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
