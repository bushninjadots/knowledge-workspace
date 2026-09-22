-- ============================================================================
-- RLS performance: cache auth.uid() per statement instead of per row.
--
-- `auth.uid()` is a function call; written inline (`auth.uid() = user_id`)
-- Postgres re-evaluates it for every candidate row. Wrapping it in a scalar
-- subquery — `(select auth.uid()) = user_id` — turns it into an InitPlan:
-- computed once per statement, reused for every row. On hot per-user tables
-- (notifications, messages, session membership, follows, library) this removes
-- a per-row function call from every query an RLS filter touches.
--
-- Instead of hardcoding policy names (fragile across 170 migrations), every
-- public-schema policy whose USING / WITH CHECK text references auth.uid()
-- directly is rewritten in place: normalize any existing `(select auth.uid())`
-- back to `auth.uid()`, then substitute `auth.uid()` → `(select auth.uid())`.
-- Semantics are unchanged — the subquery wraps the same STABLE call. This is
-- the fix Supabase's advisors recommend (performance finding
-- `0003_auth_rls_initplan`).
--
-- Scope is deliberately limited to schema `public`:
--   * storage.* policies are extension-managed and rewritten on upgrades;
--     touching them risks drift with Supabase's own definitions.
--   * Each policy is rewritten in its own exception-guarded block — the
--     migration role does not own every table, and one unalterable policy
--     must not abort the sweep. Policies that fail are skipped and simply
--     keep their original (per-row) evaluation.
-- ============================================================================

DO $$
DECLARE
  pol record;
  roles_sql text;
  new_using text;
  new_with_check text;
  cmd_text text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    new_using := NULL;
    new_with_check := NULL;

    -- Normalize an already-wrapped call so the substitution below is
    -- idempotent: "(select auth.uid())" -> "auth.uid()" -> "(select auth.uid())".
    IF pol.qual IS NOT NULL AND position('auth.uid()' in pol.qual) > 0 THEN
      new_using := replace(pol.qual, '(select auth.uid())', 'auth.uid()');
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())');
    END IF;
    IF pol.with_check IS NOT NULL AND position('auth.uid()' in pol.with_check) > 0 THEN
      new_with_check := replace(pol.with_check, '(select auth.uid())', 'auth.uid()');
      new_with_check := replace(new_with_check, 'auth.uid()', '(select auth.uid())');
    END IF;

    -- Nothing to do for policies that don't reference auth.uid() or are
    -- already in the initplan form everywhere they appear.
    IF new_using IS NULL AND new_with_check IS NULL THEN
      CONTINUE;
    END IF;
    IF new_using IS NOT DISTINCT FROM pol.qual
       AND new_with_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    BEGIN
      roles_sql := (
        SELECT string_agg(quote_ident(r), ', ')
        FROM unnest(pol.roles) AS r
      );

      -- NB: pg_policies.permissive is text ('PERMISSIVE'/'RESTRICTIVE'),
      -- not boolean — interpolate it directly.
      cmd_text := format(
        'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
        pol.policyname,
        pol.schemaname,
        pol.tablename,
        pol.permissive,
        pol.cmd,
        COALESCE(roles_sql, 'public'),
        CASE WHEN new_using IS NOT NULL THEN ' USING (' || new_using || ')' ELSE '' END,
        CASE WHEN new_with_check IS NOT NULL THEN ' WITH CHECK (' || new_with_check || ')' ELSE '' END
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
      EXECUTE cmd_text;
    EXCEPTION WHEN OTHERS THEN
      -- Not owned by the migration role, or a shape we cannot re-create:
      -- leave the policy as-is rather than aborting the whole sweep.
      RAISE NOTICE 'skipped policy %.% on %.%: %',
        pol.tablename, pol.policyname, pol.schemaname, pol.tablename, SQLERRM;
    END;
  END LOOP;
END $$;
