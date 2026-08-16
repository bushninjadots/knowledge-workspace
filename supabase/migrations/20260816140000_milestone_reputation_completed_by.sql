-- ============================================================================
-- Milestone reputation: award the person who completed the milestone.
--
-- The Aug-03 version of trg_reputation_milestone already fires on status
-- 'done' (not the stale 'completed' literal) but awarded the points to the
-- project owner. Now that project_milestones.completed_by exists (see
-- 20260816110000), award the completing actor instead, falling back to the
-- owner when no completer was recorded (e.g. milestones completed before the
-- column existed).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_reputation_milestone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _awardee uuid;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    SELECT p.profile_id INTO _owner FROM public.projects p WHERE p.id = NEW.project_id;
    _awardee := COALESCE(NEW.completed_by, _owner);
    IF _awardee IS NOT NULL THEN
      PERFORM public.log_contribution(_awardee, 'project_impact', 'milestone_completed', 5,
        jsonb_build_object('project_id', NEW.project_id, 'milestone_title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reputation_milestone ON public.project_milestones;
CREATE TRIGGER trg_reputation_milestone AFTER UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_milestone();
