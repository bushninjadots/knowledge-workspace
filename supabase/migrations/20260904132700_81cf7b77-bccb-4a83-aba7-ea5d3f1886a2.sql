DO $$ BEGIN
  ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'challenge_winner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS submission_url text,
  ADD COLUMN IF NOT EXISTS submission_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'none'
    CHECK (review_status IN ('none', 'submitted', 'passed', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewer_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

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

CREATE OR REPLACE FUNCTION public.trg_reputation_challenge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
BEGIN
  IF NEW.review_status != 'passed' OR OLD.review_status = 'passed' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  PERFORM public.log_contribution(
    NEW.user_id, 'challenges', 'challenge_completed', 15,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'title', _challenge_title)
  );

  INSERT INTO public.user_achievements (profile_id, achievement)
  VALUES (NEW.user_id, 'challenge_winner')
  ON CONFLICT (profile_id, achievement) DO NOTHING;

  RETURN NEW;
END;
$$;

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
    _creator_id, NEW.user_id, 'challenge_submitted',
    COALESCE(_actor_name, 'Someone') || ' submitted their work for "' || _challenge_title || '" — review it',
    NULL, 'challenge', NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_challenge_submitted ON public.challenge_participants;
CREATE TRIGGER notify_on_challenge_submitted
  AFTER UPDATE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_submitted();

CREATE OR REPLACE FUNCTION public.notify_challenge_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
BEGIN
  IF NEW.review_status NOT IN ('passed', 'rejected') OR OLD.review_status = NEW.review_status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  IF NEW.review_status = 'passed' THEN
    PERFORM public.insert_notification(
      NEW.user_id, NEW.user_id, 'challenge_passed',
      'Your submission for "' || _challenge_title || '" passed review — badge earned!',
      NEW.reviewer_note, 'challenge', NEW.challenge_id,
      jsonb_build_object('challenge_title', _challenge_title)
    );
  ELSE
    PERFORM public.insert_notification(
      NEW.user_id, NEW.user_id, 'challenge_rejected',
      'Your submission for "' || _challenge_title || '" needs another pass',
      NEW.reviewer_note, 'challenge', NEW.challenge_id,
      jsonb_build_object('challenge_title', _challenge_title)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_challenge_reviewed ON public.challenge_participants;
CREATE TRIGGER notify_on_challenge_reviewed
  AFTER UPDATE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_reviewed();

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'html'
    CHECK (content_format IN ('html', 'markdown')),
  ADD COLUMN IF NOT EXISTS github_source jsonb;

CREATE INDEX IF NOT EXISTS idx_library_items_project ON public.library_items(project_id);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_project ON public.messages(project_id);

ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_milestones_completed_idx
  ON public.project_milestones (project_id, completed_by);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{"mutedCategories": []}'::jsonb;

COMMENT ON COLUMN public.profiles.notification_preferences IS
  'Per-category notification preferences ({ mutedCategories: NotificationCategory[] }).';

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tools text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';