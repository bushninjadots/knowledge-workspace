-- Projects Phase 1: turn "projects" from a portfolio card into a workspace.
-- Adds goal/status/progress to projects, a contributors table (creator +
-- collaborators), and a project_skills junction so a project's skills are
-- real catalog rows instead of free-text tags. Journal, milestones,
-- resources and discussion are later phases and are NOT part of this file.

-- 1. Project status + new workspace fields on projects
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'paused', 'completed');

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS status public.project_status NOT NULL DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS progress_percent smallint NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_progress_percent_range CHECK (progress_percent BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);

-- projects was missing an anon grant despite its "viewable by everyone" RLS
-- policy — PostgREST needs both. Fixing so signed-out visitors can load a
-- project page, matching how public profiles already work.
GRANT SELECT ON public.projects TO anon;

-- 2. Contributors — the creator is always a row here so "Creator" and
-- "Contributors" can be read from one table.
CREATE TYPE public.project_contributor_role AS ENUM ('creator', 'contributor', 'mentor');

CREATE TABLE IF NOT EXISTS public.project_contributors (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.project_contributor_role NOT NULL DEFAULT 'contributor',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);
GRANT SELECT ON public.project_contributors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_contributors TO authenticated;
GRANT ALL ON public.project_contributors TO service_role;
ALTER TABLE public.project_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contributors viewable by everyone" ON public.project_contributors
  FOR SELECT USING (true);

-- A person can add themself (e.g. a future "Join project" action), and a
-- project owner can add anyone — covers both self-join and owner-invites
-- without needing a separate invitations table yet.
CREATE POLICY "Owner or self can add contributor" ON public.project_contributors
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

CREATE POLICY "Owner can change contributor roles" ON public.project_contributors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

-- A contributor can remove themself (leave); the owner can remove anyone.
-- The owner's own "creator" row can only be removed by deleting the project.
CREATE POLICY "Owner or self can remove contributor" ON public.project_contributors
  FOR DELETE USING (
    (profile_id = auth.uid() AND role <> 'creator')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS project_contributors_profile_idx ON public.project_contributors(profile_id);

-- Every new project automatically gets a "creator" contributor row.
CREATE OR REPLACE FUNCTION public.trg_project_add_creator_contributor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_contributors (project_id, profile_id, role)
  VALUES (NEW.id, NEW.profile_id, 'creator')
  ON CONFLICT (project_id, profile_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS project_creator_contributor ON public.projects;
CREATE TRIGGER project_creator_contributor AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_project_add_creator_contributor();

-- Log activity when someone other than the creator joins a project.
CREATE OR REPLACE FUNCTION public.trg_log_project_contributor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text;
BEGIN
  IF NEW.role <> 'creator' THEN
    SELECT title INTO _title FROM public.projects WHERE id = NEW.project_id;
    PERFORM public.log_activity(NEW.profile_id, 'project_joined',
      jsonb_build_object('project_id', NEW.project_id, 'title', _title));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS log_project_contributor_add ON public.project_contributors;
CREATE TRIGGER log_project_contributor_add AFTER INSERT ON public.project_contributors
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_project_contributor();

-- 3. Project skills — a real junction to the skills catalog, replacing
-- free-text tags as the source of "skills involved" so projects can later
-- feed skill matching / learning recommendations.
CREATE TABLE IF NOT EXISTS public.project_skills (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, skill_id)
);
GRANT SELECT ON public.project_skills TO anon;
GRANT SELECT, INSERT, DELETE ON public.project_skills TO authenticated;
GRANT ALL ON public.project_skills TO service_role;
ALTER TABLE public.project_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project skills viewable by everyone" ON public.project_skills
  FOR SELECT USING (true);
CREATE POLICY "Project owner manages project skills insert" ON public.project_skills
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );
CREATE POLICY "Project owner manages project skills delete" ON public.project_skills
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS project_skills_skill_idx ON public.project_skills(skill_id);

-- 4. Backfill: every existing project gets its creator as a contributor row.
INSERT INTO public.project_contributors (project_id, profile_id, role)
SELECT id, profile_id, 'creator' FROM public.projects
ON CONFLICT (project_id, profile_id) DO NOTHING;

-- 5. project-media was readable to `authenticated` only, same oversight the
-- avatars/banners buckets had before 20260703104407 fixed it. Projects now
-- get their own public page (like /u/:handle), so signed-out visitors need
-- to be able to load cover images too. Writes stay owner-only.
DROP POLICY IF EXISTS "Project media readable to authenticated" ON storage.objects;
CREATE POLICY "Project media is publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'project-media');
