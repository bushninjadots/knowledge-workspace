-- ============================================================================
-- Tethyr hardening invariants (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- These assert invariants rather than pinning individual objects. Each one was
-- added after a hardening regression that no test happened to assert:
--
--   * 20260904132208 re-added a table-wide GRANT on connected_accounts, undoing
--     the column-scoped grants from 20260822030000.
--   * 20260904132407 and 20260906100554 recreated the project-media and
--     team-avatars upload policies without is_allowed_storage_upload(), leaving
--     only the bucket size cap. Only some buckets were covered by tests, so
--     team-avatars slipped through entirely.
--
-- All three were restored in 20260911130000_restore_clobbered_hardening.sql.
-- An object pin would not have caught them: the new policy carried the *same
-- name* as the safe one. A sweep over every policy of the relevant shape does.
--
-- NOTE: these run against the local database. Drift that exists only on the
-- hosted database is invisible here — see docs/TETHYR_HOSTED_DRIFT_AUDIT_2026-09-11.md.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(4);

-- ---------------------------------------------------------------------------
-- 1. Every storage INSERT/UPDATE policy enforces the upload gate.
--    The gate is the only extension/size check that is not the bucket cap, so
--    a policy recreated without it silently accepts any file type up to the
--    bucket limit. Any new upload bucket must call it too.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd IN ('a', 'w')          -- INSERT, UPDATE
      AND coalesce(pg_get_expr(polwithcheck, polrelid), '')
          NOT LIKE '%is_allowed_storage_upload%'
  $$,
  'every storage INSERT/UPDATE policy calls is_allowed_storage_upload'
);

-- ---------------------------------------------------------------------------
-- 2. connected_accounts has no table-level read/write grant for client roles.
--    The column grants from 20260822030000 are what keep `access_token` and
--    `metadata` away from the browser; a table-level SELECT/INSERT/UPDATE
--    defeats them wholesale, and shows up here as a table privilege.
--    Table-level DELETE is deliberately *not* included: it is granted on
--    purpose so a user can unlink their own account, and RLS scopes it to
--    their own row — deleting a row cannot expose a secret.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT grantee || ' has ' || privilege_type || ' on connected_accounts'
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'connected_accounts'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE')
  $$,
  'no client role holds a table-level SELECT/INSERT/UPDATE on connected_accounts'
);

-- ---------------------------------------------------------------------------
-- 3. The secret columns are unreachable from every client role.
--    has_column_privilege() reports table-level grants too, so this catches
--    the blanket-grant case as well as a stray column grant.
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES ('anon'), ('authenticated')) AS r(role_name)
    CROSS JOIN (VALUES ('access_token'), ('metadata')) AS c(col)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE')) AS p(priv)
    WHERE has_column_privilege(r.role_name, 'public.connected_accounts', c.col, p.priv)
  ),
  'access_token and metadata are unreachable from anon and authenticated'
);

-- ---------------------------------------------------------------------------
-- 4. The service role keeps the table-level access the OAuth server flows need.
-- ---------------------------------------------------------------------------
SELECT ok(
  has_table_privilege('service_role', 'public.connected_accounts', 'SELECT')
    AND has_table_privilege('service_role', 'public.connected_accounts', 'INSERT')
    AND has_table_privilege('service_role', 'public.connected_accounts', 'UPDATE'),
  'service_role retains full table access including secrets'
);

SELECT * FROM finish();
ROLLBACK;
