-- Project forking — opt-in derivation with visible lineage.
--
-- A fork is a copy of a project, owned by the person who forked it and started
-- as a private draft so they can build it their own way before publishing.
-- Forks carry a recorded parent (forked_from_project_id) so the project page
-- can attribute the original, and they are deliberately excluded from
-- achievement scoring: a fork is built on someone else's work, so it must not
-- count as the forker's own first project.

-- 1. Fork columns on projects.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS allow_forks boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forked_from_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.projects.allow_forks IS 'Owner opt-in: whether others may fork this project.';
COMMENT ON COLUMN public.projects.forked_from_project_id IS 'The project this one was forked from, if any.';
COMMENT ON COLUMN public.projects.fork_count IS 'How many times this project has been forked.';

CREATE INDEX IF NOT EXISTS projects_forked_from_idx ON public.projects (forked_from_project_id);

-- 2. fork_project — copy a project's content into a private draft owned by the
--    caller, record the lineage, and bump the parent's fork count. SECURITY
--    DEFINER because it writes a row owned by the caller and reads the parent
--    regardless of the caller's row access; the permission checks below are the
--    only gate, so they must stay strict.
CREATE OR REPLACE FUNCTION public.fork_project(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF v_parent.visibility = 'private' THEN
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
$$;

COMMENT ON FUNCTION public.fork_project IS 'Fork a project into a private draft owned by the caller.';

-- SECURITY DEFINER + a fresh function means Supabase's default privileges
-- would hand EXECUTE to anon; revoke it explicitly (see anon_execute_grants).
REVOKE ALL ON FUNCTION public.fork_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fork_project(uuid) TO authenticated, service_role;

-- 3. Exclude forks from achievement scoring. Recreated in full because the
--    project count is computed inside the function; the only change is the
--    `forked_from_project_id IS NULL` guard on v_project_count.
DROP FUNCTION IF EXISTS public.award_earned_achievements();

CREATE OR REPLACE FUNCTION public.award_earned_achievements(p_profile_id uuid DEFAULT NULL)
RETURNS SETOF public.achievement_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := COALESCE(p_profile_id, auth.uid());
  v_created_at timestamptz;
  v_project_count integer;
  v_endorsement_count integer;
  v_teach_count integer;
  v_learn_count integer;
  v_contributor_count integer;
  v_community_posts integer;
  v_milestones integer;
  v_comments integer;
  v_offers integer;
  v_teams_created integer;
  v_teams_joined integer;
  v_roles_filled integer;
  v_has_milestone boolean;
  v_session_count integer;
  v_teach_session_count integer;
  v_streak_weeks integer;
  v_achievement public.achievement_type;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT created_at INTO v_created_at FROM public.profiles WHERE id = v_profile_id;
  -- Forks don't count: a project you forked from someone else is not a project
  -- you built, so it must not earn first_project / project_builder.
  SELECT count(*) INTO v_project_count FROM public.projects
    WHERE profile_id = v_profile_id AND forked_from_project_id IS NULL;
  SELECT count(*) INTO v_endorsement_count FROM public.skill_endorsements WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_teach_count FROM public.profile_skills_teach WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_learn_count FROM public.profile_skills_learn WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_contributor_count FROM public.project_contributors WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_community_posts FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'community_post_created';
  SELECT count(*) INTO v_milestones FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'milestone_completed';
  SELECT count(*) INTO v_comments FROM public.comments WHERE author_id = v_profile_id;
  SELECT count(*) INTO v_offers FROM public.post_actions
    WHERE user_id = v_profile_id AND action = 'offer';
  SELECT count(*) INTO v_teams_created FROM public.teams WHERE created_by = v_profile_id;
  SELECT count(*) INTO v_teams_joined FROM public.team_members
    WHERE profile_id = v_profile_id AND role <> 'lead';
  SELECT count(*) INTO v_roles_filled FROM public.project_role_applications
    WHERE profile_id = v_profile_id AND status = 'accepted';
  SELECT EXISTS(SELECT 1 FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'milestone_completed') INTO v_has_milestone;

  -- Session counts
  SELECT count(*) INTO v_session_count
  FROM public.session_participants sp
  JOIN public.sessions s ON s.id = sp.session_id
  WHERE sp.profile_id = v_profile_id
    AND sp.status = 'accepted'
    AND s.status = 'completed';

  SELECT count(*) INTO v_teach_session_count
  FROM public.session_participants sp
  JOIN public.sessions s ON s.id = sp.session_id
  WHERE sp.profile_id = v_profile_id
    AND sp.role = 'organizer'
    AND sp.status = 'accepted'
    AND s.status = 'completed';

  -- Streak: count consecutive weeks with at least one activity
  WITH weekly_activity AS (
    SELECT DISTINCT date_trunc('week', created_at) AS week
    FROM public.contribution_log WHERE profile_id = v_profile_id
    UNION
    SELECT DISTINCT date_trunc('week', s.starts_at) AS week
    FROM public.session_participants sp
    JOIN public.sessions s ON s.id = sp.session_id
    WHERE sp.profile_id = v_profile_id AND s.status = 'completed'
  ),
  streak AS (
    SELECT count(*) AS consecutive_weeks
    FROM (
      SELECT week,
        week - (row_number() OVER (ORDER BY week DESC) || ' weeks')::interval AS gap
      FROM weekly_activity
    ) sub
    WHERE sub.gap = (SELECT max(gap) FROM (
      SELECT week - (row_number() OVER (ORDER BY week DESC) || ' weeks')::interval AS gap
      FROM weekly_activity
    ) g)
  )
  SELECT COALESCE(consecutive_weeks, 0) INTO v_streak_weeks FROM streak;

  FOREACH v_achievement IN ARRAY ARRAY[
    CASE WHEN v_project_count >= 1 THEN 'first_project'::public.achievement_type END,
    CASE WHEN v_project_count >= 3 THEN 'project_builder'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 1 THEN 'first_endorsement'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 5 THEN 'five_endorsements'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 10 THEN 'ten_endorsements'::public.achievement_type END,
    CASE WHEN v_teach_count >= 5 THEN 'prolific_teacher'::public.achievement_type END,
    CASE WHEN v_learn_count >= 3 THEN 'learner_journey'::public.achievement_type END,
    CASE WHEN v_contributor_count >= 1 THEN 'collaborator'::public.achievement_type END,
    CASE WHEN v_contributor_count >= 3 THEN 'helped_ten_people'::public.achievement_type END,
    CASE WHEN v_has_milestone THEN 'first_milestone'::public.achievement_type END,
    CASE WHEN v_milestones >= 3 THEN 'milestone_master'::public.achievement_type END,
    CASE WHEN v_community_posts >= 10 THEN 'community_builder'::public.achievement_type END,
    CASE WHEN v_comments >= 1 THEN 'conversation_starter'::public.achievement_type END,
    CASE WHEN v_offers >= 1 THEN 'helping_hand'::public.achievement_type END,
    CASE WHEN v_teams_created >= 1 THEN 'crew_founder'::public.achievement_type END,
    CASE WHEN v_teams_joined >= 1 THEN 'team_player'::public.achievement_type END,
    CASE WHEN v_roles_filled >= 1 THEN 'role_filler'::public.achievement_type END,
    CASE WHEN v_created_at <= now() - interval '30 days' THEN 'reliable_collaborator'::public.achievement_type END,
    CASE WHEN v_session_count >= 1 THEN 'first_session'::public.achievement_type END,
    CASE WHEN v_teach_session_count >= 5 THEN 'session_teacher'::public.achievement_type END,
    CASE WHEN v_streak_weeks >= 4 THEN 'streak_4_weeks'::public.achievement_type END
  ]
  LOOP
    IF v_achievement IS NOT NULL THEN
      INSERT INTO public.user_achievements (profile_id, achievement)
      VALUES (v_profile_id, v_achievement)
      ON CONFLICT (profile_id, achievement) DO NOTHING;
      IF FOUND THEN RETURN NEXT v_achievement; END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.award_earned_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_earned_achievements(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
