-- ============================================================================
-- Challenge resubmit notification
--
-- The existing notify_challenge_submitted trigger already fires when a
-- participant moves to review_status = 'submitted' — including on a resubmit
-- after rejection (rejected → submitted). This migration sharpens the message
-- so the creator knows a rejected participant has revised and resubmitted,
-- rather than reading the same "submitted their work" line twice.
--
-- Safe to re-run: CREATE OR REPLACE + guarded trigger recreation.
-- ============================================================================

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
  _is_resubmit boolean;
BEGIN
  IF NEW.review_status != 'submitted' OR OLD.review_status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- A resubmit is a transition from 'rejected' back to 'submitted'.
  -- ('none' is the initial state — the first submission is NOT a resubmit.)
  _is_resubmit := COALESCE(OLD.review_status = 'rejected', false);

  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id IS NULL OR _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    CASE WHEN _is_resubmit THEN 'challenge_resubmitted' ELSE 'challenge_submitted' END,
    CASE
      WHEN _is_resubmit
        THEN COALESCE(_actor_name, 'Someone') || ' resubmitted revised work for "' || _challenge_title || '" — review again'
      ELSE COALESCE(_actor_name, 'Someone') || ' submitted their work for "' || _challenge_title || '" — review it'
    END,
    CASE WHEN _is_resubmit THEN 'Their previous submission was sent back for revision.' END,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title, 'resubmit', _is_resubmit)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_submitted', 'challenge_participants',
  'notify_challenge_submitted', 'AFTER', 'UPDATE'
);

NOTIFY pgrst, 'reload schema';
