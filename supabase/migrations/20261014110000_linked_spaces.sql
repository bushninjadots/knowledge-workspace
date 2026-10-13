-- Spaces that belong to something real: a team, a challenge or a project can
-- have its own space, started by whoever runs it, and the people in it are
-- kept in the space automatically.
--
-- * community_spaces.team_id / challenge_id / project_id — at most one link,
--   one space per thing. If the thing is deleted the space stays, unlinked.
-- * open_linked_space(kind, id) — returns the linked space, creating it on
--   first use. Only a team lead, the challenge's creator or the project's
--   owner may create one. Teams get a private room (it's the team's
--   workroom); challenges a public one; projects follow the project's own
--   visibility. Everyone already in the thing joins as a member.
-- * Membership triggers keep it in step: joining the team / challenge /
--   project adds you to its space, leaving removes you (owners and banned
--   people are left alone).

ALTER TABLE public.community_spaces
  ADD COLUMN IF NOT EXISTS team_id uuid UNIQUE REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenge_id uuid UNIQUE REFERENCES public.challenges(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid UNIQUE REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.community_spaces
  DROP CONSTRAINT IF EXISTS community_spaces_one_link,
  ADD CONSTRAINT community_spaces_one_link
    CHECK (num_nonnulls(team_id, challenge_id, project_id) <= 1);

-- Links are set only by open_linked_space(): an owner writing their space
-- directly must not attach it to someone else's team. A column-level REVOKE
-- can't carve columns out of a table-wide grant, so writes are re-granted
-- column by column. A future column on community_spaces that the app writes
-- needs adding to these lists.
REVOKE INSERT, UPDATE ON public.community_spaces FROM anon, authenticated;
GRANT INSERT (id, name, slug, description, avatar_url, created_by, created_at, updated_at, join_type,
              rules, report_auto_dim_threshold, visibility, tagline, about, banner_url,
              accent_color, topics, links, welcome_message)
  ON public.community_spaces TO authenticated;
GRANT UPDATE (name, slug, description, avatar_url, updated_at, join_type, rules,
              report_auto_dim_threshold, visibility, tagline, about, banner_url, accent_color,
              topics, links, welcome_message)
  ON public.community_spaces TO authenticated;

-- A URL-safe slug from a name, made unique with a short suffix if taken.
CREATE OR REPLACE FUNCTION public.unique_space_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _base text := left(trim(both '-' FROM regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')), 40);
  _slug text;
BEGIN
  IF _base = '' THEN _base := 'space'; END IF;
  _slug := _base;
  WHILE EXISTS (SELECT 1 FROM public.community_spaces WHERE slug = _slug) LOOP
    _slug := _base || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;
  RETURN _slug;
END;
$$;

REVOKE ALL ON FUNCTION public.unique_space_slug(text) FROM PUBLIC, anon, authenticated;

-- Add people to a space as members, skipping anyone banned or already in.
CREATE OR REPLACE FUNCTION public.add_space_members(p_space_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.community_space_members (space_id, user_id, role)
  SELECT p_space_id, u, 'member'
    FROM unnest(p_user_ids) AS u
   WHERE u IS NOT NULL AND NOT public.is_space_banned(p_space_id, u)
  ON CONFLICT (space_id, user_id) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION public.add_space_members(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- The space for a team, challenge or project; created on first use by the
-- person who runs it. Returns {slug, created}.
CREATE OR REPLACE FUNCTION public.open_linked_space(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _space public.community_spaces%ROWTYPE;
  _name text;
  _description text;
  _visibility text;
  _members uuid[];
  _allowed boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;

  IF p_kind = 'team' THEN
    SELECT * INTO _space FROM public.community_spaces WHERE team_id = p_id;
    SELECT t.name, coalesce(nullif(t.caption, ''), t.description, ''),
           EXISTS (SELECT 1 FROM public.team_members m
                    WHERE m.team_id = t.id AND m.profile_id = _uid AND m.role = 'lead')
      INTO _name, _description, _allowed
      FROM public.teams t WHERE t.id = p_id;
    _visibility := 'private';
    SELECT array_agg(profile_id) INTO _members FROM public.team_members WHERE team_id = p_id;
  ELSIF p_kind = 'challenge' THEN
    SELECT * INTO _space FROM public.community_spaces WHERE challenge_id = p_id;
    SELECT c.title, coalesce(c.description, ''), c.created_by = _uid
      INTO _name, _description, _allowed
      FROM public.challenges c WHERE c.id = p_id;
    _visibility := 'public';
    SELECT array_agg(user_id) INTO _members FROM public.challenge_participants WHERE challenge_id = p_id;
  ELSIF p_kind = 'project' THEN
    SELECT * INTO _space FROM public.community_spaces WHERE project_id = p_id;
    SELECT p.title, coalesce(p.description, ''), p.profile_id = _uid,
           CASE WHEN p.visibility = 'public' THEN 'public' ELSE 'private' END
      INTO _name, _description, _allowed, _visibility
      FROM public.projects p WHERE p.id = p_id;
    SELECT array_agg(profile_id) INTO _members FROM public.project_contributors WHERE project_id = p_id;
  ELSE
    RAISE EXCEPTION 'Unknown kind %', p_kind USING ERRCODE = '22023';
  END IF;

  IF _space.id IS NOT NULL THEN
    RETURN jsonb_build_object('slug', _space.slug, 'created', false);
  END IF;
  IF _name IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT coalesce(_allowed, false) THEN
    RAISE EXCEPTION 'Only the person who runs it can start its space' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.community_spaces
    (name, slug, description, join_type, visibility, created_by, rules, report_auto_dim_threshold,
     team_id, challenge_id, project_id)
  VALUES
    (left(_name, 80), public.unique_space_slug(_name), left(_description, 300),
     CASE WHEN _visibility = 'private' THEN 'review' ELSE 'auto' END, _visibility, _uid, '{}', 3,
     CASE WHEN p_kind = 'team' THEN p_id END,
     CASE WHEN p_kind = 'challenge' THEN p_id END,
     CASE WHEN p_kind = 'project' THEN p_id END)
  RETURNING * INTO _space;

  INSERT INTO public.community_space_members (space_id, user_id, role)
  VALUES (_space.id, _uid, 'owner');
  PERFORM public.add_space_members(_space.id, _members);

  RETURN jsonb_build_object('slug', _space.slug, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.open_linked_space(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_linked_space(text, uuid) TO authenticated;

-- ── Keep membership in step ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_linked_space_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _space_id uuid;
  _user uuid;
BEGIN
  IF TG_TABLE_NAME = 'team_members' THEN
    SELECT id INTO _space_id FROM public.community_spaces
     WHERE team_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END);
    _user := CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END;
  ELSIF TG_TABLE_NAME = 'challenge_participants' THEN
    SELECT id INTO _space_id FROM public.community_spaces
     WHERE challenge_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.challenge_id ELSE NEW.challenge_id END);
    _user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  ELSE
    SELECT id INTO _space_id FROM public.community_spaces
     WHERE project_id = (CASE WHEN TG_OP = 'DELETE' THEN OLD.project_id ELSE NEW.project_id END);
    _user := CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END;
  END IF;

  IF _space_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.add_space_members(_space_id, ARRAY[_user]);
    ELSE
      DELETE FROM public.community_space_members
       WHERE space_id = _space_id AND user_id = _user AND role <> 'owner';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_linked_space_membership() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_team_space ON public.team_members;
CREATE TRIGGER sync_team_space AFTER INSERT OR DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_linked_space_membership();
DROP TRIGGER IF EXISTS sync_challenge_space ON public.challenge_participants;
CREATE TRIGGER sync_challenge_space AFTER INSERT OR DELETE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_linked_space_membership();
DROP TRIGGER IF EXISTS sync_project_space ON public.project_contributors;
CREATE TRIGGER sync_project_space AFTER INSERT OR DELETE ON public.project_contributors
  FOR EACH ROW EXECUTE FUNCTION public.sync_linked_space_membership();
