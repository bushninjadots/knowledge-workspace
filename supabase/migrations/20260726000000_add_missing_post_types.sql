-- Add missing post_type enum values for lesson_learned, feedback_request, open_role
-- These types exist in the frontend QUICK_ACTIONS but were missing from the DB enum,
-- causing "invalid input value for enum post_type" errors on submit.

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'lesson_learned';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'feedback_request';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'open_role';
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';
