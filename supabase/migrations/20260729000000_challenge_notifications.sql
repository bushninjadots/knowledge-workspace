-- Challenge Notifications
-- Adds notification types and triggers for challenge join/complete events.

-- 1. Add new notification types to the enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'challenge_join';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'challenge_complete';

-- 2. Trigger: challenge join → notify creator
CREATE OR REPLACE FUNCTION public.notify_challenge_join()
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
  SELECT created_by, title INTO _creator_id, _challenge_title
  FROM public.challenges WHERE id = NEW.challenge_id;

  IF _creator_id = NEW.user_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    _creator_id,
    NEW.user_id,
    'challenge_join',
    COALESCE(_actor_name, 'Someone') || ' joined your challenge "' || _challenge_title || '"',
    NULL,
    'challenge',
    NEW.challenge_id,
    jsonb_build_object('challenge_title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_join', 'challenge_participants',
  'notify_challenge_join', 'AFTER', 'INSERT'
);

-- 3. Trigger: challenge complete → notify creator
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
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

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

SELECT public._create_trigger_if_table_exists(
  'notify_on_challenge_complete', 'challenge_participants',
  'notify_challenge_complete', 'AFTER', 'UPDATE'
);
