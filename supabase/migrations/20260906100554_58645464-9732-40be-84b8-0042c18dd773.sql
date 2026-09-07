-- Achievement badge types ---------------------------------------------------
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'crew_founder';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'team_player';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'milestone_master';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'helping_hand';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'conversation_starter';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'role_filler';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'first_session';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'session_teacher';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'streak_4_weeks';

-- Teams: description + avatar storage policies ------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.teams.description IS
  'Short, plain-text summary of what this crew builds and who it is for.';

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team avatars are publicly readable" ON storage.objects;
  CREATE POLICY "Team avatars are publicly readable"
    ON storage.objects FOR SELECT USING (bucket_id = 'team-avatars');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads upload team avatar" ON storage.objects;
  CREATE POLICY "Team leads upload team avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads update team avatar" ON storage.objects;
  CREATE POLICY "Team leads update team avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads delete team avatar" ON storage.objects;
  CREATE POLICY "Team leads delete team avatar"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Project role applications: outcomes + notifications ------------------------
CREATE OR REPLACE FUNCTION public.notify_role_application_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role_title text;
  _project_title text;
  _project_owner uuid;
  _notification_type text;
  _title text;
  _body text;
BEGIN
  IF OLD.status = NEW.status OR NEW.status NOT IN ('accepted', 'declined') THEN
    RETURN NEW;
  END IF;

  SELECT por.title, p.title, p.profile_id
    INTO _role_title, _project_title, _project_owner
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = NEW.role_id;

  IF _project_owner IS NULL OR NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'accepted' THEN
    _notification_type := 'role_application_accepted';
    _title := 'Your application was accepted';
    _body := 'You were accepted for "' || COALESCE(_role_title, 'an open role') || '" on "' ||
      COALESCE(_project_title, 'a project') || '".';
  ELSE
    _notification_type := 'role_application_declined';
    _title := 'Application update';
    _body := 'Your application for "' || COALESCE(_role_title, 'an open role') || '" on "' ||
      COALESCE(_project_title, 'a project') || '" was declined.';
  END IF;

  PERFORM public.insert_notification(
    NEW.profile_id,
    _project_owner,
    _notification_type,
    _title,
    _body,
    'project_role_application',
    NEW.id,
    jsonb_build_object(
      'role_id', NEW.role_id,
      'project_id', (SELECT project_id FROM public.project_open_roles WHERE id = NEW.role_id),
      'status', NEW.status,
      'role_title', _role_title,
      'project_title', _project_title
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_role_application_status ON public.project_role_applications;
CREATE TRIGGER notify_on_role_application_status
  AFTER UPDATE OF status ON public.project_role_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_application_status();

CREATE OR REPLACE FUNCTION public.accept_project_role_application(
  p_application_id uuid,
  p_profile_id uuid,
  p_role_id uuid,
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _role_project_id uuid;
  _application_profile_id uuid;
  _application_role_id uuid;
  _application_status text;
  _role_filled boolean;
BEGIN
  SELECT p.profile_id, por.project_id, por.is_filled
    INTO _owner_id, _role_project_id, _role_filled
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = p_role_id
  FOR UPDATE OF por;

  SELECT profile_id, role_id, status
    INTO _application_profile_id, _application_role_id, _application_status
  FROM public.project_role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF _owner_id IS NULL OR _owner_id <> auth.uid()
     OR _role_project_id <> p_project_id
     OR _application_profile_id <> p_profile_id
     OR _application_role_id <> p_role_id THEN
    RAISE EXCEPTION 'Not authorized to accept this application';
  END IF;

  IF _role_filled OR _application_status <> 'pending' THEN
    RAISE EXCEPTION 'This role is no longer available';
  END IF;

  UPDATE public.project_role_applications
  SET status = 'accepted'
  WHERE id = p_application_id AND status = 'pending';

  INSERT INTO public.project_contributors (project_id, profile_id, role)
  VALUES (p_project_id, p_profile_id, 'contributor')
  ON CONFLICT (project_id, profile_id) DO NOTHING;

  UPDATE public.project_open_roles
  SET is_filled = true, filled_by = p_profile_id
  WHERE id = p_role_id AND is_filled = false;

  UPDATE public.project_role_applications
  SET status = 'declined'
  WHERE role_id = p_role_id
    AND status = 'pending'
    AND id <> p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_project_role_application(
  p_application_id uuid,
  p_role_id uuid,
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _role_project_id uuid;
  _application_role_id uuid;
  _application_status text;
BEGIN
  SELECT p.profile_id, por.project_id
    INTO _owner_id, _role_project_id
  FROM public.project_open_roles por
  JOIN public.projects p ON p.id = por.project_id
  WHERE por.id = p_role_id
  FOR UPDATE OF por;

  SELECT role_id, status
    INTO _application_role_id, _application_status
  FROM public.project_role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF _owner_id IS NULL OR _owner_id <> auth.uid()
     OR _role_project_id <> p_project_id
     OR _application_role_id <> p_role_id THEN
    RAISE EXCEPTION 'Not authorized to decline this application';
  END IF;

  IF _application_status <> 'pending' THEN
    RAISE EXCEPTION 'This application has already been decided';
  END IF;

  UPDATE public.project_role_applications
  SET status = 'declined'
  WHERE id = p_application_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_project_role_application(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_project_role_application(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_project_role_application(uuid, uuid, uuid) TO authenticated;

-- Report moderation polish ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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

ALTER TABLE public.post_reports
  ADD COLUMN IF NOT EXISTS moderator_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_title_snapshot text,
  ADD COLUMN IF NOT EXISTS space_id_snapshot uuid;

DO $$ BEGIN
  ALTER TABLE public.post_reports ALTER COLUMN post_id DROP NOT NULL;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_reports DROP CONSTRAINT IF EXISTS post_reports_post_id_fkey;
  ALTER TABLE public.post_reports
    ADD CONSTRAINT post_reports_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN null; END $$;

CREATE OR REPLACE FUNCTION public.snapshot_report_space()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.auto_resolve_post_reports()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.notify_report_resolution()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _outcome text;
  _title text;
BEGIN
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
    '"' || _title || '" — ' || NEW.moderator_note,
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

-- Project presentation preset ------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS presentation_preset text NOT NULL DEFAULT 'story-first';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_presentation_preset_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_presentation_preset_check
  CHECK (presentation_preset IN ('story-first', 'demo-first', 'process-first', 'collaboration-first'));

-- Concurrency-safe poll voting ----------------------------------------------
CREATE OR REPLACE FUNCTION public.vote_on_poll(
  p_post_id uuid,
  p_option_index integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _poll jsonb;
  _votes jsonb;
  _option_count integer;
  _ends_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT poll_data
    INTO _poll
  FROM public.posts
  WHERE id = p_post_id AND type = 'poll'
  FOR UPDATE;

  IF _poll IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  _option_count := jsonb_array_length(COALESCE(_poll->'options', '[]'::jsonb));
  IF p_option_index < 0 OR p_option_index >= _option_count THEN
    RAISE EXCEPTION 'Poll option is unavailable';
  END IF;

  IF NULLIF(_poll->>'ends_at', '') IS NOT NULL THEN
    _ends_at := (_poll->>'ends_at')::timestamptz;
    IF _ends_at <= now() THEN
      RAISE EXCEPTION 'This poll has ended';
    END IF;
  END IF;

  _votes := COALESCE(_poll->'votes', '[]'::jsonb);
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_votes) AS vote
    WHERE vote->>'user_id' = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  UPDATE public.posts
  SET poll_data = jsonb_set(
    _poll,
    '{votes}',
    _votes || jsonb_build_array(
      jsonb_build_object('option_index', p_option_index, 'user_id', auth.uid()::text)
    )
  )
  WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_on_poll(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';