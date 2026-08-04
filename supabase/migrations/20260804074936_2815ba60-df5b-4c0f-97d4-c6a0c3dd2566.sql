-- ============================================================
-- PART A: NOTIFICATIONS
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

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON public.notifications(user_id, type);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id uuid, p_actor_id uuid, p_type text, p_title text,
  p_body text DEFAULT NULL, p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_actor_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_metadata);
END; $$;

REVOKE ALL ON FUNCTION public.insert_notification(uuid,uuid,text,text,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor_name text; _recipient uuid;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT CASE WHEN c.requester_id = NEW.sender_id THEN c.addressee_id ELSE c.requester_id END
    INTO _recipient FROM public.connections c WHERE c.id = NEW.connection_id;
  PERFORM public.insert_notification(_recipient, NEW.sender_id, 'message',
    COALESCE(_actor_name,'Someone') || ' sent you a message', left(NEW.body,200),
    'connection', NEW.connection_id,
    jsonb_build_object('connection_id', NEW.connection_id, 'message_preview', left(NEW.body,200)));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_message ON public.messages;
CREATE TRIGGER notify_on_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- connections
CREATE OR REPLACE FUNCTION public.notify_connection_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor_name text; _recipient_id uuid; _notif_type text; _title text; _actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _recipient_id := NEW.addressee_id; _actor := NEW.requester_id; _notif_type := 'connection_request';
    SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.requester_id;
    _title := COALESCE(_actor_name,'Someone') || ' wants to connect';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    _recipient_id := NEW.requester_id; _actor := NEW.addressee_id; _notif_type := 'connection_accepted';
    SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.addressee_id;
    _title := COALESCE(_actor_name,'Someone') || ' accepted your connection';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.insert_notification(_recipient_id, _actor, _notif_type, _title, NULL,
    'connection', NEW.id, jsonb_build_object('status', NEW.status));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_connection ON public.connections;
CREATE TRIGGER notify_on_connection AFTER INSERT OR UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.notify_connection_event();

-- comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor_name text; _post_author uuid; _post_title text;
BEGIN
  SELECT author_id, title INTO _post_author, _post_title FROM public.posts WHERE id = NEW.post_id;
  IF _post_author = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.author_id;
  PERFORM public.insert_notification(_post_author, NEW.author_id, 'comment',
    COALESCE(_actor_name,'Someone') || ' commented on your post', left(NEW.body,200),
    'post', NEW.post_id, jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body,200)));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_comment ON public.comments;
CREATE TRIGGER notify_on_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- mention
CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m text[]; _mentioned_id uuid; _actor_name text; _post_title text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.author_id;
  SELECT title INTO _post_title FROM public.posts WHERE id = NEW.post_id;
  FOR _m IN SELECT regexp_matches(NEW.body, '@([a-zA-Z0-9_]+)', 'g') LOOP
    SELECT id INTO _mentioned_id FROM public.profiles WHERE handle = _m[1];
    IF _mentioned_id IS NULL OR _mentioned_id = NEW.author_id THEN CONTINUE; END IF;
    PERFORM public.insert_notification(_mentioned_id, NEW.author_id, 'mention',
      COALESCE(_actor_name,'Someone') || ' mentioned you', left(NEW.body,200),
      'post', NEW.post_id, jsonb_build_object('post_title', _post_title, 'comment_preview', left(NEW.body,200)));
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_mention ON public.comments;
CREATE TRIGGER notify_on_mention AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_mention();

-- session participant
CREATE OR REPLACE FUNCTION public.notify_session_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _session_title text; _notif_type text; _title text;
BEGIN
  SELECT title INTO _session_title FROM public.sessions WHERE id = NEW.session_id;
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
  PERFORM public.insert_notification(NEW.profile_id,
    (SELECT organizer_id FROM public.sessions WHERE id = NEW.session_id),
    _notif_type, _title, NULL, 'session', NEW.session_id,
    jsonb_build_object('session_title', _session_title, 'status', NEW.status));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_session_participant ON public.session_participants;
CREATE TRIGGER notify_on_session_participant AFTER INSERT OR UPDATE ON public.session_participants FOR EACH ROW EXECUTE FUNCTION public.notify_session_event();

-- achievement
CREATE OR REPLACE FUNCTION public.notify_achievement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.insert_notification(NEW.profile_id, NULL, 'achievement',
    'Achievement Unlocked: ' || replace(NEW.achievement::text, '_', ' '), NULL,
    'achievement', NULL, jsonb_build_object('achievement', NEW.achievement::text));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_achievement ON public.user_achievements;
CREATE TRIGGER notify_on_achievement AFTER INSERT ON public.user_achievements FOR EACH ROW EXECUTE FUNCTION public.notify_achievement();

-- endorsement
CREATE OR REPLACE FUNCTION public.notify_endorsement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor_name text; _skill_name text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.endorsed_by;
  SELECT name INTO _skill_name FROM public.skills WHERE id = NEW.skill_id;
  PERFORM public.insert_notification(NEW.profile_id, NEW.endorsed_by, 'endorsement',
    COALESCE(_actor_name,'Someone') || ' endorsed your ' || COALESCE(_skill_name,'skill'), NULL,
    'skill', NEW.skill_id, jsonb_build_object('skill_name', _skill_name, 'endorsed_by', NEW.endorsed_by));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_endorsement ON public.skill_endorsements;
CREATE TRIGGER notify_on_endorsement AFTER INSERT ON public.skill_endorsements FOR EACH ROW EXECUTE FUNCTION public.notify_endorsement();

-- project contributor
CREATE OR REPLACE FUNCTION public.notify_project_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor_name text; _project_title text; _project_owner uuid;
BEGIN
  IF NEW.role = 'creator' THEN RETURN NEW; END IF;
  SELECT title, profile_id INTO _project_title, _project_owner FROM public.projects WHERE id = NEW.project_id;
  IF _project_owner IS NULL OR _project_owner = NEW.profile_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.profile_id;
  PERFORM public.insert_notification(_project_owner, NEW.profile_id, 'project_join',
    COALESCE(_actor_name,'Someone') || ' joined your project', NULL,
    'project', NEW.project_id, jsonb_build_object('project_title', _project_title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_project_contributor ON public.project_contributors;
CREATE TRIGGER notify_on_project_contributor AFTER INSERT ON public.project_contributors FOR EACH ROW EXECUTE FUNCTION public.notify_project_event();

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- PART B: CHALLENGES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'skill',
  skills TEXT[] NOT NULL DEFAULT '{}',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT ON public.challenges TO anon;
GRANT ALL ON public.challenges TO service_role;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Challenges are publicly readable" ON public.challenges FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users insert challenges" ON public.challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Creators update challenges" ON public.challenges FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Creators delete challenges" ON public.challenges FOR DELETE TO authenticated USING (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined',
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT SELECT ON public.challenge_participants TO anon;
GRANT ALL ON public.challenge_participants TO service_role;

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Participants are publicly readable" ON public.challenge_participants FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users insert own participation" ON public.challenge_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users update own participation" ON public.challenge_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users delete own participation" ON public.challenge_participants FOR DELETE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_challenges_status_created ON public.challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);

DROP TRIGGER IF EXISTS challenges_set_updated_at ON public.challenges;
CREATE TRIGGER challenges_set_updated_at BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_challenge_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator_id uuid; _challenge_title text; _actor_name text;
BEGIN
  SELECT created_by, title INTO _creator_id, _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;
  IF _creator_id IS NULL OR _creator_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.insert_notification(_creator_id, NEW.user_id, 'challenge_join',
    COALESCE(_actor_name,'Someone') || ' joined your challenge "' || _challenge_title || '"', NULL,
    'challenge', NEW.challenge_id, jsonb_build_object('challenge_title', _challenge_title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_challenge_join ON public.challenge_participants;
CREATE TRIGGER notify_on_challenge_join AFTER INSERT ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_join();

CREATE OR REPLACE FUNCTION public.notify_challenge_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _creator_id uuid; _challenge_title text; _actor_name text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  SELECT created_by, title INTO _creator_id, _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;
  IF _creator_id IS NULL OR _creator_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.insert_notification(_creator_id, NEW.user_id, 'challenge_complete',
    COALESCE(_actor_name,'Someone') || ' completed your challenge "' || _challenge_title || '"', NULL,
    'challenge', NEW.challenge_id, jsonb_build_object('challenge_title', _challenge_title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_challenge_complete ON public.challenge_participants;
CREATE TRIGGER notify_on_challenge_complete AFTER UPDATE ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_complete();

CREATE OR REPLACE FUNCTION public.trg_reputation_challenge_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _challenge_title text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  SELECT title INTO _challenge_title FROM public.challenges WHERE id = NEW.challenge_id;
  PERFORM public.log_contribution(NEW.user_id, 'challenges', 'challenge_completed', 15,
    jsonb_build_object('challenge_id', NEW.challenge_id, 'title', _challenge_title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reputation_challenge_completed ON public.challenge_participants;
CREATE TRIGGER trg_reputation_challenge_completed AFTER UPDATE ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.trg_reputation_challenge_completed();

-- ============================================================
-- PART C: FOLLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users see their own follows" ON public.follows FOR SELECT TO authenticated USING (auth.uid() = follower_id OR auth.uid() = following_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can follow others" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can unfollow others" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);

-- ============================================================
-- PART D: COMMUNITY SPACES
-- ============================================================

DO $$ BEGIN CREATE TYPE public.space_member_role AS ENUM ('owner','moderator','member'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.community_spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  avatar_url  text,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_spaces TO authenticated;
GRANT SELECT ON public.community_spaces TO anon;
GRANT ALL ON public.community_spaces TO service_role;

ALTER TABLE public.community_spaces ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Spaces are publicly readable" ON public.community_spaces FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can create spaces" ON public.community_spaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Only creator can update spaces" ON public.community_spaces FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Only creator can delete spaces" ON public.community_spaces FOR DELETE TO authenticated USING (auth.uid() = created_by); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.community_space_members (
  space_id  uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      public.space_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_space_members TO authenticated;
GRANT ALL ON public.community_space_members TO service_role;

ALTER TABLE public.community_space_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_space_member(p_space_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id AND user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_space_owner_or_moderator(p_space_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_space_members
    WHERE space_id = p_space_id AND user_id = COALESCE(p_user_id, auth.uid())
      AND role IN ('owner','moderator')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_space_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_owner_or_moderator(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Members can see member list" ON public.community_space_members;
CREATE POLICY "Members can see member list" ON public.community_space_members FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid()) OR auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can join spaces" ON public.community_space_members;
CREATE POLICY "Users can join spaces" ON public.community_space_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can leave spaces" ON public.community_space_members;
CREATE POLICY "Users can leave spaces" ON public.community_space_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owners and moderators can manage members" ON public.community_space_members;
CREATE POLICY "Owners and moderators can manage members" ON public.community_space_members FOR UPDATE TO authenticated
  USING (public.is_space_owner_or_moderator(space_id, auth.uid()))
  WITH CHECK (public.is_space_owner_or_moderator(space_id, auth.uid()));
DROP POLICY IF EXISTS "Owners and moderators can remove members" ON public.community_space_members;
CREATE POLICY "Owners and moderators can remove members" ON public.community_space_members FOR DELETE TO authenticated
  USING (public.is_space_owner_or_moderator(space_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_spaces_slug ON public.community_spaces(slug);
CREATE INDEX IF NOT EXISTS idx_spaces_created_by ON public.community_spaces(created_by);
CREATE INDEX IF NOT EXISTS idx_space_members_user ON public.community_space_members(user_id);

DROP TRIGGER IF EXISTS community_spaces_set_updated_at ON public.community_spaces;
CREATE TRIGGER community_spaces_set_updated_at BEFORE UPDATE ON public.community_spaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- posts columns
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES public.community_spaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS feedback_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_posts_space ON public.posts(space_id);
CREATE INDEX IF NOT EXISTS idx_posts_space_pinned ON public.posts(space_id, is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS posts_project_idx ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS posts_feedback_tags_idx ON public.posts USING GIN(feedback_tags);

ALTER TABLE public.project_discussions
  ADD COLUMN IF NOT EXISTS community_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

-- post_space_shares
CREATE TABLE IF NOT EXISTS public.post_space_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  shared_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, space_id)
);

GRANT SELECT, INSERT, DELETE ON public.post_space_shares TO authenticated;
GRANT ALL ON public.post_space_shares TO service_role;

ALTER TABLE public.post_space_shares ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Members can view shares in their spaces" ON public.post_space_shares FOR SELECT TO authenticated
  USING (public.is_space_member(space_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Members can share posts to their spaces" ON public.post_space_shares FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = shared_by AND public.is_space_member(space_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can unshare their own shares" ON public.post_space_shares FOR DELETE TO authenticated
  USING (auth.uid() = shared_by); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS post_space_shares_post_idx ON public.post_space_shares(post_id);
CREATE INDEX IF NOT EXISTS post_space_shares_space_idx ON public.post_space_shares(space_id);

-- project post notification
CREATE OR REPLACE FUNCTION public.notify_project_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _project_owner uuid; _project_title text; _actor_name text; _post_title text;
BEGIN
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
  SELECT profile_id, title INTO _project_owner, _project_title FROM public.projects WHERE id = NEW.project_id;
  IF _project_owner IS NULL OR _project_owner = NEW.author_id THEN RETURN NEW; END IF;
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.author_id;
  _post_title := COALESCE(NEW.title, 'Untitled');
  PERFORM public.insert_notification(_project_owner, NEW.author_id, 'project_post',
    COALESCE(_actor_name,'Someone') || ' posted about your project: ' || left(_project_title, 50),
    left(_post_title, 200), 'project', NEW.project_id,
    jsonb_build_object('project_title', _project_title, 'post_id', NEW.id, 'post_title', _post_title));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_on_project_post ON public.posts;
CREATE TRIGGER notify_on_project_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.notify_project_post();

-- default General space
DO $$
DECLARE first_user uuid; general_id uuid;
BEGIN
  SELECT id INTO first_user FROM public.profiles ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    INSERT INTO public.community_spaces (name, slug, description, created_by)
    VALUES ('General', 'general', 'The default community space for all topics.', first_user)
    ON CONFLICT (slug) DO NOTHING;
    SELECT id INTO general_id FROM public.community_spaces WHERE slug = 'general';
    INSERT INTO public.community_space_members (space_id, user_id, role)
    VALUES (general_id, first_user, 'owner') ON CONFLICT DO NOTHING;
    UPDATE public.posts SET space_id = general_id WHERE space_id IS NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';