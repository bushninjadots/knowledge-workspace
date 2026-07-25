-- Notifications system
-- Creates the notifications table, indexes, RLS policies, and trigger functions
-- for generating notifications from existing platform events.

-- ============================================================
-- 1. Notifications table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  archived_at timestamptz,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications(user_id, type);

-- ============================================================
-- 3. Grants
-- ============================================================

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- ============================================================
-- 4. RLS policies
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 5. Helper: insert notification (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id, actor_id, type, title, body, entity_type, entity_id, metadata
  ) VALUES (
    p_user_id, p_actor_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_metadata
  );
END;
$$;

-- ============================================================
-- 6. Trigger: new message → notify recipient
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.insert_notification(
    (SELECT connection_id FROM public.connections WHERE id = NEW.connection_id
      AND requester_id <> NEW.sender_id
      UNION
      SELECT connection_id FROM public.connections WHERE id = NEW.connection_id
      AND addressee_id <> NEW.sender_id
      LIMIT 1),
    NEW.sender_id,
    'message',
    COALESCE(_actor_name, 'Someone') || ' sent you a message',
    left(NEW.body, 200),
    'connection',
    NEW.connection_id,
    jsonb_build_object('connection_id', NEW.connection_id, 'message_preview', left(NEW.body, 200))
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_message', 'messages',
  'notify_new_message', 'AFTER', 'INSERT'
);

-- ============================================================
-- 7. Trigger: connection request/accept → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_connection_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _recipient_id uuid;
  _notif_type text;
  _title text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.requester_id;

  IF TG_OP = 'INSERT' THEN
    _recipient_id := NEW.addressee_id;
    _notif_type := 'connection_request';
    _title := COALESCE(_actor_name, 'Someone') || ' wants to connect';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    _recipient_id := NEW.requester_id;
    _notif_type := 'connection_accepted';
    _title := COALESCE(_actor_name, 'Someone') || ' accepted your connection';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_notification(
    _recipient_id,
    NEW.requester_id,
    _notif_type,
    _title,
    NULL,
    'connection',
    NEW.id,
    jsonb_build_object('status', NEW.status)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_connection', 'connections',
  'notify_connection_event', 'AFTER', 'INSERT OR UPDATE'
);

-- ============================================================
-- 8. Trigger: comment on post → notify post author
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _post_author uuid;
  _post_title text;
BEGIN
  SELECT author_id, title INTO _post_author, _post_title
  FROM public.posts WHERE id = NEW.post_id;

  IF _post_author = NEW.author_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.author_id;

  PERFORM public.insert_notification(
    _post_author,
    NEW.author_id,
    'comment',
    COALESCE(_actor_name, 'Someone') || ' commented on your post',
    left(NEW.body, 200),
    'post',
    NEW.post_id,
    jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body, 200))
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_comment', 'comments',
  'notify_post_comment', 'AFTER', 'INSERT'
);

-- ============================================================
-- 9. Trigger: @mention in comment → notify mentioned user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _handle text;
  _mentioned_id uuid;
  _actor_name text;
  _post_title text;
BEGIN
  FOR _handle IN SELECT regexp_matches(NEW.body, '@([a-zA-Z0-9_]+)', 'g') LOOP
    SELECT id INTO _mentioned_id FROM public.profiles WHERE handle = _handle[1];
    IF _mentioned_id IS NULL OR _mentioned_id = NEW.author_id THEN CONTINUE; END IF;

    SELECT COALESCE(display_name, handle) INTO _actor_name
    FROM public.profiles WHERE id = NEW.author_id;

    SELECT title INTO _post_title FROM public.posts WHERE id = NEW.post_id;

    PERFORM public.insert_notification(
      _mentioned_id,
      NEW.author_id,
      'mention',
      COALESCE(_actor_name, 'Someone') || ' mentioned you',
      left(NEW.body, 200),
      'post',
      NEW.post_id,
      jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body, 200))
    );
  END LOOP;
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_mention', 'comments',
  'notify_mention', 'AFTER', 'INSERT'
);

-- ============================================================
-- 10. Trigger: session participant change → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_session_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _session_title text;
  _notif_type text;
  _title text;
BEGIN
  SELECT title INTO _session_title FROM public.sessions WHERE id = NEW.session_id;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.profile_id;

  IF TG_OP = 'INSERT' AND NEW.role = 'organizer' THEN
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _notif_type := 'session_invite';
    _title := 'You''re invited to: ' || COALESCE(_session_title, 'a session');
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    _notif_type := 'session_update';
    _title := 'Session status updated: ' || COALESCE(_session_title, 'a session');
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.insert_notification(
    NEW.profile_id,
    (SELECT organizer_id FROM public.sessions WHERE id = NEW.session_id),
    _notif_type,
    _title,
    NULL,
    'session',
    NEW.session_id,
    jsonb_build_object('session_title', _session_title, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_session_participant', 'session_participants',
  'notify_session_event', 'AFTER', 'INSERT OR UPDATE'
);

-- ============================================================
-- 11. Trigger: achievement unlocked → notify user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.insert_notification(
    NEW.profile_id,
    NULL,
    'achievement',
    'Achievement Unlocked: ' || replace(replace(NEW.achievement::text, '_', ' '), 'E', ''),
    NULL,
    'achievement',
    NULL,
    jsonb_build_object('achievement', NEW.achievement::text)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_achievement', 'user_achievements',
  'notify_achievement', 'AFTER', 'INSERT'
);

-- ============================================================
-- 12. Trigger: endorsement received → notify endorsed user
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_endorsement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _skill_name text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.endorsed_by;

  SELECT name INTO _skill_name FROM public.skills WHERE id = NEW.skill_id;

  PERFORM public.insert_notification(
    NEW.profile_id,
    NEW.endorsed_by,
    'endorsement',
    COALESCE(_actor_name, 'Someone') || ' endorsed your ' || COALESCE(_skill_name, 'skill'),
    NULL,
    'skill',
    NEW.skill_id,
    jsonb_build_object('skill_name', _skill_name, 'endorsed_by', NEW.endorsed_by)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_endorsement', 'skill_endorsements',
  'notify_endorsement', 'AFTER', 'INSERT'
);

-- ============================================================
-- 13. Trigger: project contributor change → notify
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_project_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
  _project_title text;
  _project_owner uuid;
  _notif_type text;
  _title text;
BEGIN
  IF NEW.role = 'creator' THEN RETURN NEW; END IF;

  SELECT title, profile_id INTO _project_title, _project_owner
  FROM public.projects WHERE id = NEW.project_id;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.profile_id;

  _notif_type := 'project_join';
  _title := COALESCE(_actor_name, 'Someone') || ' joined your project';

  PERFORM public.insert_notification(
    _project_owner,
    NEW.profile_id,
    _notif_type,
    _title,
    NULL,
    'project',
    NEW.project_id,
    jsonb_build_object('project_title', _project_title)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_project_contributor', 'project_contributors',
  'notify_project_event', 'AFTER', 'INSERT'
);

-- ============================================================
-- 14. Trigger: connection accepted → notify as follow
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_name text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.requester_id;

  PERFORM public.insert_notification(
    NEW.addressee_id,
    NEW.requester_id,
    'follow',
    COALESCE(_actor_name, 'Someone') || ' started following you',
    NULL,
    'profile',
    NEW.requester_id,
    jsonb_build_object('requester_id', NEW.requester_id)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_follow', 'connections',
  'notify_follow', 'AFTER', 'UPDATE'
);

-- ============================================================
-- 15. Enable Realtime on notifications table
-- ============================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
