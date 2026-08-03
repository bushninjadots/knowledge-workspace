-- ============================================================
-- Project stage + contributor scores
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.project_stage AS ENUM ('planning','building','testing','launch','growing');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage public.project_stage NOT NULL DEFAULT 'planning';
CREATE INDEX IF NOT EXISTS projects_stage_idx ON public.projects (stage);

ALTER TABLE public.project_contributors
  ADD COLUMN IF NOT EXISTS contribution_score smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skills_used text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- Role applications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_role_applications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id      uuid NOT NULL REFERENCES public.project_open_roles(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message      text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_role_applications TO authenticated;
GRANT ALL ON public.project_role_applications TO service_role;
CREATE INDEX IF NOT EXISTS project_role_applications_role_idx ON public.project_role_applications (role_id, status);
CREATE INDEX IF NOT EXISTS project_role_applications_profile_idx ON public.project_role_applications (profile_id);
ALTER TABLE public.project_role_applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Applications viewable by role owner and applicant"
  ON public.project_role_applications FOR SELECT
  USING (auth.uid() = profile_id OR EXISTS (
    SELECT 1 FROM public.project_open_roles por
    JOIN public.projects p ON p.id = por.project_id
    WHERE por.id = project_role_applications.role_id AND p.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can apply"
  ON public.project_role_applications FOR INSERT WITH CHECK (auth.uid() = profile_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can update application status"
  ON public.project_role_applications FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_open_roles por
    JOIN public.projects p ON p.id = por.project_id
    WHERE por.id = project_role_applications.role_id AND p.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Applicant can withdraw own application"
  ON public.project_role_applications FOR DELETE USING (auth.uid() = profile_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS set_project_role_applications_updated_at ON public.project_role_applications;
CREATE TRIGGER set_project_role_applications_updated_at
  BEFORE UPDATE ON public.project_role_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.trg_bump_contributor_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_contributors
  SET contribution_score = contribution_score + 1
  WHERE project_id = NEW.project_id AND profile_id = NEW.author_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_score_on_update ON public.project_updates;
CREATE TRIGGER trg_bump_score_on_update AFTER INSERT ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_contributor_score();
DROP TRIGGER IF EXISTS trg_bump_score_on_discussion ON public.project_discussions;
CREATE TRIGGER trg_bump_score_on_discussion AFTER INSERT ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_contributor_score();

-- ============================================================
-- Availability
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM ('available','busy','learning','looking_for_team','mentoring');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability public.availability_status;
CREATE INDEX IF NOT EXISTS idx_profile_skills_teach_skill ON public.profile_skills_teach (skill_id);
CREATE INDEX IF NOT EXISTS idx_profile_skills_learn_skill ON public.profile_skills_learn (skill_id);
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON public.profiles (availability) WHERE availability IS NOT NULL;

-- ============================================================
-- Reputation
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles (reputation_score DESC);

DO $$ BEGIN
  CREATE TYPE public.achievement_type AS ENUM (
    'first_project','first_milestone','first_endorsement','five_endorsements','ten_endorsements',
    'community_recognized','mentor','collaborator','prolific_teacher','project_builder',
    'community_builder','reliable_collaborator','helped_ten_people','learner_journey'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement public.achievement_type NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, achievement)
);
GRANT SELECT ON public.user_achievements TO authenticated, anon;
GRANT ALL ON public.user_achievements TO service_role;
CREATE INDEX IF NOT EXISTS idx_user_achievements_profile ON public.user_achievements (profile_id, awarded_at DESC);
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Achievements viewable by everyone" ON public.user_achievements FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.contribution_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    text NOT NULL,
  action      text NOT NULL,
  points      integer NOT NULL DEFAULT 0,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contribution_log TO authenticated, anon;
GRANT ALL ON public.contribution_log TO service_role;
CREATE INDEX IF NOT EXISTS idx_contribution_log_profile ON public.contribution_log (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_log_category ON public.contribution_log (category);
ALTER TABLE public.contribution_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Contribution log viewable by everyone" ON public.contribution_log FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.log_contribution(
  p_profile_id uuid, p_category text, p_action text, p_points integer, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.contribution_log (profile_id, category, action, points, metadata)
  VALUES (p_profile_id, p_category, p_action, p_points, p_metadata);
  UPDATE public.profiles SET reputation_score = reputation_score + p_points WHERE id = p_profile_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_contribution(uuid, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_reputation_project_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_contribution(NEW.profile_id,'project_impact','project_published',10,
    jsonb_build_object('project_id', NEW.id, 'title', NEW.title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_project_published ON public.projects;
CREATE TRIGGER trg_reputation_project_published AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_project_published();

CREATE OR REPLACE FUNCTION public.trg_reputation_project_joined()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role <> 'creator' THEN
    PERFORM public.log_contribution(NEW.profile_id,'collaboration','project_joined',5,
      jsonb_build_object('project_id', NEW.project_id));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_project_joined ON public.project_contributors;
CREATE TRIGGER trg_reputation_project_joined AFTER INSERT ON public.project_contributors
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_project_joined();

CREATE OR REPLACE FUNCTION public.trg_reputation_endorsement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_contribution(NEW.profile_id,'teaching','endorsement_received',2,
    jsonb_build_object('skill_id', NEW.skill_id, 'endorsed_by', NEW.endorsed_by));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_endorsement ON public.skill_endorsements;
CREATE TRIGGER trg_reputation_endorsement AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_endorsement();

CREATE OR REPLACE FUNCTION public.trg_reputation_project_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_contribution(NEW.author_id,'project_impact','project_update_posted',3,
    jsonb_build_object('project_id', NEW.project_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_project_update ON public.project_updates;
CREATE TRIGGER trg_reputation_project_update AFTER INSERT ON public.project_updates
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_project_update();

CREATE OR REPLACE FUNCTION public.trg_reputation_community_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_contribution(NEW.author_id,'community','community_post_created',2,
    jsonb_build_object('post_id', NEW.id, 'post_type', NEW.type::text));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_community_post ON public.posts;
CREATE TRIGGER trg_reputation_community_post AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_community_post();

CREATE OR REPLACE FUNCTION public.trg_reputation_community_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_contribution(NEW.author_id,'community','community_comment_created',1,
    jsonb_build_object('comment_id', NEW.id, 'post_id', NEW.post_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_community_comment ON public.comments;
CREATE TRIGGER trg_reputation_community_comment AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_community_comment();

CREATE OR REPLACE FUNCTION public.trg_reputation_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status <> 'done') THEN
    SELECT p.profile_id INTO _owner FROM public.projects p WHERE p.id = NEW.project_id;
    IF _owner IS NOT NULL THEN
      PERFORM public.log_contribution(_owner,'project_impact','milestone_completed',5,
        jsonb_build_object('project_id', NEW.project_id, 'milestone_title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_milestone ON public.project_milestones;
CREATE TRIGGER trg_reputation_milestone AFTER UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_milestone();

NOTIFY pgrst, 'reload schema';