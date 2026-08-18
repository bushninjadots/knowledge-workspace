-- connected_accounts was created without table-level grants, so the
-- `authenticated` role had no SELECT/INSERT/UPDATE/DELETE and every client
-- query returned 42501 "permission denied for table connected_accounts" (403),
-- silently breaking the GitHub-connect flow (the UI swallowed the error and
-- showed "Connect GitHub" as if nothing was connected).
--
-- Restore the grants the flow depends on and add the UPDATE policy that its
-- upsert (INSERT ... ON CONFLICT DO UPDATE) requires.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;

CREATE POLICY "Users can update own connected account"
  ON public.connected_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
