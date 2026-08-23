-- ============================================================================
-- RLS tightening tests (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Pins the fix from 20260822040000_tighten_session_availability_rls.sql and
-- guards the wider invariant: tables whose rows are member/private-scoped
-- anywhere else must never carry a blanket `USING (true)` read policy.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(5);

-- ---------------------------------------------------------------------------
-- 1. session_availability blanket reads are gone
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.session_availability'::regclass
      AND polname = 'Availability viewable by authenticated'
  ),
  'blanket authenticated read on session_availability was dropped'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.session_availability'::regclass
      AND polname = 'Others view availability'
  ),
  'blanket public read on session_availability was dropped'
);

-- ---------------------------------------------------------------------------
-- 2. Owner-scoped access survives
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT count(*) FROM pg_policy
    WHERE polrelid = 'public.session_availability'::regclass)::bigint,
  2::bigint,
  'exactly the two owner-scoped policies remain on session_availability'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'session_availability'
      AND (
        qual IS NULL
        OR qual NOT LIKE '%auth.uid()%'
        OR qual NOT LIKE '%profile_id%'
      )
  ),
  'every remaining session_availability policy is scoped to the owning profile'
);

-- ---------------------------------------------------------------------------
-- 3. Invariant: member/private-scoped tables must not regain blanket reads
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'session_availability', 'session_participants', 'session_requests',
        'sessions', 'messages', 'connections', 'follows', 'connected_accounts',
        'community_space_members', 'community_space_join_requests',
        'notifications', 'post_reports', 'space_bans', 'moderation_log',
        'activity_events', 'user_github_tokens', 'user_layout_preferences',
        'project_visits', 'project_watchers'
      )
      AND p.polcmd IN ('r', '*')
      AND p.polqual::text = '{:bool true}'
  ),
  'no member-gated table carries a blanket USING (true) read policy'
);

SELECT * FROM finish();
ROLLBACK;
