-- Event-driven achievements: award badges from the database at the moment the
-- qualifying event happens, instead of only when the user next visits the
-- dashboard.
--
-- 1. award_earned_achievements() gains an optional p_profile_id argument
--    (defaults to auth.uid()) so AFTER-triggers can award for the row they
--    just wrote without depending on a session JWT. Keeping the default means
--    the client `rpc("award_earned_achievements")` call and the seed
--    `PERFORM public.award_earned_achievements()` calls keep working.
-- 2. A generic trigger function resolves the profile id from the triggering
--    row and re-runs the (idempotent) awarding. Triggers fire on project
--    publish, project joining, comments, community posts, endorsements,
--    team creation/joining, and accepted role applications.

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
  SELECT count(*) INTO v_project_count FROM public.projects WHERE profile_id = v_profile_id;
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

-- Generic trigger: resolve the affected profile from the triggering row and
-- re-award (idempotent — ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION public.trg_award_earned_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'projects' THEN v_profile_id := NEW.profile_id;
    WHEN 'comments' THEN v_profile_id := NEW.author_id;
    WHEN 'posts' THEN v_profile_id := NEW.author_id;
    WHEN 'project_contributors' THEN v_profile_id := NEW.profile_id;
    WHEN 'skill_endorsements' THEN v_profile_id := NEW.profile_id;
    WHEN 'teams' THEN v_profile_id := NEW.created_by;
    WHEN 'team_members' THEN v_profile_id := NEW.profile_id;
    WHEN 'project_role_applications' THEN v_profile_id := NEW.profile_id;
    ELSE NULL;
  END CASE;

  IF v_profile_id IS NOT NULL THEN
    PERFORM public.award_earned_achievements(v_profile_id);
  END IF;
  RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.trg_award_earned_achievements() FROM PUBLIC, anon, authenticated;

-- Award on project publish / join, comments, community posts, endorsements,
-- and team creation/joining. contribution_log-derived achievements (community
-- builder, milestone master) and derived ones (sessions, streaks) catch up on
-- the next recompute.
DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.projects;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.comments;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.posts;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.project_contributors;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.project_contributors
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.skill_endorsements;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.teams;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.team_members;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_award_earned_achievements();

DROP TRIGGER IF EXISTS trg_award_earned_achievements ON public.project_role_applications;
CREATE TRIGGER trg_award_earned_achievements AFTER INSERT OR UPDATE OF status ON public.project_role_applications
  FOR EACH ROW WHEN (NEW.status = 'accepted') EXECUTE FUNCTION public.trg_award_earned_achievements();

NOTIFY pgrst, 'reload schema';