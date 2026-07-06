-- Projects Phase 1: turn "projects" from a portfolio card into a workspace.
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'paused', 'completed');

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS status public.project_status NOT NULL DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS progress_percent smallint NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_progress_percent_range CHECK (progress_percent BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);
GRANT SELECT ON public.projects TO anon;

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
CREATE POLICY "Owner or self can remove contributor" ON public.project_contributors
  FOR DELETE USING (
    (profile_id = auth.uid() AND role <> 'creator')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS project_contributors_profile_idx ON public.project_contributors(profile_id);

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

INSERT INTO public.project_contributors (project_id, profile_id, role)
SELECT id, profile_id, 'creator' FROM public.projects
ON CONFLICT (project_id, profile_id) DO NOTHING;

DROP POLICY IF EXISTS "Project media readable to authenticated" ON storage.objects;
CREATE POLICY "Project media is publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'project-media');

-- Skill verification tiers
CREATE TYPE public.skill_verification_level AS ENUM (
  'self_declared',
  'proof_certified',
  'community_recognized'
);

ALTER TABLE public.profile_skills_teach
  ADD COLUMN IF NOT EXISTS verification_level public.skill_verification_level
    NOT NULL DEFAULT 'self_declared',
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS proof_note text;

GRANT UPDATE ON public.profile_skills_teach TO authenticated;
CREATE POLICY "Users manage own teach skills update" ON public.profile_skills_teach
  FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE TABLE IF NOT EXISTS public.skill_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  endorsed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_endorsements_no_self_endorse CHECK (endorsed_by <> profile_id),
  CONSTRAINT skill_endorsements_unique UNIQUE (profile_id, skill_id, endorsed_by)
);
GRANT SELECT ON public.skill_endorsements TO anon;
GRANT SELECT, INSERT, DELETE ON public.skill_endorsements TO authenticated;
GRANT ALL ON public.skill_endorsements TO service_role;
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endorsements viewable by everyone" ON public.skill_endorsements
  FOR SELECT USING (true);
CREATE POLICY "Anyone but the owner can endorse" ON public.skill_endorsements
  FOR INSERT WITH CHECK (endorsed_by = auth.uid() AND endorsed_by <> profile_id);
CREATE POLICY "Only the endorser can retract" ON public.skill_endorsements
  FOR DELETE USING (endorsed_by = auth.uid());

CREATE INDEX IF NOT EXISTS skill_endorsements_lookup_idx
  ON public.skill_endorsements(profile_id, skill_id);

CREATE OR REPLACE FUNCTION public.trg_endorsement_upgrade_level()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.skill_endorsements
    WHERE profile_id = NEW.profile_id AND skill_id = NEW.skill_id;
  IF _count >= 3 THEN
    UPDATE public.profile_skills_teach
      SET verification_level = 'community_recognized'
      WHERE profile_id = NEW.profile_id
        AND skill_id = NEW.skill_id
        AND verification_level <> 'community_recognized';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS endorsement_upgrade_level ON public.skill_endorsements;
CREATE TRIGGER endorsement_upgrade_level AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.trg_endorsement_upgrade_level();