-- ============================================================================
-- Tethyr achievement reconciliation on delete (pgTAP)
-- ============================================================================
-- Run with: supabase test db
--
-- Asserts the issue #16 contract: badges are derived from live state, so when
-- the contributing entity is deleted (or a role application stops being
-- accepted), the now-ineligible recomputable badge is revoked. Also pins the
-- project → page cleanup added alongside it.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgtap;

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixture setup (idempotent for local scratch DBs)
-- ---------------------------------------------------------------------------
DO $$
DECLARE _u uuid;
BEGIN
  FOREACH _u IN ARRAY ARRAY[
    '11111111-1111-1111-1111-111111111111'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid
  ] LOOP
    INSERT INTO auth.users(id, email) VALUES (_u, _u::text || '@test.local')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.profiles(id, display_name, handle)
      VALUES (_u, 'user_' || substr(_u::text,1,4), 'u' || substr(_u::text,1,6))
      ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

SELECT plan(20);

-- ---------------------------------------------------------------------------
-- 1. Object existence
-- ---------------------------------------------------------------------------
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'reconcile_user_achievements' AND n.nspname = 'public'),
  'reconcile_user_achievements exists');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_reconcile_user_achievements' AND n.nspname = 'public'),
  'trg_reconcile_user_achievements exists');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'trg_cleanup_project_pages' AND n.nspname = 'public'),
  'trg_cleanup_project_pages exists');

-- The reconcile trigger is attached to every source table.
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'projects'),
  'reconcile trigger on projects');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'comments'),
  'reconcile trigger on comments');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'posts'),
  'reconcile trigger on posts');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'project_contributors'),
  'reconcile trigger on project_contributors');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'skill_endorsements'),
  'reconcile trigger on skill_endorsements');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'teams'),
  'reconcile trigger on teams');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'team_members'),
  'reconcile trigger on team_members');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'project_role_applications'),
  'reconcile trigger on project_role_applications');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'challenge_participants'),
  'reconcile trigger on challenge_participants');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_reconcile_user_achievements' AND c.relname = 'session_participants'),
  'reconcile trigger on session_participants');
SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_cleanup_project_pages' AND c.relname = 'projects'),
  'page-cleanup trigger on projects');

-- ---------------------------------------------------------------------------
-- 2. Project delete revokes first_project
-- ---------------------------------------------------------------------------
DO $$
DECLARE _u uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  _pid uuid;
BEGIN
  DELETE FROM public.user_achievements WHERE profile_id = _u;
  INSERT INTO public.projects (profile_id, title) VALUES (_u, 'Reconcile test')
    RETURNING id INTO _pid;
  PERFORM public.reconcile_user_achievements(_u);
  IF NOT EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE profile_id = _u AND achievement = 'first_project'
  ) THEN
    RAISE EXCEPTION 'first_project not awarded after project insert';
  END IF;
  DELETE FROM public.projects WHERE id = _pid;
  IF EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE profile_id = _u AND achievement = 'first_project'
  ) THEN
    RAISE EXCEPTION 'first_project survived project delete';
  END IF;
END $$;

SELECT ok(true, 'project delete revokes first_project');

-- ---------------------------------------------------------------------------
-- 3. Challenge pass awards challenge_winner; delete revokes it
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  -- 11111111 is the challenger, 22222222 the challenge creator/reviewer.
  _challenger uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  _creator uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  _cid uuid;
  _pid uuid;
BEGIN
  DELETE FROM public.user_achievements WHERE profile_id = _challenger;
  INSERT INTO public.challenges (id, title, description, created_by)
    VALUES (gen_random_uuid(), 'Reconcile challenge', 'test', _creator)
    RETURNING id INTO _cid;
  INSERT INTO public.challenge_participants (challenge_id, user_id)
    VALUES (_cid, _challenger) RETURNING id INTO _pid;

  -- 1. The challenger submits work with evidence (creator gate requires it).
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _challenger::text, 'role', 'authenticated')::text, true);
  UPDATE public.challenge_participants
    SET status = 'completed',
        submission_url = 'https://example.com/submission',
        submission_note = 'done',
        submitted_at = now(),
        review_status = 'submitted'
    WHERE id = _pid;

  -- 2. The challenge creator reviews it → 'passed' awards the badge.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _creator::text, 'role', 'authenticated')::text, true);
  UPDATE public.challenge_participants
    SET review_status = 'passed',
        reviewer_note = 'approved',
        reviewed_at = now()
    WHERE id = _pid;
  PERFORM set_config('role', 'postgres', true);

  IF NOT EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE profile_id = _challenger AND achievement = 'challenge_winner'
  ) THEN
    RAISE EXCEPTION 'challenge_winner not awarded on review pass';
  END IF;

  DELETE FROM public.challenge_participants WHERE id = _pid;

  IF EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE profile_id = _challenger AND achievement = 'challenge_winner'
  ) THEN
    RAISE EXCEPTION 'challenge_winner survived participant delete';
  END IF;
END $$;

SELECT ok(true, 'challenge participant delete revokes challenge_winner');

-- ---------------------------------------------------------------------------
-- 4. Deleting a project cleans up its orphaned page
-- ---------------------------------------------------------------------------
DO $$
DECLARE _u uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  _pid uuid;
  _page_id uuid;
BEGIN
  INSERT INTO public.projects (profile_id, title) VALUES (_u, 'Page cleanup test')
    RETURNING id INTO _pid;
  INSERT INTO public.pages (owner_id, owner_type, status)
    VALUES (_pid, 'project', 'draft') RETURNING id INTO _page_id;

  DELETE FROM public.projects WHERE id = _pid;

  IF EXISTS (SELECT 1 FROM public.pages WHERE id = _page_id) THEN
    RAISE EXCEPTION 'project page survived project delete';
  END IF;
END $$;

SELECT ok(true, 'project delete removes its page');

-- ---------------------------------------------------------------------------
-- 5. Grants: authenticated can run reconcile, anon/PUBLIC cannot
-- ---------------------------------------------------------------------------
SELECT is(
  has_function_privilege('authenticated', 'public.reconcile_user_achievements(uuid)', 'EXECUTE'),
  true,
  'authenticated can execute reconcile_user_achievements');
SELECT is(
  has_function_privilege('anon', 'public.reconcile_user_achievements(uuid)', 'EXECUTE'),
  false,
  'anon cannot execute reconcile_user_achievements');
SELECT is(
  has_function_privilege('public', 'public.reconcile_user_achievements(uuid)', 'EXECUTE'),
  false,
  'PUBLIC cannot execute reconcile_user_achievements');

SELECT * FROM finish();
ROLLBACK;