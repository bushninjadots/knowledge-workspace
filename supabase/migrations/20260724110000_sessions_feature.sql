-- Sessions feature: core tables, enums, RLS, and grants.

-- Enums
DO $$ BEGIN
  CREATE TYPE public.session_type AS ENUM (
    'skill_exchange', 'mentoring', 'project_meeting', 'study_session', 'workshop', 'general'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM (
    'draft', 'scheduled', 'invitation_sent', 'confirmed', 'in_progress', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.participant_role AS ENUM ('organizer', 'participant', 'mentor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.participant_status AS ENUM ('invited', 'accepted', 'declined', 'pending');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_day_status AS ENUM ('available', 'unavailable', 'tentative');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ───────── All tables first (no policies yet) ─────────

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

CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

-- ───────── Enable RLS ─────────

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_requests ENABLE ROW LEVEL SECURITY;

-- ───────── Policies ─────────

-- Sessions
DROP POLICY IF EXISTS "Organizer CRUD sessions" ON public.sessions;
CREATE POLICY "Organizer CRUD sessions" ON public.sessions
  FOR ALL USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Participants view sessions" ON public.sessions;
CREATE POLICY "Participants view sessions" ON public.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = sessions.id AND sp.profile_id = auth.uid()
    )
    OR organizer_id = auth.uid()
  );

-- Session participants
DROP POLICY IF EXISTS "Organizer manage participants" ON public.session_participants;
CREATE POLICY "Organizer manage participants" ON public.session_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND s.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants view own rows" ON public.session_participants;
CREATE POLICY "Participants view own rows" ON public.session_participants
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Participants update own status" ON public.session_participants;
CREATE POLICY "Participants update own status" ON public.session_participants
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Session resources
DROP POLICY IF EXISTS "Participants CRUD resources" ON public.session_resources;
CREATE POLICY "Participants CRUD resources" ON public.session_resources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_resources.session_id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_resources.session_id AND s.organizer_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_resources.session_id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_resources.session_id AND s.organizer_id = auth.uid()
    )
  );

-- Session notes
DROP POLICY IF EXISTS "Participants CRUD notes" ON public.session_notes;
CREATE POLICY "Participants CRUD notes" ON public.session_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_notes.session_id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_notes.session_id AND s.organizer_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_notes.session_id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_notes.session_id AND s.organizer_id = auth.uid()
    )
  );

-- Session availability
DROP POLICY IF EXISTS "Owner CRUD availability" ON public.session_availability;
CREATE POLICY "Owner CRUD availability" ON public.session_availability
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Others view availability" ON public.session_availability;
CREATE POLICY "Others view availability" ON public.session_availability
  FOR SELECT USING (true);

-- Session requests
DROP POLICY IF EXISTS "Sender CRUD own requests" ON public.session_requests;
CREATE POLICY "Sender CRUD own requests" ON public.session_requests
  FOR ALL USING (from_user_id = auth.uid()) WITH CHECK (from_user_id = auth.uid());

DROP POLICY IF EXISTS "Recipient view and respond to requests" ON public.session_requests;
CREATE POLICY "Recipient view and respond to requests" ON public.session_requests
  FOR SELECT USING (to_user_id = auth.uid());

DROP POLICY IF EXISTS "Recipient update requests" ON public.session_requests;
CREATE POLICY "Recipient update requests" ON public.session_requests
  FOR UPDATE USING (to_user_id = auth.uid()) WITH CHECK (to_user_id = auth.uid());

-- ───────── Indexes ─────────

CREATE INDEX IF NOT EXISTS idx_sessions_organizer ON public.sessions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON public.sessions(starts_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_profile ON public.session_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_session_resources_session ON public.session_resources(session_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_session ON public.session_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_session_availability_profile ON public.session_availability(profile_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_session_requests_to ON public.session_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_session_requests_from ON public.session_requests(from_user_id);

-- ───────── Triggers ─────────

CREATE OR REPLACE FUNCTION public.set_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_sessions_updated_at();

DROP TRIGGER IF EXISTS session_notes_updated_at ON public.session_notes;
CREATE TRIGGER session_notes_updated_at BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_sessions_updated_at();

-- ───────── Grants ─────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_requests TO authenticated;

GRANT SELECT ON public.sessions TO anon;
GRANT SELECT ON public.session_participants TO anon;
GRANT SELECT ON public.session_resources TO anon;
GRANT SELECT ON public.session_notes TO anon;
GRANT SELECT ON public.session_availability TO anon;
GRANT SELECT ON public.session_requests TO anon;
