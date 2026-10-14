-- ============================================================================
-- Project access levels + release countdown
--
-- Access (projects.visibility):
--   public   everyone
--   private  the owner and contributors (unchanged)
--   crew     + members of the crews the project is linked to (team_projects)
--   people   + the people the owner picked (project_viewers)
-- One function, project_shared_with(), decides crew/people access; the
-- projects policy and is_project_visible() (which guards milestones, updates,
-- activity, discussions …) both use it, so every part of a project follows
-- the same rule.
--
-- Release:
--   release_at        when it goes out (a countdown until then)
--   release_note      where to get it / how to use it
--   release_links     { appId: url } — store pages, site, repo …
--   release_public    list it in Explore's "Launching soon" / "Just shipped"
--   release_announced_at  set when the "it shipped" notifications went out
-- announce_releases() runs every 10 minutes (pg_cron, when available):
-- tells the owner "it shipped — congrats" and everyone watching.
-- ============================================================================

-- ── Access ─────────────────────────────────────────────────────────────────
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_visibility_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_visibility_check
  CHECK (visibility IN ('public', 'private', 'crew', 'people'));

CREATE TABLE IF NOT EXISTS public.project_viewers (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS project_viewers_profile_idx ON public.project_viewers (profile_id);

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND profile_id = p_uid);
$$;
REVOKE ALL ON FUNCTION public.is_project_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.limit_project_viewers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.project_viewers WHERE project_id = NEW.project_id) >= 100 THEN
    RAISE EXCEPTION 'rate_limited: A project can be shared with up to 100 people.'
      USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.limit_project_viewers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS limit_project_viewers ON public.project_viewers;
CREATE TRIGGER limit_project_viewers BEFORE INSERT ON public.project_viewers
  FOR EACH ROW EXECUTE FUNCTION public.limit_project_viewers();

ALTER TABLE public.project_viewers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners and viewers see the share list" ON public.project_viewers;
CREATE POLICY "Owners and viewers see the share list" ON public.project_viewers
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()) OR public.is_project_owner(project_id, (SELECT auth.uid())));
DROP POLICY IF EXISTS "Owners share their project" ON public.project_viewers;
CREATE POLICY "Owners share their project" ON public.project_viewers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_owner(project_id, (SELECT auth.uid())));
DROP POLICY IF EXISTS "Owners unshare, viewers leave" ON public.project_viewers;
CREATE POLICY "Owners unshare, viewers leave" ON public.project_viewers
  FOR DELETE TO authenticated
  USING (profile_id = (SELECT auth.uid()) OR public.is_project_owner(project_id, (SELECT auth.uid())));
REVOKE ALL ON public.project_viewers FROM anon, authenticated;
GRANT SELECT, DELETE ON public.project_viewers TO authenticated;
GRANT INSERT (project_id, profile_id) ON public.project_viewers TO authenticated;

-- Crew / selected-people access for one person.
CREATE OR REPLACE FUNCTION public.project_shared_with(p_project_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = p_project_id
       AND (
         (p.visibility = 'people' AND EXISTS (
            SELECT 1 FROM public.project_viewers v
             WHERE v.project_id = p.id AND v.profile_id = p_uid))
         OR (p.visibility = 'crew' AND EXISTS (
            SELECT 1 FROM public.team_projects tp
              JOIN public.team_members tm ON tm.team_id = tp.team_id
             WHERE tp.project_id = p.id AND tm.profile_id = p_uid))
       ));
$$;
REVOKE ALL ON FUNCTION public.project_shared_with(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_shared_with(uuid, uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Projects viewable by everyone" ON public.projects;
CREATE POLICY "Projects viewable by everyone" ON public.projects
  FOR SELECT
  USING (
    visibility = 'public'
    OR profile_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = projects.id AND pc.profile_id = (SELECT auth.uid()))
    OR (visibility IN ('crew', 'people') AND public.project_shared_with(id, (SELECT auth.uid())))
  );

CREATE OR REPLACE FUNCTION public.is_project_visible(project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id
      AND (
        p.visibility = 'public'
        OR p.profile_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.project_contributors pc
                    WHERE pc.project_id = p.id AND pc.profile_id = auth.uid())
        OR (p.visibility IN ('crew', 'people') AND public.project_shared_with(p.id, auth.uid()))
      )
  );
$$;

DROP POLICY IF EXISTS "Project repositories are readable for visible projects" ON public.project_repositories;
CREATE POLICY "Project repositories are readable for visible projects" ON public.project_repositories
  FOR SELECT USING (public.is_project_visible(project_id));

-- ── Release ────────────────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS release_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_note text
    CHECK (release_note IS NULL OR char_length(release_note) <= 1500),
  ADD COLUMN IF NOT EXISTS release_links jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(release_links) = 'object'),
  ADD COLUMN IF NOT EXISTS release_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS release_announced_at timestamptz;

GRANT UPDATE (release_at, release_note, release_links, release_public) ON public.projects TO authenticated;
GRANT INSERT (release_at, release_note, release_links, release_public) ON public.projects TO authenticated;

-- Moving the date re-arms the announcement.
CREATE OR REPLACE FUNCTION public.rearm_release()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.release_at IS DISTINCT FROM OLD.release_at THEN
    NEW.release_announced_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS rearm_release ON public.projects;
CREATE TRIGGER rearm_release BEFORE UPDATE OF release_at ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.rearm_release();

CREATE INDEX IF NOT EXISTS projects_release_idx
  ON public.projects (release_at DESC) WHERE release_at IS NOT NULL AND release_public;

-- "It shipped": the owner gets a congrats, watchers get the news. Idempotent.
CREATE OR REPLACE FUNCTION public.announce_releases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p record;
  _n integer := 0;
BEGIN
  FOR _p IN
    SELECT id, title, profile_id FROM public.projects
     WHERE release_at IS NOT NULL AND release_at <= now()
       AND release_at > now() - interval '7 days'
       AND release_announced_at IS NULL
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.insert_notification(
      _p.profile_id, NULL, 'project_shipped',
      _p.title || ' has shipped — congrats! 🎉',
      'Share it, and tell people where to get it.', 'project', _p.id,
      jsonb_build_object('project_id', _p.id));
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, metadata)
    SELECT w.user_id, 'project_shipped', _p.title || ' just shipped',
           'A project you follow is out now.', 'project', _p.id,
           jsonb_build_object('project_id', _p.id)
      FROM public.project_watchers w
     WHERE w.project_id = _p.id AND w.user_id <> _p.profile_id;
    UPDATE public.projects SET release_announced_at = now() WHERE id = _p.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.announce_releases() FROM PUBLIC, anon, authenticated;

DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron unavailable — release announcements not scheduled: %', SQLERRM;
    RETURN;
  END;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'announce-releases';
  PERFORM cron.schedule('announce-releases', '*/10 * * * *', 'SELECT public.announce_releases()');
END
$do$;

-- ── Only public projects can be forked (crew / selected-people too stay closed) ──
CREATE OR REPLACE FUNCTION public.fork_project(p_project_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_parent public.projects;
  v_child_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_parent FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  IF v_parent.profile_id = v_user THEN
    RAISE EXCEPTION 'You already own this project';
  END IF;
  IF NOT v_parent.allow_forks THEN
    RAISE EXCEPTION 'This project does not allow forking';
  END IF;
  IF v_parent.visibility <> 'public' THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  INSERT INTO public.projects (
    profile_id, title, description, goal, vision, status, visibility, stage,
    progress_percent, cover_url, gallery, resources, links, tags,
    looking_for_feedback, looking_for_collaborators,
    presentation_preset, season, collaboration_brief, uploaded_files, readme, tools,
    forked_from_project_id, allow_forks
  ) VALUES (
    v_user, v_parent.title, v_parent.description, v_parent.goal, v_parent.vision,
    'planning', 'private', v_parent.stage,
    0, v_parent.cover_url, v_parent.gallery, v_parent.resources, v_parent.links, v_parent.tags,
    v_parent.looking_for_feedback, v_parent.looking_for_collaborators,
    v_parent.presentation_preset, v_parent.season, v_parent.collaboration_brief,
    v_parent.uploaded_files, v_parent.readme, v_parent.tools,
    v_parent.id, false
  )
  RETURNING id INTO v_child_id;

  -- Carry the project's skills and linked repositories so the fork is a real
  -- starting point rather than an empty shell. Contributors, milestones,
  -- discussions and activity are intentionally NOT copied — those belong to the
  -- original team's work.
  INSERT INTO public.project_skills (project_id, skill_id)
  SELECT v_child_id, skill_id FROM public.project_skills WHERE project_id = v_parent.id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.project_repositories (project_id, url, provider, metadata)
  SELECT v_child_id, url, provider, metadata
  FROM public.project_repositories WHERE project_id = v_parent.id;

  UPDATE public.projects SET fork_count = fork_count + 1 WHERE id = v_parent.id;

  RETURN v_child_id;
END;
$function$;
