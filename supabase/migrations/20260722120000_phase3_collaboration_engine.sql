-- Phase 3 — Collaboration Engine: availability status, skill matching support.

-- ============================================================
-- 1. Availability status enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM (
    'available', 'busy', 'learning', 'looking_for_team', 'mentoring'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS availability public.availability_status;

COMMENT ON COLUMN public.profiles.availability IS 'Current availability: available, busy, learning, looking_for_team, mentoring';

-- ============================================================
-- 2. Index for skill matching queries
-- ============================================================

-- Speed up queries that join teach skills with learn skills across profiles
CREATE INDEX IF NOT EXISTS idx_profile_skills_teach_skill ON public.profile_skills_teach (skill_id);
CREATE INDEX IF NOT EXISTS idx_profile_skills_learn_skill ON public.profile_skills_learn (skill_id);
CREATE INDEX IF NOT EXISTS idx_profiles_availability ON public.profiles (availability) WHERE availability IS NOT NULL;
