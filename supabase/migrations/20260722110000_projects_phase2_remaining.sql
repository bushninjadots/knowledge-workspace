-- Phase 2 remaining steps: visual timeline stages, contributor scores,
-- role applications, and activity log for auto-publishing updates.
-- Safe to re-run: all CREATE statements use IF NOT EXISTS / IF EXISTS / DO blocks.

-- ============================================================
-- 1. Timeline stages (replaces/augments project_status)
-- ============================================================

-- The existing 'project_status' enum has: planning, active, paused, completed
-- We add a new enum for the 5-stage timeline from the roadmap
DO $$ BEGIN
  CREATE TYPE public.project_stage AS ENUM (
    'planning', 'building', 'testing', 'launch', 'growing'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage public.project_stage NOT NULL DEFAULT 'planning';

COMMENT ON COLUMN public.projects.stage IS 'Timeline stage: planning → building → testing → launch → growing';

CREATE INDEX IF NOT EXISTS projects_stage_idx ON public.projects (stage);

-- ============================================================
-- 2. Contributor scores + skills
-- ============================================================

ALTER TABLE public.project_contributors
  ADD COLUMN IF NOT EXISTS contribution_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skills_used text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.project_contributors.contribution_score IS 'Running score based on contributions (0–100)';
COMMENT ON COLUMN public.project_contributors.skills_used IS 'Skills this contributor has used in the project';

-- ============================================================
-- 3. Role applications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_role_applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      uuid NOT NULL REFERENCES public.project_open_roles(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, profile_id)
);

CREATE INDEX IF NOT EXISTS project_role_applications_role_idx ON public.project_role_applications (role_id, status);
CREATE INDEX IF NOT EXISTS project_role_applications_profile_idx ON public.project_role_applications (profile_id);

ALTER TABLE public.project_role_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Applications viewable by role owner and applicant"
    ON public.project_role_applications FOR SELECT
    USING (
      auth.uid() = profile_id
      OR EXISTS (
        SELECT 1 FROM public.project_open_roles por
        JOIN public.projects p ON p.id = por.project_id
        WHERE por.id = project_role_applications.role_id
          AND p.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can apply"
    ON public.project_role_applications FOR INSERT
    WITH CHECK (auth.uid() = profile_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owner can update application status"
    ON public.project_role_applications FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.project_open_roles por
        JOIN public.projects p ON p.id = por.project_id
        WHERE por.id = project_role_applications.role_id
          AND p.profile_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Applicant can withdraw own application"
    ON public.project_role_applications FOR DELETE
    USING (auth.uid() = profile_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS set_project_role_applications_updated_at ON public.project_role_applications;
CREATE TRIGGER set_project_role_applications_updated_at
  BEFORE UPDATE ON public.project_role_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN GRANT SELECT ON public.project_role_applications TO anon; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 4. Auto-increment contribution_score on updates and discussions
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_bump_contributor_score()
RETURNS trigger AS $$
BEGIN
  UPDATE public.project_contributors
  SET contribution_score = contribution_score + 1
  WHERE project_id = NEW.project_id
    AND profile_id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bump score when a contributor posts a project update
DROP TRIGGER IF EXISTS trg_bump_score_on_update ON public.project_updates;
CREATE TRIGGER trg_bump_score_on_update
  AFTER INSERT ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_contributor_score();

-- Bump score when a contributor starts a discussion
DROP TRIGGER IF EXISTS trg_bump_score_on_discussion ON public.project_discussions;
CREATE TRIGGER trg_bump_score_on_discussion
  AFTER INSERT ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_contributor_score();
