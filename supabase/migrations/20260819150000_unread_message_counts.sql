-- Per-connection unread message counts for the Messages sidebar.
--
-- SECURITY INVOKER (the default) so the existing "Participants can read
-- messages" RLS policy on `messages` still applies: a caller only sees
-- counts for their own accepted connections. A SECURITY DEFINER version
-- would bypass RLS and leak other people's conversation counts.
CREATE OR REPLACE FUNCTION public.unread_message_counts()
RETURNS TABLE (connection_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT m.connection_id, count(*)::bigint AS unread_count
  FROM public.messages m
  WHERE m.read_at IS NULL
    AND m.sender_id <> auth.uid()
  GROUP BY m.connection_id;
$$;

REVOKE ALL ON FUNCTION public.unread_message_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unread_message_counts() TO authenticated;
