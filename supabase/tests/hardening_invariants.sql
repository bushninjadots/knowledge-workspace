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
--   * 20260706100000's skill-proofs SELECT policy was missing its TO clause on
--     hosted (drift audit F1). The sweep now covers SELECT policies on non-public
--     buckets, not just INSERT/UPDATE.
--   * 20260705022445's connections_immutable trigger function was absent on
--     hosted while its migration was recorded as applied (drift audit F2). The
--     suite pinned the trigger's behaviour but never its existence.
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

SELECT plan(7);

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

-- ---------------------------------------------------------------------------
-- 5. No SELECT policy on a non-public storage bucket may omit TO <role>.
--    F1 in the drift audit was a SELECT policy on the skill-proofs bucket
--    that had no role clause — so anon could enumerate every proof object.
--    A non-public bucket must never have a world-readable SELECT policy.
--    polroles IS NULL means the policy applies to PUBLIC (all roles).
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT p.polname
    FROM pg_policy p
    CROSS JOIN storage.buckets b
    WHERE p.polrelid = 'storage.objects'::regclass
      AND p.polcmd = 'r'                       -- SELECT
      AND b.public = false
      AND pg_get_expr(p.polqual, p.polrelid)
          LIKE '%bucket_id = ''' || b.id || '''%'
      AND p.polroles IS NULL                   -- no TO clause = all roles
  $$,
  'no SELECT policy on a non-public bucket omits TO <role>'
);

-- ---------------------------------------------------------------------------
-- 6. The connections immutability trigger function exists.
--    F2 in the drift audit found the function missing on hosted while its
--    migration was recorded as applied. The local suite pinned the trigger's
--    behaviour (rls_regression.sql test 4) but never its existence — so the
--    function could drift away without any test going red.
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_connections_immutable_fields'
      AND n.nspname = 'public'
  ),
  'trg_connections_immutable_fields function exists in public schema'
);

-- ---------------------------------------------------------------------------
-- 7. The connections_immutable trigger itself exists.
--    The function can exist without the trigger being attached; both are
--    needed for the guard to fire. Asserting separately pinpoints which is
--    missing if the test fails.
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'connections_immutable'
      AND c.relname = 'connections'
      AND NOT t.tgisinternal
  ),
  'connections_immutable trigger exists on connections table'
);

SELECT * FROM finish();
ROLLBACK;
