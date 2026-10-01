-- ============================================================================
-- connected_accounts: restore the UPDATE columns the GitHub-connect upsert needs
-- ============================================================================
-- 20260911130000 granted UPDATE on (provider_id, username) so the client upsert
-- in github-connect.tsx could refresh the linked handle. But PostgREST's
-- merge-duplicates (INSERT ... ON CONFLICT (user_id, provider) DO UPDATE)
-- statically requires UPDATE on every column that appears in the INSERT
-- payload — including user_id and provider, which never change on conflict.
-- Postgres checks table/column privileges per statement before executing, so
-- the upsert fails with 42501 "permission denied for table connected_accounts"
-- for every authenticated user, and the connect flow dies with a swallowed
-- error (the UI reports success-shaped silence because the mutation only
-- toasts on the same query that fails).
--
-- The columns stay semantically read-only to clients: RLS limits rows to
-- their owner (user_id = auth.uid()), and ON CONFLICT DO UPDATE never writes
-- user_id/provider — they only appear as conflict targets/payload echo.
-- access_token and metadata remain service-role only.
--
-- This is the same clobber-and-restore class documented in
-- 20260911130000_restore_clobbered_hardening.sql: verify client-facing grants
-- against the actual queries, not the migration that last touched the table.
-- ============================================================================

GRANT UPDATE (user_id, provider) ON public.connected_accounts TO authenticated;

-- sandbox_exec is granted all future tables by default-privilege migrations;
-- keep it aligned with the hardening posture for this table as well.
GRANT UPDATE (user_id, provider) ON public.connected_accounts TO sandbox_exec;
