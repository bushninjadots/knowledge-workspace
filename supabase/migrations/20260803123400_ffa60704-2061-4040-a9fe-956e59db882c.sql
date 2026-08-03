DO $$ BEGIN CREATE TYPE public.session_type AS ENUM ('skill_exchange','mentoring','project_meeting','study_session','workshop','general'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.session_status AS ENUM ('draft','scheduled','invitation_sent','confirmed','in_progress','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.participant_role AS ENUM ('organizer','participant','mentor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.participant_status AS ENUM ('invited','accepted','declined','pending'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.availability_day_status AS ENUM ('available','unavailable','tentative'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  session_type public.session_type NOT NULL DEFAULT 'general',
  status public.session_status NOT NULL DEFAULT 'draft',
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  community_id uuid,
  exchange_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'UTC',
  meeting_url text,
  location text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;

CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.participant_role NOT NULL DEFAULT 'participant',
  status public.participant_status NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;

CREATE TABLE IF NOT EXISTS public.session_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  file_path text,
  resource_type text NOT NULL DEFAULT 'link',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_resources TO authenticated;
GRANT ALL ON public.session_resources TO service_role;

CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_notes TO authenticated;
GRANT ALL ON public.session_notes TO service_role;

CREATE TABLE IF NOT EXISTS public.session_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  status public.availability_day_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_availability TO authenticated;
GRANT ALL ON public.session_availability TO service_role;

CREATE TABLE IF NOT EXISTS public.session_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  message text,
  suggested_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_requests TO authenticated;
GRANT ALL ON public.session_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_sessions_organizer ON public.sessions (organizer_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_participants_profile ON public.session_participants (profile_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_to ON public.session_requests (to_user_id, status);

CREATE OR REPLACE FUNCTION public.is_session_member(_session_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = _session_id AND s.organizer_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.session_participants sp WHERE sp.session_id = _session_id AND sp.profile_id = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_session_member(uuid, uuid) FROM PUBLIC, anon;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "Members can view sessions" ON public.sessions FOR SELECT TO authenticated
  USING (organizer_id = auth.uid() OR public.is_session_member(id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Organizer can create sessions" ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Organizer can update sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Organizer can delete sessions" ON public.sessions FOR DELETE TO authenticated
  USING (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Members can view participants" ON public.session_participants FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_session_member(session_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Organizer can add participants" ON public.session_participants FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid())
              OR profile_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Participant can respond" ON public.session_participants FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()))
  WITH CHECK (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Organizer or self can remove participant" ON public.session_participants FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Members can view resources" ON public.session_resources FOR SELECT TO authenticated
  USING (public.is_session_member(session_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Members can add resources" ON public.session_resources FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_session_member(session_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can delete resources" ON public.session_resources FOR DELETE TO authenticated
  USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Members can view notes" ON public.session_notes FOR SELECT TO authenticated
  USING (public.is_session_member(session_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Members can write notes" ON public.session_notes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_session_member(session_id, auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Members can update notes" ON public.session_notes FOR UPDATE TO authenticated
  USING (public.is_session_member(session_id, auth.uid())) WITH CHECK (public.is_session_member(session_id, auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Availability viewable by authenticated" ON public.session_availability FOR SELECT TO authenticated
  USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner manages availability" ON public.session_availability FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE POLICY "Participants view requests" ON public.session_requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Sender creates requests" ON public.session_requests FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Recipient responds to requests" ON public.session_requests FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid()) WITH CHECK (to_user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Sender withdraws requests" ON public.session_requests FOR DELETE TO authenticated
  USING (from_user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS sessions_set_updated_at ON public.sessions;
CREATE TRIGGER sessions_set_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS session_notes_set_updated_at ON public.session_notes;
CREATE TRIGGER session_notes_set_updated_at BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';