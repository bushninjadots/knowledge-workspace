-- ============================================================================
-- Tethyr security-advisor hardening tests (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins the fixes from 20260822000000/...01/...02:
--   * every public-schema SECURITY DEFINER function pins a fixed search_path
--   * avatars / banners / backgrounds / skill-proofs buckets are private
--     (no public object listing) yet keep public per-object read policies
--   * app-facing space RPCs are not callable by the anon role
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(12);

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER functions all pin a fixed search_path
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef
      AND n.nspname = 'public'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
        )
      )
  ),
  'every public SECURITY DEFINER function pins a fixed search_path'
);

-- The specific helpers that used to lack it:
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_session_organizer'
      AND pg_get_function_identity_arguments(oid) = 'p_session_id uuid, p_user_id uuid'
      AND proconfig::text LIKE '%search_path=public%'
  ),
  'is_session_organizer(uuid, uuid) pins search_path = public'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_session_participant'
      AND pg_get_function_identity_arguments(oid) = 'p_session_id uuid, p_user_id uuid'
      AND proconfig::text LIKE '%search_path=public%'
  ),
  'is_session_participant(uuid, uuid) pins search_path = public'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_space_owner'
      AND pg_get_function_identity_arguments(oid) = 'p_space_id uuid, p_user_id uuid'
      AND proconfig::text LIKE '%search_path=public%'
  ),
  'is_space_owner(uuid, uuid) pins search_path = public'
);

-- Orphaned 1-arg duplicate was dropped, not left live with an open grant.
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_session_organizer'
      AND pg_get_function_identity_arguments(oid) = 'session_uuid uuid'
  ),
  'orphaned is_session_organizer(uuid) was dropped'
);

-- ---------------------------------------------------------------------------
-- 2. No public buckets (no unauthenticated object listing)
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE public = true
  ),
  'no storage bucket is public (public_bucket_allows_listing)'
);

SELECT is(
  (SELECT count(*) FROM storage.buckets
    WHERE id IN ('avatars', 'banners', 'backgrounds', 'skill-proofs')
      AND public = false)::bigint,
  4::bigint,
  'avatars, banners, backgrounds, skill-proofs are all private buckets'
);

-- The per-object public read policy must still exist so anon read (and thus
-- signed-URL creation for the public Studio) keeps working.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = 'objects'
      AND pol.polname = 'Avatar images are publicly accessible'
  ),
  'avatars keep a PUBLIC SELECT policy on storage.objects'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = 'objects'
      AND pol.polname = 'Background images are publicly accessible'
  ),
  'backgrounds keep a PUBLIC SELECT policy on storage.objects'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    WHERE c.relname = 'objects'
      AND pol.polname = 'Banners are publicly accessible'
  ),
  'banners keep a PUBLIC SELECT policy on storage.objects'
);

-- ---------------------------------------------------------------------------
-- 3. App-facing space RPCs are not callable by anon
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'approve_space_join_request', 'reject_space_join_request',
        'ban_space_member', 'unban_space_member', 'mark_space_read'
      )
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'space-moderation RPCs are revoked from the anon role'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.mark_space_read(uuid)', 'EXECUTE'),
  'mark_space_read is still executable by authenticated users'
);

SELECT * FROM finish();
ROLLBACK;
