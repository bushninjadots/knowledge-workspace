-- ============================================================================
-- Milestone completion attribution.
--
-- The Credits roll reads project_activity, but milestone completions were
-- recorded with actor_id NULL because project_milestones had no completed_by
-- column. Add the column and re-point the activity trigger so "Completed
-- milestone: X" is credited to the person who completed it.
--
-- Existing completed milestones predate this column and cannot be back-filled
-- (the completing actor was never stored), so only future completions carry a
-- credit. This is acceptable: the roll is a rendering layer over evidence, and
-- no evidence existed for those rows.
-- ============================================================================

ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS project_milestones_completed_idx
  ON public.project_milestones (project_id, completed_by);

-- Re-point the activity trigger (originally created in
-- 20260808140000_project_activity_triggers.sql) to attribute the completion.
CREATE OR REPLACE FUNCTION public.record_project_milestone_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    INSERT INTO project_activity (project_id, actor_id, kind, title, body, metadata, created_at)
    VALUES (
      NEW.project_id,
      NEW.completed_by,
      'milestone_done',
      'Completed milestone: ' || NEW.title,
      NEW.description,
      jsonb_build_object('milestone_id', NEW.id),
      COALESCE(NEW.updated_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;
