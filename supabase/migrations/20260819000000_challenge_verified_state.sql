-- Challenge completion notifications should only fire once the submission is
-- actually verified, not when a participant self-marks "completed".
--
-- The earlier notify_challenge_complete trigger fired on status -> 'completed'
-- (which happens the moment a participant submits or self-marks), so the
-- creator got a "completed" notification before verifying anything. The
-- reputation + badge are already gated on review_status = 'passed'; this makes
-- the notification match: a challenge is only "completed" once it's verified.

CREATE OR REPLACE FUNCTION public.notify_challenge_complete()
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
  -- Only notify when a review flips the row to 'passed' (verified).
  IF NEW.review_status != 'passed' OR OLD.review_status = 'passed' THEN
    RETURN NEW;
  END IF;

  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    'challenge_complete',
    COALESCE(_actor_name, 'Someone') || ' completed your challenge "' || _challenge_title || '"',
    NULL,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;
