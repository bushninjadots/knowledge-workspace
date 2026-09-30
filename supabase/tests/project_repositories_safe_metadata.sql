-- ============================================================================
-- project_repositories_safe metadata contract (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins the fix from 20260930120000_repo_metadata_safe_view.sql:
--   * the safe read contract exposes the cached `metadata` column again —
--     the S5 hardening pass had dropped it from the view, so stars/language/
--     default-branch data written on link/import was never readable back
--     (metadata here is GitHub's public repo snapshot, not a secrets column)
--   * the view stays SECURITY INVOKER so reads keep following the
--     project-visibility RLS on the base table
--   * the base table grants are untouched: anon keeps SELECT for the
--     invoker-view read path; writes stay owner-only via RLS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(5);

SELECT is(
  EXISTS (
    SELECT 1
    FROM information_schema.view_column_usage
    WHERE view_schema = 'public'
      AND view_name = 'project_repositories_safe'
      AND table_name = 'project_repositories'
  ),
  true,
  'safe view reads from the base table'
);

SELECT is(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_repositories_safe'
      AND column_name = 'metadata'
  ),
  true,
  'safe view exposes the cached metadata column'
);

SELECT is(
  EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.project_repositories_safe'::regclass
      AND 'security_invoker=true' = ANY (COALESCE(reloptions, '{}'))
  ),
  true,
  'safe view stays SECURITY INVOKER'
);

SELECT is(
  has_table_privilege('anon', 'public.project_repositories_safe', 'SELECT'),
  true,
  'anon keeps SELECT on the safe view'
);

SELECT is(
  EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.project_repositories'::regclass
      AND relrowsecurity
  ),
  true,
  'base table keeps RLS enabled (writes stay owner-only via policies)'
);

SELECT * FROM finish();

ROLLBACK;
