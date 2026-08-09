-- Harden challenge review transitions.
--
-- RLS needs to allow participants to update their own progress/submission and
-- challenge creators to review submissions. A broad UPDATE policy alone cannot
-- express that column-level distinction, so enforce the transition contract in
-- SECURITY DEFINER triggers.

CREATE OR REPLACE FUNCTION public.enforce_challenge_review_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id uuid;
  _is_creator boolean;
  _review_fields_changed boolean;
  _participant_fields_changed boolean;
  _is_resubmission boolean;
BEGIN
  SELECT created_by
    INTO _creator_id
  FROM public.challenges
  WHERE id = NEW.challenge_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'none'
       OR NEW.reviewer_note IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Challenge reviews can only be created by the challenge creator';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.challenge_id IS DISTINCT FROM NEW.challenge_id
     OR OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Challenge participant identity cannot be changed';
  END IF;

  _is_creator := auth.uid() = _creator_id;
  _review_fields_changed :=
    OLD.review_status IS DISTINCT FROM NEW.review_status
    OR OLD.reviewer_note IS DISTINCT FROM NEW.reviewer_note
    OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at;
  _participant_fields_changed :=
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.progress IS DISTINCT FROM NEW.progress
    OR OLD.submission_url IS DISTINCT FROM NEW.submission_url
    OR OLD.submission_note IS DISTINCT FROM NEW.submission_note
    OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at;
  _is_resubmission := OLD.review_status = 'rejected' AND NEW.review_status = 'submitted';

  IF _is_creator AND NEW.user_id <> auth.uid() THEN
    -- A creator may review another participant, but may not rewrite the
    -- participant's work or award a review outside the submitted state.
    IF _participant_fields_changed
       OR OLD.review_status <> 'submitted'
       OR NEW.review_status NOT IN ('passed', 'rejected') THEN
      RAISE EXCEPTION 'Challenge creators may only review submitted participants';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() = NEW.user_id THEN
    -- A submitted row must always point to actual evidence. This also blocks
    -- a participant from clearing evidence while leaving the row submitted.
    IF NEW.review_status = 'submitted'
       AND (NEW.status <> 'completed'
         OR NEW.submission_url IS NULL
         OR btrim(NEW.submission_url) = ''
         OR NEW.submitted_at IS NULL) THEN
      RAISE EXCEPTION 'Challenge submissions require completed work and evidence';
    END IF;

    -- Participants may submit or resubmit work, but cannot set, clear, or
    -- replace a creator's review decision or reviewer fields themselves.
    IF OLD.review_status IS DISTINCT FROM NEW.review_status THEN
      IF OLD.review_status NOT IN ('none', 'rejected') OR NEW.review_status <> 'submitted' THEN
        RAISE EXCEPTION 'Participants cannot review their own challenge submission';
      END IF;
    END IF;

    IF OLD.reviewer_note IS DISTINCT FROM NEW.reviewer_note
       OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at THEN
      IF NOT _is_resubmission THEN
        RAISE EXCEPTION 'Participants cannot change reviewer fields';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the participant or challenge creator may update this submission';
END;
$$;

DROP TRIGGER IF EXISTS enforce_challenge_review_transition ON public.challenge_participants;
CREATE TRIGGER enforce_challenge_review_transition
  BEFORE UPDATE OF status, progress, submission_url, submission_note, submitted_at,
    review_status, reviewer_note, reviewed_at, challenge_id, user_id
  ON public.challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_challenge_review_transition();

DROP TRIGGER IF EXISTS enforce_challenge_review_insert ON public.challenge_participants;
CREATE TRIGGER enforce_challenge_review_insert
  BEFORE INSERT ON public.challenge_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_challenge_review_transition();

REVOKE ALL ON FUNCTION public.enforce_challenge_review_transition() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
