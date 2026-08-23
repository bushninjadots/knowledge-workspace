-- ============================================================================
-- connected_accounts column-grant tests (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins the fix from 20260822030000_restrict_connected_account_columns.sql:
--   * access_token / metadata are invisible to anon + authenticated clients
--     (tokens are written and read exclusively through the service role)
--   * the GitHub-connect flow (select safe cols, upsert identity cols,
--     delete own rows) keeps its exact required privileges
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(12);

-- ---------------------------------------------------------------------------
-- 1. Secrets are not client-accessible
-- ---------------------------------------------------------------------------
SELECT is(
  has_column_privilege('authenticated', 'public.connected_accounts', 'access_token', 'SELECT'),
  false,
  'authenticated cannot SELECT access_token'
);

SELECT is(
  has_column_privilege('authenticated', 'public.connected_accounts', 'metadata', 'SELECT'),
  false,
  'authenticated cannot SELECT metadata'
);

SELECT is(
  has_column_privilege('authenticated', 'public.connected_accounts', 'access_token', 'INSERT'),
  false,
  'authenticated cannot INSERT access_token'
);

SELECT is(
  has_column_privilege('authenticated', 'public.connected_accounts', 'access_token', 'UPDATE'),
  false,
  'authenticated cannot UPDATE access_token'
);

SELECT is_empty(
  $$
    SELECT 1
    FROM information_schema.column_privileges
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND table_name = 'connected_accounts'
  $$,
  'anon holds no column privilege on connected_accounts'
);

-- ---------------------------------------------------------------------------
-- 2. The GitHub-connect flow keeps working
-- ---------------------------------------------------------------------------
SELECT ok(
  has_column_privilege('authenticated', 'public.connected_accounts', 'username', 'SELECT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'provider', 'SELECT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'id', 'SELECT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'created_at', 'SELECT'),
  'authenticated still SELECTs the safe representation columns'
);

SELECT ok(
  has_column_privilege('authenticated', 'public.connected_accounts', 'user_id', 'INSERT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'provider', 'INSERT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'provider_id', 'INSERT')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'username', 'INSERT'),
  'authenticated can INSERT the identity columns of its own account'
);

SELECT ok(
  has_column_privilege('authenticated', 'public.connected_accounts', 'provider_id', 'UPDATE')
    AND has_column_privilege('authenticated', 'public.connected_accounts', 'username', 'UPDATE'),
  'authenticated can UPDATE provider_id/username during upsert'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.connected_accounts', 'DELETE'),
  'authenticated retains row-level DELETE'
);

SELECT is(
  has_column_privilege('authenticated', 'public.connected_accounts', 'id', 'INSERT'),
  false,
  'clients never INSERT explicit ids (database default applies)'
);

-- ---------------------------------------------------------------------------
-- 3. Service role keeps full access (server flows depend on it)
-- ---------------------------------------------------------------------------
SELECT ok(
  has_table_privilege('service_role', 'public.connected_accounts', 'SELECT')
    AND has_table_privilege('service_role', 'public.connected_accounts', 'INSERT')
    AND has_table_privilege('service_role', 'public.connected_accounts', 'UPDATE'),
  'service_role retains full table access including secrets'
);

-- RLS stays enabled regardless of grants.
SELECT is(
  (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.connected_accounts'::regclass),
  true,
  'RLS remains enabled on connected_accounts'
);

SELECT * FROM finish();
ROLLBACK;
