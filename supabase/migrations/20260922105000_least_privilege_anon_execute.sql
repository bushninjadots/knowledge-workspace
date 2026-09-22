-- ============================================================================
-- Least privilege on EXECUTE for anonymous callers
-- ============================================================================
-- Supabase's `postgres` and `supabase_admin` default privileges grant EXECUTE
-- on every function created in `public` to `anon`, `authenticated` and
-- `service_role`. `REVOKE ... FROM PUBLIC` does not remove those explicit
-- grants, so a function that hardens itself with `REVOKE ALL ... FROM PUBLIC`
-- is still callable by a signed-out visitor.
--
-- That matters most for SECURITY DEFINER routines: "anon can call it" means
-- "anon can call it as the definer, with RLS bypassed". Most of the functions
-- below are exactly that, including `prune_orphaned_media(...)`, which deletes
-- storage objects when called with `p_dry_run := false`.
--
-- This is the fourth occurrence of the class in this repo (match_projects,
-- 20260905120000, 20260922104000, and now these). Earlier rounds only fixed the
-- individual functions, so a later migration could — and did — re-grant anon
-- by accident (20260904132519 undid the `community_space_member_counts()`
-- revoke from 20260829110000). The default-privilege statements at the bottom
-- fix the grant itself, and supabase/tests/anon_execute_grants.sql pins the
-- resulting allowlist so a re-grant fails CI instead of shipping.
--
-- The allowlist that remains is deliberate and asserted in that test:
--   * helper predicates referenced by `TO public` RLS policies, which must stay
--     executable by anon or anonymous reads of those tables fail;
--   * SECURITY INVOKER read RPCs behind public surfaces (/skills, public
--     project pages) — they cannot bypass RLS, so they only ever see public
--     rows;
--   * `community_space_member_counts()`, the one SECURITY DEFINER read that a
--     public surface needs; it is scoped to spaces the caller can already see
--     and is called out in its own section below;
--   * pg_trgm's extension functions, which the trigram indexes use.
-- ============================================================================

-- Migration-only DDL helper. It creates triggers as its definer; the migration
-- owner runs it, no client role ever does.
REVOKE EXECUTE ON FUNCTION public._create_trigger_if_table_exists(
  text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER predicates referenced only by `TO authenticated` policies.
-- An anonymous query never evaluates them (the policy does not apply to anon),
-- so they are not part of the allowlist either.
REVOKE EXECUTE ON FUNCTION public.is_space_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_space_owner_or_moderator(uuid, uuid) FROM PUBLIC, anon;

-- SECURITY DEFINER helpers with no anonymous read path: internal plumbing for
-- the media/moderation triggers.
REVOKE EXECUTE ON FUNCTION public.is_space_banned(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.media_object_is_referenced(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_media_bucket_snapshot() FROM PUBLIC, anon;

-- Storage maintenance: `p_dry_run := false` deletes orphaned objects as the
-- definer, which no signed-out visitor should be able to trigger. Intended
-- caller is the owner/service_role (see 20260907120000).
REVOKE EXECUTE ON FUNCTION public.prune_orphaned_media(text, integer, boolean)
  FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- community_space_member_counts(): anonymous callers *are* part of the design.
--
-- 20260829110000 revoked `anon` on the grounds that "the aggregate RPC is not
-- anonymous", but the public landing page's community section reads it while
-- signed out (src/components/tethyr/landing/community-spaces.tsx), and the
-- 20260904132519 schema dump had already re-granted it — which is why the 401s
-- that appeared when the revoke was real stayed invisible.
--
-- The revoke is not re-applied, because the grant is not what was wrong: the
-- function returned a member count for *every* space, including private ones
-- the caller cannot see. It now returns counts only for spaces the caller can
-- already see — the exact predicate of the `community_spaces` SELECT policy —
-- so the anonymous result is the public spaces the landing section renders and
-- nothing else.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_space_member_counts()
RETURNS TABLE (space_id uuid, member_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.space_id, count(*)::bigint
  FROM public.community_space_members m
  JOIN public.community_spaces s ON s.id = m.space_id
  WHERE s.visibility = 'public'
     OR s.created_by = (SELECT auth.uid())
     OR public.is_space_member(s.id, (SELECT auth.uid()))
  GROUP BY m.space_id;
$$;

REVOKE ALL ON FUNCTION public.community_space_member_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_space_member_counts() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Structural fix: new functions in `public` are no longer executable by anon
-- unless a migration grants it explicitly. `authenticated` and `service_role`
-- keep their default grants; PUBLIC is not granted by the default ACL at all.
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- supabase_admin owns the extension objects; its default privileges only apply
-- to functions it creates itself. A local `supabase start` runner is not a
-- member of that role, so this is best-effort (hosted postgres is).
DO $$
BEGIN
  IF pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE EXECUTE ON FUNCTIONS FROM anon;
  ELSE
    RAISE NOTICE 'skipping supabase_admin default privileges: % is not a member',
      current_user;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
