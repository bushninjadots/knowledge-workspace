-- ============================================================================
-- Post reports + moderation log
--
-- 1. post_reports — any member can flag a post that lives in a space (reason +
--    optional details). Space owners/moderators see open reports (in space
--    settings) and resolve or dismiss them. Reporters can see their own.
--    A trigger notifies every owner/moderator of the space when a new report
--    lands (excluding the reporter themselves).
-- 2. moderation_log — records every removal of a space post by someone other
--    than its author (i.e. a moderation action), with who and when. Shown in
--    space settings so owners can audit enforcement of their rules.
--
-- Safe to re-run: all statements are idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Post reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 100),
  details     text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_reports_post_idx ON public.post_reports(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS post_reports_status_idx ON public.post_reports(status);

GRANT SELECT, INSERT ON public.post_reports TO authenticated;
GRANT UPDATE ON public.post_reports TO authenticated;
GRANT ALL ON public.post_reports TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

-- Reporters see their own reports; space owners/moderators see reports on
-- posts in their space (any status, so resolved items stay auditable).
DO $$ BEGIN
  CREATE POLICY "Reporters see own reports, moderators see space reports"
    ON public.post_reports FOR SELECT TO authenticated
    USING (
      reporter_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_reports.post_id
          AND p.space_id IS NOT NULL
          AND public.is_space_owner_or_moderator(p.space_id, auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Anyone signed in can file a report (as themselves).
DO $$ BEGIN
  CREATE POLICY "Anyone can file a report"
    ON public.post_reports FOR INSERT TO authenticated
    WITH CHECK (reporter_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Only space owners/moderators change a report's status.
DO $$ BEGIN
  CREATE POLICY "Moderators can update report status"
    ON public.post_reports FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_reports.post_id
          AND p.space_id IS NOT NULL
          AND public.is_space_owner_or_moderator(p.space_id, auth.uid())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_reports.post_id
          AND p.space_id IS NOT NULL
          AND public.is_space_owner_or_moderator(p.space_id, auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Notify every owner/moderator of the space when a report is filed.
CREATE OR REPLACE FUNCTION public.notify_post_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mod record;
  _post_title text;
  _space_name text;
  _reporter_name text;
BEGIN
  SELECT p.title, s.name INTO _post_title, _space_name
  FROM public.posts p
  LEFT JOIN public.community_spaces s ON s.id = p.space_id
  WHERE p.id = NEW.post_id;

  SELECT COALESCE(display_name, handle) INTO _reporter_name
  FROM public.profiles WHERE id = NEW.reporter_id;

  FOR _mod IN
    SELECT csm.user_id
    FROM public.community_space_members csm
    JOIN public.posts p ON p.space_id = csm.space_id
    WHERE p.id = NEW.post_id
      AND csm.role IN ('owner', 'moderator')
      AND csm.user_id <> NEW.reporter_id
  LOOP
    PERFORM public.insert_notification(
      _mod.user_id,
      NEW.reporter_id,
      'post_report',
      COALESCE(_reporter_name, 'A member') || ' reported a post in ' || COALESCE(_space_name, 'your space'),
      'Reason: ' || NEW.reason || CASE WHEN NEW.details IS NOT NULL THEN ' — ' || NEW.details ELSE '' END,
      'post',
      NEW.post_id,
      jsonb_build_object('post_title', _post_title, 'report_id', NEW.id, 'reason', NEW.reason)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_post_report', 'post_reports',
  'notify_post_report', 'AFTER', 'INSERT'
);

-- ---------------------------------------------------------------------------
-- 2. Moderation log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id   uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  post_id    uuid,
  post_title text,
  actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action     text NOT NULL CHECK (action IN ('remove_post', 'remove_share')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_log_space_idx
  ON public.moderation_log(space_id, created_at DESC);

GRANT SELECT ON public.moderation_log TO authenticated;
GRANT ALL ON public.moderation_log TO service_role;

ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

-- Only space owners/moderators can read the log (it is an audit trail).
DO $$ BEGIN
  CREATE POLICY "Moderators can read moderation log"
    ON public.moderation_log FOR SELECT TO authenticated
    USING (public.is_space_owner_or_moderator(space_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Record space-post removals done by someone other than the author.
CREATE OR REPLACE FUNCTION public.log_post_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.space_id IS NOT NULL AND OLD.author_id <> auth.uid() THEN
    INSERT INTO public.moderation_log (space_id, post_id, post_title, actor_id, action)
    VALUES (OLD.space_id, OLD.id, OLD.title, auth.uid(), 'remove_post');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_post_removal ON public.posts;
CREATE TRIGGER trg_log_post_removal
  AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.log_post_removal();

-- Record share removals done by someone other than the sharer.
CREATE OR REPLACE FUNCTION public.log_share_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM OLD.shared_by THEN
    INSERT INTO public.moderation_log (space_id, post_id, post_title, actor_id, action)
    VALUES (OLD.space_id, NULL, NULL, auth.uid(), 'remove_share');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_share_removal ON public.post_space_shares;
CREATE TRIGGER trg_log_share_removal
  AFTER DELETE ON public.post_space_shares
  FOR EACH ROW EXECUTE FUNCTION public.log_share_removal();

NOTIFY pgrst, 'reload schema';
