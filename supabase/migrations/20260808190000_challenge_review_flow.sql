-- New badge awarded when a challenge submission passes creator review.
-- ADD VALUE cannot run inside a transaction block in older PG, so it is
-- wrapped in a DO block and guarded (idempotent).
DO $$ BEGIN
  ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'challenge_winner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- Challenge submission & review flow
--
-- Currently a participant can self-mark a challenge "completed" and instantly
-- earn +15 reputation (trg_reputation_challenge_completed) — no proof, no
-- review. This migration changes the loop to:
--
--   1. participant completes work → uploads a submission (file or link + note)
--      → review_status = 'submitted'
--   2. challenge creator reviews → passes (review_status = 'passed') or
--      rejects (review_status = 'rejected', participant can resubmit)
--   3. the badge + reputation are ONLY awarded on 'passed'
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Submission + review fields on challenge_participants
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS submission_url text,
  ADD COLUMN IF NOT EXISTS submission_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'none'
    CHECK (review_status IN ('none', 'submitted', 'passed', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewer_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Challenge creators can update participant rows to review submissions
-- (existing "Users update own participation" policy only covers the user).
DO $$ BEGIN
  CREATE POLICY "Challenge creators can review submissions"
    ON public.challenge_participants FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_participants.challenge_id
          AND c.created_by = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- 2. Reputation + badge gated on review pass (replaces the self-complete award)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_reputation_challenge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
BEGIN
  -- Only award when a review flips the row to 'passed'.
  IF NEW.review_status != 'passed' OR OLD.review_status = 'passed' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  PERFORM public.log_contribution(
    NEW.user_id,
    'challenges',
    'challenge_completed',
    15,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'title', _challenge_title)
  );

  -- Badge reward: a challenge passed under creator review.
  INSERT INTO public.user_achievements (profile_id, achievement)
  VALUES (NEW.user_id, 'challenge_winner')
  ON CONFLICT (profile_id, achievement) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Notifications for the full review loop
-- ---------------------------------------------------------------------------

-- Participant submits work → notify the creator to review.
CREATE OR REPLACE FUNCTION public.notify_challenge_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id uuid;
  _challenge_title text;
  _actor_name text;
BEGIN
  IF NEW.review_status != 'submitted' OR OLD.review_status = 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id IS NULL OR _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    'challenge_submitted',
    COALESCE(_actor_name, 'Someone') || ' submitted their work for "' || _challenge_title || '" — review it',
    NULL,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_submitted', 'challenge_participants',
  'notify_challenge_submitted', 'AFTER', 'UPDATE'
);

-- Creator passes / rejects → notify the participant of the outcome.
CREATE OR REPLACE FUNCTION public.notify_challenge_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
  _actor_name text;
BEGIN
  IF NEW.review_status NOT IN ('passed', 'rejected') OR OLD.review_status = NEW.review_status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.review_status = 'passed' THEN
    PERFORM public.insert_notification(
      NEW.user_id,
      NEW.user_id,
      'challenge_passed',
      'Your submission for "' || _challenge_title || '" passed review — badge earned!',
      COALESCE(NEW.reviewer_note, NULL),
      'challenge',
      NEW.challenge_id,
      jsonb_build_object('challenge_title', _challenge_title)
    );
  ELSE
    PERFORM public.insert_notification(
      NEW.user_id,
      NEW.user_id,
      'challenge_rejected',
      'Your submission for "' || _challenge_title || '" needs another pass',
      COALESCE(NEW.reviewer_note, NULL),
      'challenge',
      NEW.challenge_id,
      jsonb_build_object('challenge_title', _challenge_title)
    );
  END IF;

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_reviewed', 'challenge_participants',
  'notify_challenge_reviewed', 'AFTER', 'UPDATE'
);

-- ---------------------------------------------------------------------------
-- 4. challenge-submissions storage bucket (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('challenge-submissions', 'challenge-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Participants upload into their own folder; the challenge creator can read
-- (to review) via the path <challengeId>/<participantId>/<file>.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants upload submissions" ON storage.objects;
  CREATE POLICY "Challenge participants upload submissions"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'challenge-submissions'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants manage own submissions" ON storage.objects;
  CREATE POLICY "Challenge participants manage own submissions"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'challenge-submissions'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants delete own submissions" ON storage.objects;
  CREATE POLICY "Challenge participants delete own submissions"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'challenge-submissions'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Creator + participant can read: path is <userId>/<challengeId>/... so the
-- first folder identifies the participant; allow the challenge creator too.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants and creators read submissions" ON storage.objects;
  CREATE POLICY "Challenge participants and creators read submissions"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'challenge-submissions'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.challenge_participants cp
          JOIN public.challenges c ON c.id = cp.challenge_id
          WHERE cp.user_id::text = (storage.foldername(name))[1]
            AND c.created_by = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- service_role keeps full access (signed URLs are generated by the server).
GRANT ALL ON storage.objects TO service_role;
