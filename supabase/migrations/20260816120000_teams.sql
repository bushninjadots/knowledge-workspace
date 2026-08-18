-- ============================================================================
-- Teams & crews — a persistent roster + shipped-work record.
--
-- A team is a named group of people who build together, anchored to projects
-- via team_projects ("Built by <Crew>"). It is NOT a chat/feed (Community owns
-- conversation) and not an organization page. Membership is lead-invited via
-- team_invites so reputation stays evidence-backed rather than self-served.
--
-- Tables are created before any policy that references another table (e.g. the
-- teams UPDATE policy references team_members; the team_members join policy
-- references team_invites), so no forward reference is ever parsed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  avatar_url text,
  cover_url  text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'contributor'
             CHECK (role IN ('lead', 'core', 'contributor')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.team_projects (
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.team_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, profile_id, status)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS teams_slug_idx ON public.teams (slug);
CREATE INDEX IF NOT EXISTS team_members_profile_idx ON public.team_members (profile_id);
CREATE INDEX IF NOT EXISTS team_projects_project_idx ON public.team_projects (project_id);
CREATE INDEX IF NOT EXISTS team_invites_profile_idx ON public.team_invites (profile_id, status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies — teams
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Teams viewable by everyone"
    ON public.teams FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create teams"
    ON public.teams FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Team leads can update teams"
    ON public.teams FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = teams.id AND tm.profile_id = auth.uid() AND tm.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Policies — team members
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Team members viewable by everyone"
    ON public.team_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Invitee can join a team"
    ON public.team_members FOR INSERT TO authenticated
    WITH CHECK (
      profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.team_invites ti
        WHERE ti.team_id = team_members.team_id
          AND ti.profile_id = auth.uid()
          AND ti.status = 'pending'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Team leads can manage members"
    ON public.team_members FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.team_members lead
        WHERE lead.team_id = team_members.team_id
          AND lead.profile_id = auth.uid()
          AND lead.role = 'lead'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.team_members lead
        WHERE lead.team_id = team_members.team_id
          AND lead.profile_id = auth.uid()
          AND lead.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can leave (leads can remove anyone)"
    ON public.team_members FOR DELETE TO authenticated
    USING (
      (profile_id = auth.uid() AND role <> 'lead')
      OR EXISTS (
        SELECT 1 FROM public.team_members lead
        WHERE lead.team_id = team_members.team_id
          AND lead.profile_id = auth.uid()
          AND lead.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Policies — team projects
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Team projects viewable by everyone"
    ON public.team_projects FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Team leads can attach projects"
    ON public.team_projects FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = team_projects.team_id
          AND tm.profile_id = auth.uid()
          AND tm.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Team leads can detach projects"
    ON public.team_projects FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = team_projects.team_id
          AND tm.profile_id = auth.uid()
          AND tm.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Policies — team invites
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Invitees and leads can see team invites"
    ON public.team_invites FOR SELECT TO authenticated
    USING (
      profile_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = team_invites.team_id
          AND tm.profile_id = auth.uid()
          AND tm.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Team leads can invite"
    ON public.team_invites FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = team_invites.team_id
          AND tm.profile_id = auth.uid()
          AND tm.role = 'lead'
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Invitees can respond to invites"
    ON public.team_invites FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Invitees can remove own invites"
    ON public.team_invites FOR DELETE TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$ BEGIN GRANT SELECT ON public.teams TO anon; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON public.teams TO authenticated; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT ON public.team_members TO anon; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT ON public.team_projects TO anon; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, DELETE ON public.team_projects TO authenticated; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Notification: team invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_team_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _actor_name text; _team_name text; _team_slug text;
BEGIN
  SELECT COALESCE(display_name, handle) INTO _actor_name FROM public.profiles WHERE id = NEW.invited_by;
  SELECT name, slug INTO _team_name, _team_slug FROM public.teams WHERE id = NEW.team_id;
  PERFORM public.insert_notification(
    NEW.profile_id,
    NEW.invited_by,
    'team_invite',
    COALESCE(_actor_name, 'Someone') || ' invited you to join ' || COALESCE(_team_name, 'a team'),
    NULL,
    'team',
    NEW.team_id,
    jsonb_build_object('team_id', NEW.team_id, 'team_name', _team_name, 'team_slug', _team_slug, 'invite_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_team_invite ON public.team_invites;
CREATE TRIGGER trg_notify_team_invite
AFTER INSERT ON public.team_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_team_invite();
