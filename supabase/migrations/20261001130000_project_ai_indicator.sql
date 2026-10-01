-- AI-creation indicator — owner self-report + community tagging.
--
-- Projects can be marked as AI-assisted two ways:
--  1. Owner self-report: the project owner toggles `ai_assisted` in the edit
--     dialog. This is the authoritative signal.
--  2. Community tagging: any signed-in user can tag a project as AI-assisted.
--     When enough community members agree (default threshold 3), the badge
--     shows even without the owner's self-report.
--
-- The two signals are deliberately separate: the owner's word is trusted, but
-- the community tag is a count that must reach a threshold before it surfaces
-- publicly. This prevents a single bad-faith tag from marking someone's work.

-- 1. Owner self-report column on projects.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ai_assisted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.ai_assisted IS 'Owner self-report: whether this project was built with significant AI assistance.';

-- 2. Community AI tags — one row per (project, user). A user can tag or
--    untag, but never twice on the same project.
CREATE TABLE IF NOT EXISTS public.project_ai_tags (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tagger_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, tagger_id)
);

-- RLS: signed-in users can insert/delete their own tag; anyone can read the
-- count (the badge needs it to render).
ALTER TABLE public.project_ai_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_ai_tags_read
  ON public.project_ai_tags FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY project_ai_tags_insert_own
  ON public.project_ai_tags FOR INSERT
  TO authenticated
  WITH CHECK (tagger_id = auth.uid());

CREATE POLICY project_ai_tags_delete_own
  ON public.project_ai_tags FOR DELETE
  TO authenticated
  USING (tagger_id = auth.uid());

-- 3. project_ai_tag_count — SECURITY INVOKER count so the caller's RLS is
--    respected (though the read policy is already open). SECURITY DEFINER is
--    not needed here: the table is publicly readable, and the count is
--    deliberately global (the badge threshold must hold for all viewers).
CREATE OR REPLACE FUNCTION public.project_ai_tag_count(p_project_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.project_ai_tags WHERE project_id = p_project_id;
$$;

COMMENT ON FUNCTION public.project_ai_tag_count IS 'Count of community AI-assisted tags for a project.';

-- The function is a plain SELECT wrapper — anon can call it (the table is
-- publicly readable anyway), and it carries no privileged logic.
REVOKE ALL ON FUNCTION public.project_ai_tag_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_ai_tag_count(uuid) TO anon, authenticated;

-- 4. project_ai_has_user_taged — lets the UI show whether the current user has
--    already tagged a project (so the button can toggle). SECURITY INVOKER so
--    auth.uid() is available.
CREATE OR REPLACE FUNCTION public.project_ai_user_tagged(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_ai_tags
    WHERE project_id = p_project_id AND tagger_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.project_ai_user_tagged IS 'Whether the current user has tagged a project as AI-assisted.';

REVOKE ALL ON FUNCTION public.project_ai_user_tagged(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.project_ai_user_tagged(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
