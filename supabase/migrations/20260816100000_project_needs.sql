-- ============================================================================
-- Project "need help now" — a lightweight, urgent collaboration ask.
--
-- Distinct from project_open_roles: a role is a formal, application-backed
-- position; a need is a short, time-sensitive "we need X this week" signal
-- that sits at the top of the project and feeds discovery.
--
-- Visibility follows the private-project rules from 20260808170000: public
-- projects' needs are world-readable; private projects' needs are visible only
-- to the owner + contributors.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_needs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  note        text,
  skill_id    uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  urgency     text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  is_filled   boolean NOT NULL DEFAULT false,
  filled_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_needs_project_idx
  ON public.project_needs (project_id, is_filled, created_at DESC);

CREATE INDEX IF NOT EXISTS project_needs_open_idx
  ON public.project_needs (is_filled, urgency, created_at DESC);

CREATE INDEX IF NOT EXISTS project_needs_skill_idx
  ON public.project_needs (skill_id, is_filled);

ALTER TABLE public.project_needs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- SELECT: everyone can see needs on visible projects.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Needs viewable on visible projects"
    ON public.project_needs FOR SELECT
    USING (public.is_project_visible(project_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Owner + contributors can add, update, and delete needs.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Project members can manage needs"
    ON public.project_needs FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_needs.project_id
          AND (
            p.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.project_contributors pc
              WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
            )
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_needs.project_id
          AND (
            p.profile_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.project_contributors pc
              WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  GRANT SELECT ON public.project_needs TO anon;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_needs TO authenticated;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Activity: record when a need is filled (mirrors trg_project_activity_role_filled).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_project_need_filled_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_filled AND (OLD.is_filled IS DISTINCT FROM TRUE) THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id,
      NEW.filled_by,
      'need_filled',
      'Filled a need: ' || NEW.title,
      NULL,
      jsonb_build_object('need_id', NEW.id, 'title', NEW.title, 'filled_by', NEW.filled_by),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_activity_need_filled ON public.project_needs;
CREATE TRIGGER trg_project_activity_need_filled
AFTER UPDATE ON public.project_needs
FOR EACH ROW
EXECUTE FUNCTION public.record_project_need_filled_activity();
