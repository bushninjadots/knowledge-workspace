-- ============================================================================
-- EXECUTE privilege invariants for anonymous callers (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Supabase's default privileges grant EXECUTE on every new function in
-- `public` to `anon`, so "is this callable by a signed-out visitor?" defaults
-- to yes and a hardening migration can be undone by any later migration that
-- re-grants or recreates the function. That happened four times in this repo
-- (match_projects, 20260905120000, 20260922104000, and 20260904132519 undoing
-- 20260829110000), so 20260922105000 fixed the default privilege itself and
-- this file pins the result.
--
-- The allowlist below is the *complete* set of public functions an anonymous
-- caller may execute (trigger functions are excluded: PostgreSQL refuses to
-- invoke them outside a trigger, whatever the grant says, and pg_trgm's
-- extension functions are excluded because they come from the extension).
-- Every entry is either:
--   * a helper predicate referenced by a `TO public` RLS policy — an anonymous
--     read evaluates it, so revoking EXECUTE would break the read itself,
--   * a SECURITY INVOKER read RPC behind a public surface (/skills, public
--     project pages, optional-but-harmless authenticated ones) — it cannot
--     bypass RLS, so it only ever returns rows the caller could already read,
--     or
--   * `community_space_member_counts()`, the one SECURITY DEFINER read the
--     public landing page needs, which returns counts only for spaces the
--     caller can already see (see 20260922105000 and test 6).
--
-- Adding an entry means deciding that anonymous callers should reach it; the
-- test fails loudly otherwise, which is the point.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

SELECT plan(7);

-- ---------------------------------------------------------------------------
-- 1. The allowlist is exact.
-- ---------------------------------------------------------------------------
SELECT set_eq(
  $$
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  $$,
  $$
    SELECT * FROM (VALUES
      -- RLS helper predicates used by `TO public` policies.
      ('is_allowed_storage_upload(p_bucket text, p_name text, p_metadata jsonb)'),
      ('is_project_visible(project_id uuid)'),
      ('is_session_organizer(p_session_id uuid, p_user_id uuid)'),
      ('is_session_participant(p_session_id uuid, p_user_id uuid)'),
      ('is_space_member(p_space_id uuid, p_user_id uuid)'),
      -- Read RPCs behind public surfaces; all SECURITY INVOKER except the
      -- space member counts, which the landing page reads signed out.
      ('community_space_member_counts()'),
      ('discussion_reply_counts(p_discussion_ids uuid[])'),
      ('get_layout_lineage(start_id uuid)'),
      ('post_engagement_counts(p_post_ids uuid[])'),
      ('posts_images_are_valid(p_images text[])'),
      ('skill_profile_counts(p_skill_ids uuid[])'),
      ('trending_skills(p_limit integer)')
    ) AS allowed(name)
  $$,
  'anonymous callers can execute exactly the documented allowlist of public functions'
);

-- ---------------------------------------------------------------------------
-- 2. No SECURITY DEFINER routine outside the policy helpers is anon-callable.
--    This is the load-bearing assertion: a DEFINER function runs with RLS
--    bypassed, so an anonymous grant on one is an anonymous grant on whatever
--    it touches — e.g. prune_orphaned_media(..., p_dry_run := false), which
--    deletes storage objects.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname NOT IN (
        -- RLS helper predicates (`TO public` policies evaluate them as anon).
        'is_allowed_storage_upload',
        'is_project_visible',
        'is_session_organizer',
        'is_session_participant',
        'is_space_member',
        -- Public aggregate read, scoped to visible spaces by test 6.
        'community_space_member_counts'
      )
  $$,
  'no SECURITY DEFINER public function is executable by anon except the RLS helpers and the scoped space counts'
);

-- ---------------------------------------------------------------------------
-- 3. Every function an anon-applicable policy calls is executable by anon.
--    The sweep direction of test 2 — it catches the opposite mistake, where a
--    revoke silently breaks an anonymous read because the policy expression
--    can no longer be evaluated.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    WITH policy_bodies AS (
      SELECT coalesce(qual, '') || ' ' || coalesce(with_check, '') AS body
      FROM pg_policies
      WHERE 'anon' = ANY(roles) OR 'public' = ANY(roles)
    ), called AS (
      SELECT DISTINCT (regexp_matches(body, '([a-z_][a-z0-9_]*)\s*\(', 'g'))[1] AS name
      FROM policy_bodies
    )
    SELECT c.name
    FROM called c
    JOIN pg_proc p ON p.proname = c.name
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype <> 'pg_catalog.trigger'::regtype
      AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'every public function referenced by an anon-applicable RLS policy is executable by anon'
);

-- ---------------------------------------------------------------------------
-- 4. The default privilege itself: new functions in public must not be
--    publicly executable, so the allowlist can only grow on purpose.
--
--    Scoped to the `postgres` entry — the role every migration runs as, and
--    therefore the one that creates every app function. `supabase_admin`'s
--    entry only covers objects that role creates itself (extensions); a local
--    `supabase start` runner is not a member of it, so requiring the change
--    here would fail on a database that cannot make it.
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT defaclrole::regrole::text
    FROM pg_default_acl
    WHERE defaclnamespace = 'public'::regnamespace
      AND defaclobjtype = 'f'
      AND defaclrole = 'postgres'::regrole
      AND array_to_string(defaclacl, ',') LIKE '%anon=X%'
  $$,
  'the default ACL for public functions does not grant EXECUTE to anon'
);

-- ---------------------------------------------------------------------------
-- 5. Regression pin for the destructive one, independent of the allowlist.
-- ---------------------------------------------------------------------------
SELECT ok(
  NOT has_function_privilege('anon', 'public.prune_orphaned_media(text, integer, boolean)', 'EXECUTE'),
  'anon cannot execute prune_orphaned_media (deletes storage objects when it is not a dry run)'
);

-- ---------------------------------------------------------------------------
-- 6-7. community_space_member_counts() is allowed to `anon` because the public
--      landing page reads it signed out, so it has to be scoped rather than
--      revoked: its result is the spaces the caller can already see, never a
--      private space's member count.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (alice, 'anon-grants-alice@test.local'), (bob, 'anon-grants-bob@test.local')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, display_name, handle)
  VALUES (alice, 'anon_grants_alice', 'anon-grants-alice'),
         (bob, 'anon_grants_bob', 'anon-grants-bob')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.community_spaces (id, name, slug, created_by, visibility)
  VALUES ('44444444-4444-4444-4444-444444444444', 'Anon grant public', 'anon-grant-public', alice, 'public'),
         ('55555555-5555-5555-5555-555555555555', 'Anon grant private', 'anon-grant-private', alice, 'private')
  ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.community_space_members (space_id, user_id)
  VALUES ('44444444-4444-4444-4444-444444444444', alice),
         ('44444444-4444-4444-4444-444444444444', bob),
         ('55555555-5555-5555-5555-555555555555', alice)
  ON CONFLICT (space_id, user_id) DO NOTHING;
END $$;

SELECT set_config('role', 'anon', true);
SELECT set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

SELECT set_eq(
  $$
    SELECT space_id FROM public.community_space_member_counts()
    WHERE space_id IN (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid
    )
  $$,
  $$ VALUES ('44444444-4444-4444-4444-444444444444'::uuid) $$,
  'anon gets member counts for public spaces only'
);

SELECT set_config('role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);

SELECT set_eq(
  $$
    SELECT space_id FROM public.community_space_member_counts()
    WHERE space_id IN (
      '44444444-4444-4444-4444-444444444444'::uuid,
      '55555555-5555-5555-5555-555555555555'::uuid
    )
  $$,
  $$ VALUES ('44444444-4444-4444-4444-444444444444'::uuid),
            ('55555555-5555-5555-5555-555555555555'::uuid) $$,
  'a member gets the count for their private space too'
);

SELECT * FROM finish();

ROLLBACK;
