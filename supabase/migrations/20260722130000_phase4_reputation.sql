-- Phase 4 — Reputation system.
-- Adds reputation_score to profiles, creates achievements + contribution_log tables.

-- ============================================================
-- 1. Reputation score on profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles (reputation_score DESC);

COMMENT ON COLUMN public.profiles.reputation_score IS 'Aggregate reputation score, computed from actions across the platform.';

-- ============================================================
-- 2. Achievements — auto-awarded badges
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.achievement_type AS ENUM (
    'first_project',
    'first_milestone',
    'first_endorsement',
    'five_endorsements',
    'ten_endorsements',
    'community_recognized',
    'mentor',
    'collaborator',
    'prolific_teacher',
    'project_builder',
    'community_builder',
    'reliable_collaborator',
    'helped_ten_people',
    'learner_journey'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement public.achievement_type NOT NULL,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, achievement)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_profile ON public.user_achievements (profile_id, awarded_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

CREATE POLICY "System can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 3. Contribution log — unified timeline of reputation-eligible events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contribution_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category    text NOT NULL,  -- collaboration, teaching, learning, reliability, community, project_impact
  action      text NOT NULL,  -- project_joined, milestone_completed, endorsement_received, etc.
  points      integer NOT NULL DEFAULT 0,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_log_profile ON public.contribution_log (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_log_category ON public.contribution_log (category);

ALTER TABLE public.contribution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contribution log viewable by everyone"
  ON public.contribution_log FOR SELECT
  USING (true);

CREATE POLICY "System can insert contributions"
  ON public.contribution_log FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 4. Trigger functions for automatic reputation updates
-- ============================================================

-- Helper: add points to contribution_log and bump reputation_score
CREATE OR REPLACE FUNCTION public.log_contribution(
  p_profile_id uuid,
  p_category text,
  p_action text,
  p_points integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contribution_log (profile_id, category, action, points, metadata)
  VALUES (p_profile_id, p_category, p_action, p_points, p_metadata);

  UPDATE public.profiles
  SET reputation_score = reputation_score + p_points
  WHERE id = p_profile_id;
END;
$$;

-- Trigger functions are created unconditionally (they're just PL/pgSQL).
-- Triggers are attached only if the target table exists, so this migration
-- is safe to run even if earlier migrations haven't been applied yet.

-- Helper: conditionally create a trigger only if the table exists
CREATE OR REPLACE FUNCTION public._create_trigger_if_table_exists(
  p_trigger_name text,
  p_table_name text,
  p_function_name text,
  p_timing text DEFAULT 'AFTER',
  p_event text DEFAULT 'INSERT',
  p_level text DEFAULT 'FOR EACH ROW'
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table_name
  ) THEN
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      p_trigger_name, p_table_name
    );
    EXECUTE format(
      'CREATE TRIGGER %I %s %s ON public.%I %s EXECUTE FUNCTION %I()',
      p_trigger_name, p_timing, p_event, p_table_name, p_level, p_function_name
    );
  END IF;
END;
$$;

-- Trigger: project published → +10 points
CREATE OR REPLACE FUNCTION public.trg_reputation_project_published()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  PERFORM public.log_contribution(
    NEW.profile_id,
    'project_impact',
    'project_published',
    10,
    jsonb_build_object('project_id', NEW.id, 'title', NEW.title)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_project_published', 'projects',
  'trg_reputation_project_published', 'AFTER', 'INSERT'
);

-- Trigger: project joined (non-creator) → +5 points
CREATE OR REPLACE FUNCTION public.trg_reputation_project_joined()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  IF NEW.role <> 'creator' THEN
    PERFORM public.log_contribution(
      NEW.profile_id,
      'collaboration',
      'project_joined',
      5,
      jsonb_build_object('project_id', NEW.project_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_project_joined', 'project_contributors',
  'trg_reputation_project_joined', 'AFTER', 'INSERT'
);

-- Trigger: endorsement received → +2 points per endorsement
CREATE OR REPLACE FUNCTION public.trg_reputation_endorsement()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  PERFORM public.log_contribution(
    NEW.profile_id,
    'teaching',
    'endorsement_received',
    2,
    jsonb_build_object('skill_id', NEW.skill_id, 'endorsed_by', NEW.endorsed_by)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_endorsement', 'skill_endorsements',
  'trg_reputation_endorsement', 'AFTER', 'INSERT'
);

-- Trigger: project update posted → +3 points
CREATE OR REPLACE FUNCTION public.trg_reputation_project_update()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  PERFORM public.log_contribution(
    NEW.author_id,
    'project_impact',
    'project_update_posted',
    3,
    jsonb_build_object('project_id', NEW.project_id)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_project_update', 'project_updates',
  'trg_reputation_project_update', 'AFTER', 'INSERT'
);

-- Trigger: community post created → +2 points
CREATE OR REPLACE FUNCTION public.trg_reputation_community_post()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'post' THEN
    PERFORM public.log_contribution(
      NEW.author_id,
      'community',
      'community_post_created',
      2,
      jsonb_build_object('post_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_community_post', 'posts',
  'trg_reputation_community_post', 'AFTER', 'INSERT'
);

-- Trigger: community comment created → +1 point
CREATE OR REPLACE FUNCTION public.trg_reputation_community_comment()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  PERFORM public.log_contribution(
    NEW.author_id,
    'community',
    'community_comment_created',
    1,
    jsonb_build_object('comment_id', NEW.id, 'post_id', NEW.post_id)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_community_comment', 'comments',
  'trg_reputation_community_comment', 'AFTER', 'INSERT'
);

-- Trigger: milestone completed → +5 points
CREATE OR REPLACE FUNCTION public.trg_reputation_milestone()
RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM public.log_contribution(
      NEW.completed_by,
      'project_impact',
      'milestone_completed',
      5,
      jsonb_build_object('project_id', NEW.project_id, 'milestone_title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_milestone', 'project_milestones',
  'trg_reputation_milestone', 'AFTER', 'UPDATE'
);
