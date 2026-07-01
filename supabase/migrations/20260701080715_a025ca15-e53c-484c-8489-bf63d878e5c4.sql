
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS creator_title text,
  ADD COLUMN IF NOT EXISTS favourite_tools text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS software_stack text[] NOT NULL DEFAULT '{}';

-- 2. Wishlist skills ("Want Next")
CREATE TABLE IF NOT EXISTS public.profile_skills_wishlist (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);
GRANT SELECT, INSERT, DELETE ON public.profile_skills_wishlist TO authenticated;
GRANT ALL ON public.profile_skills_wishlist TO service_role;
ALTER TABLE public.profile_skills_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wishlist viewable by everyone" ON public.profile_skills_wishlist FOR SELECT USING (true);
CREATE POLICY "Users manage own wishlist insert" ON public.profile_skills_wishlist FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users manage own wishlist delete" ON public.profile_skills_wishlist FOR DELETE USING (auth.uid() = profile_id);

-- 3. Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  looking_for_feedback boolean NOT NULL DEFAULT false,
  looking_for_collaborators boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Users insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users update own projects" ON public.projects FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Users delete own projects" ON public.projects FOR DELETE USING (auth.uid() = profile_id);
CREATE TRIGGER projects_set_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS projects_profile_idx ON public.projects(profile_id, created_at DESC);

-- 4. Activity events
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity viewable by everyone" ON public.activity_events FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS activity_events_profile_idx ON public.activity_events(profile_id, created_at DESC);

-- 5. Activity logging helpers
CREATE OR REPLACE FUNCTION public.log_activity(_profile_id uuid, _kind text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_events (profile_id, kind, metadata)
  VALUES (_profile_id, _kind, COALESCE(_metadata, '{}'::jsonb));
END; $$;

-- Log skill add/remove
CREATE OR REPLACE FUNCTION public.trg_log_skill_teach()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT name INTO _name FROM public.skills WHERE id = NEW.skill_id;
  PERFORM public.log_activity(NEW.profile_id, 'skill_teach_added', jsonb_build_object('skill_id', NEW.skill_id, 'skill_name', _name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_log_skill_learn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT name INTO _name FROM public.skills WHERE id = NEW.skill_id;
  PERFORM public.log_activity(NEW.profile_id, 'skill_learning_started', jsonb_build_object('skill_id', NEW.skill_id, 'skill_name', _name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_log_skill_wishlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT name INTO _name FROM public.skills WHERE id = NEW.skill_id;
  PERFORM public.log_activity(NEW.profile_id, 'skill_wishlisted', jsonb_build_object('skill_id', NEW.skill_id, 'skill_name', _name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_log_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_activity(NEW.profile_id, 'project_published', jsonb_build_object('project_id', NEW.id, 'title', NEW.title));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_log_profile_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(NEW.id, 'joined_tethyr', '{}'::jsonb);
  ELSE
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url AND NEW.avatar_url IS NOT NULL THEN
      PERFORM public.log_activity(NEW.id, 'avatar_updated', '{}'::jsonb);
    END IF;
    IF NEW.banner_url IS DISTINCT FROM OLD.banner_url AND NEW.banner_url IS NOT NULL THEN
      PERFORM public.log_activity(NEW.id, 'banner_updated', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS log_teach_add ON public.profile_skills_teach;
CREATE TRIGGER log_teach_add AFTER INSERT ON public.profile_skills_teach FOR EACH ROW EXECUTE FUNCTION public.trg_log_skill_teach();

DROP TRIGGER IF EXISTS log_learn_add ON public.profile_skills_learn;
CREATE TRIGGER log_learn_add AFTER INSERT ON public.profile_skills_learn FOR EACH ROW EXECUTE FUNCTION public.trg_log_skill_learn();

DROP TRIGGER IF EXISTS log_wishlist_add ON public.profile_skills_wishlist;
CREATE TRIGGER log_wishlist_add AFTER INSERT ON public.profile_skills_wishlist FOR EACH ROW EXECUTE FUNCTION public.trg_log_skill_wishlist();

DROP TRIGGER IF EXISTS log_project_insert ON public.projects;
CREATE TRIGGER log_project_insert AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trg_log_project();

DROP TRIGGER IF EXISTS log_profile_upsert ON public.profiles;
CREATE TRIGGER log_profile_upsert AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_log_profile_change();
