-- ============================================================================
-- Report moderation polish
--
-- 1. Rate limit — a single user can file at most 5 reports per rolling hour,
--    so the moderation queue can't be flooded. The insert is rejected with a
--    clear error the UI surfaces.
-- 2. moderator_note — moderators can add a note when resolving/dismissing a
--    report; the reporter is notified (only when a note was left, so
--    auto-resolves don't spam).
-- 3. Auto-resolve — when a post is removed, its open reports are marked
--    'resolved' (audit record kept, FK switches to SET NULL + title snapshot
--    so the report stays readable after the post is gone).
-- 4. resolved_at timestamp on reports.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rate limit (max 5 reports / rolling hour / user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent integer;
BEGIN
  SELECT count(*) INTO _recent
  FROM public.post_reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > now() - interval '1 hour';

  IF _recent >= 5 THEN
    RAISE EXCEPTION 'report_rate_limited: You have filed too many reports recently. Please try again later.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_rate_limit ON public.post_reports;
CREATE TRIGGER trg_report_rate_limit
  BEFORE INSERT ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.check_report_rate_limit();

-- ---------------------------------------------------------------------------
-- 2. Moderator note + resolved_at + audit snapshot columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.post_reports
  ADD COLUMN IF NOT EXISTS moderator_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_title_snapshot text;

-- Keep the report row after its post is deleted (audit trail), so the FK
-- moves from CASCADE to SET NULL and post_id becomes nullable.
DO $$ BEGIN
  ALTER TABLE public.post_reports ALTER COLUMN post_id DROP NOT NULL;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_reports DROP CONSTRAINT IF EXISTS post_reports_post_id_fkey;
  ALTER TABLE public.post_reports
    ADD CONSTRAINT post_reports_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN null; END $$;

-- ---------------------------------------------------------------------------
-- 3. Auto-resolve open reports when a post is removed
--    (BEFORE DELETE so we still have the post row to snapshot the title)
-- ---------------------------------------------------------------------------
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
      post_title_snapshot = COALESCE(post_title_snapshot, OLD.title)
  WHERE post_id = OLD.id
    AND status = 'open';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolve_post_reports ON public.posts;
CREATE TRIGGER trg_auto_resolve_post_reports
  BEFORE DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.auto_resolve_post_reports();

-- ---------------------------------------------------------------------------
-- 4. Notify the reporter when a moderator resolves/dismisses WITH a note
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_report_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _outcome text;
  _title text;
  _body text;
BEGIN
  -- Only fire when a moderator actually resolved/dismissed with a note;
  -- auto-resolves (post removed) have no note and stay silent.
  IF NEW.status NOT IN ('resolved', 'dismissed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.moderator_note IS NULL OR length(btrim(NEW.moderator_note)) = 0 THEN
    RETURN NEW;
  END IF;

  _outcome := CASE WHEN NEW.status = 'resolved' THEN 'resolved' ELSE 'dismissed' END;
  _title := COALESCE(NEW.post_title_snapshot,
    (SELECT title FROM public.posts WHERE id = NEW.post_id),
    'a post');

  PERFORM public.insert_notification(
    NEW.reporter_id,
    auth.uid(),
    'report_resolved',
    'Your report was ' || _outcome,
    '“' || _title || '” — ' || NEW.moderator_note,
    'post',
    NEW.post_id,
    jsonb_build_object('outcome', _outcome, 'post_title', _title)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_report_resolution ON public.post_reports;
CREATE TRIGGER trg_notify_report_resolution
  AFTER UPDATE ON public.post_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_resolution();

NOTIFY pgrst, 'reload schema';
