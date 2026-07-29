-- Challenge Reputation
-- Awards reputation points when a challenge is completed.

CREATE OR REPLACE FUNCTION public.trg_reputation_challenge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge_title text;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;

  PERFORM public.log_contribution(
    NEW.user_id,
    'challenges',
    'challenge_completed',
    15,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'title', _challenge_title)
  );

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'trg_reputation_challenge_completed', 'challenge_participants',
  'trg_reputation_challenge_completed', 'AFTER', 'UPDATE'
);
