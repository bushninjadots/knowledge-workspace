-- ============================================================================
-- Close the private-project privacy gap.
--
-- The projects row itself is visibility-gated (see 20260808160000), but the
-- child tables (milestones, updates, discussions, replies, open roles,
-- activity) still had blanket `FOR SELECT USING (true)` policies — so anyone
-- could read a private project's content by querying those tables directly.
--
-- This replaces those policies with visibility-aware ones via a shared helper:
--   * public projects → visible to everyone (signed-out included)
--   * private projects → visible only to the owner + contributors
--
-- The sweep drops EVERY SELECT policy on the gated tables (not just the known
-- names) because Postgres ORs policies together — a single surviving
-- `USING (true)` policy would keep private content world-readable while
-- everything looks correct.
-- ============================================================================

-- Shared predicate: can the current user see this project?
CREATE OR REPLACE FUNCTION public.is_project_visible(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.visibility = 'public'
        OR p.profile_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_contributors pc
          WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_visible(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Defensive sweep: drop all SELECT policies on the gated child tables so no
-- stale public-read policy can survive under any name.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND tablename IN (
        'project_milestones', 'project_updates', 'project_discussions',
        'discussion_replies', 'project_open_roles', 'project_activity'
      )
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Project milestones
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Milestones viewable by everyone"
    ON public.project_milestones FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Project weekly updates
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Updates viewable by everyone"
    ON public.project_updates FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Project discussions
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Discussions viewable by everyone"
    ON public.project_discussions FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Discussion replies (join through the discussion → project)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Replies viewable by everyone"
    ON public.discussion_replies FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.project_discussions pd
        WHERE pd.id = discussion_replies.discussion_id
          AND public.is_project_visible(pd.project_id)
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Project open roles
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Open roles viewable by everyone"
    ON public.project_open_roles FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Project activity feed
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Project activity is publicly readable"
    ON public.project_activity FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- RLS hardening: activity_events must only be written by SECURITY DEFINER
-- helpers (log_activity + triggers). The app never inserts directly (no
-- client code does), so drop the self-insert policy — and the now-dead
-- INSERT grant — that let users fabricate their own activity feed.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner can insert own activity" ON public.activity_events;
END $$;

REVOKE INSERT ON public.activity_events FROM authenticated;
