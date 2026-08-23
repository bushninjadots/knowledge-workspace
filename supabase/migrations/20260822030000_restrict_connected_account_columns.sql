-- ============================================================================
-- connected_accounts: restrict client access to secret columns
-- ============================================================================
-- connected_accounts stores OAuth access tokens. The blanket table-level
-- GRANT added in 20260818020000 made `access_token` and `metadata` readable
-- by any authenticated client through PostgREST. RLS limits rows to their
-- owner, but the owner's own token must not be exposed to the browser
-- (XSS / shared-device risk) — server code reads tokens via the service role,
-- which is unaffected by these grants.
--
-- Replace the table-wide grant with column-scoped ones that keep the
-- GitHub-connect flow working unchanged:
--   SELECT  — everything except access_token / metadata
--   INSERT  — identity columns only (tokens are written server-side)
--   UPDATE  — username / provider_id refresh during client upsert
--   DELETE  — whole rows, unchanged
-- ============================================================================

REVOKE ALL ON public.connected_accounts FROM anon;
REVOKE ALL ON public.connected_accounts FROM authenticated;

GRANT SELECT (id, user_id, provider, provider_id, username, created_at, updated_at)
  ON public.connected_accounts TO authenticated;
GRANT INSERT (user_id, provider, provider_id, username)
  ON public.connected_accounts TO authenticated;
GRANT UPDATE (provider_id, username)
  ON public.connected_accounts TO authenticated;
GRANT DELETE ON public.connected_accounts TO authenticated;

-- service_role keeps its table-level ALL from 20260818020000.
