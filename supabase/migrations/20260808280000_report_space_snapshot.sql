-- ============================================================================
-- Report space snapshot
--
-- post_reports.space_id_snapshot — records which space a report belongs to at
-- the moment the post is removed (post_id becomes NULL via the SET NULL FK).
-- Moderators of multiple spaces can then tell which space a removed-post
-- report came from, so the reports inbox history stays correctly scoped.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

ALTER TABLE public.post_reports
  ADD COLUMN IF NOT EXISTS space_id_snapshot uuid;

-- Snapshot the space when a report is filed (post still exists then).
CREATE OR REPLACE FUNCTION public.snapshot_report_space()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.space_id_snapshot IS NULL THEN
    SELECT space_id INTO NEW.space_id_snapshot
    FROM public.posts WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_report_space ON public.post_reports;
CREATE TRIGGER trg_snapshot_report_space
  BEFORE INSERT OR UPDATE OF post_id ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_report_space();

-- The auto-resolve trigger already runs BEFORE DELETE on posts (post row still
-- intact), so teach it to persist the space id for the audit record.
CREATE OR REPLACE FUNCTION public.auto_resolve_post_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.post_reports
  SET status = 'resolved',
      resolved_at = now(),
      post_title_snapshot = COALESCE(post_title_snapshot, OLD.title),
      space_id_snapshot = COALESCE(space_id_snapshot, OLD.space_id)
  WHERE post_id = OLD.id
    AND status = 'open';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolve_post_reports ON public.posts;
CREATE TRIGGER trg_auto_resolve_post_reports
  BEFORE DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.auto_resolve_post_reports();

NOTIFY pgrst, 'reload schema';
