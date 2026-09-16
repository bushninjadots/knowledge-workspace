-- Reconcile achievements against live state (issue #16).
--
-- The awarding path is additive-only: award_earned_achievements() inserts on
-- conflict-do-nothing and never removes a badge, so deleting a project, post,
-- or membership leaves a stale badge behind ("I built N projects" with none).
--
-- This migration adds the complement: a per-profile reconcile function that
-- recomputes eligibility from live rows, DELETEs any recomputable badge that
-- no longer qualifies, and re-inserts the qualifying set. AFTER DELETE
-- (and status-downgrade) triggers on every source table call it, so revoking
-- state revokes the badge.
--
-- community_recognized and mentor are NOT recomputable: they are never written
-- to user_achievements (they are skill-endorsement and contributor-role
-- values), so they are left out of the recomputable set entirely.

-- 1. Reconcile function ------------------------------------------------------
-- Mirrors the counts in award_earned_achievements() plus challenge wins.
CREATE OR REPLACE FUNCTION public.reconcile_user_achievements(p_profile_id uuid DEFAULT NULL)
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
  v_challenge_wins integer;
  r_recomputable public.achievement_type[] := ARRAY[
    'first_project'::public.achievement_type, 'project_builder'::public.achievement_type,
    'first_endorsement'::public.achievement_type, 'five_endorsements'::public.achievement_type,
    'ten_endorsements'::public.achievement_type, 'prolific_teacher'::public.achievement_type,
    'learner_journey'::public.achievement_type, 'collaborator'::public.achievement_type,
    'helped_ten_people'::public.achievement_type, 'first_milestone'::public.achievement_type,
    'milestone_master'::public.achievement_type, 'community_builder'::public.achievement_type,
    'conversation_starter'::public.achievement_type, 'helping_hand'::public.achievement_type,
    'crew_founder'::public.achievement_type, 'team_player'::public.achievement_type,
    'role_filler'::public.achievement_type, 'reliable_collaborator'::public.achievement_type,
    'first_session'::public.achievement_type, 'session_teacher'::public.achievement_type,
    'streak_4_weeks'::public.achievement_type, 'challenge_winner'::public.achievement_type
  ];
  r_eligible public.achievement_type[];
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

  SELECT count(*) INTO v_challenge_wins
  FROM public.challenge_participants
  WHERE user_id = v_profile_id AND review_status = 'passed';

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

  r_eligible := ARRAY[
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
    CASE WHEN v_streak_weeks >= 4 THEN 'streak_4_weeks'::public.achievement_type END,
    CASE WHEN v_challenge_wins >= 1 THEN 'challenge_winner'::public.achievement_type END
  ];

  -- Revoke recomputable badges that no longer qualify (never touches the
  -- non-recomputable community_recognized / mentor rows).
  DELETE FROM public.user_achievements
  WHERE profile_id = v_profile_id
    AND achievement = ANY(r_recomputable)
    AND achievement <> ALL(array_remove(r_eligible, NULL));

  FOREACH v_achievement IN ARRAY r_eligible
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

REVOKE ALL ON FUNCTION public.reconcile_user_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_user_achievements(uuid) TO authenticated;

-- 2. DELETE-aware trigger ------------------------------------------------------
-- Resolves the affected profile from NEW (insert/update) or OLD (delete) and
-- reconciles. The awarder trigger remains the only INSERT path; this fires on
-- deletes and on non-accepted status transitions.
CREATE OR REPLACE FUNCTION public.trg_reconcile_user_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    CASE TG_TABLE_NAME
      WHEN 'projects' THEN v_profile_id := OLD.profile_id;
      WHEN 'comments' THEN v_profile_id := OLD.author_id;
      WHEN 'posts' THEN v_profile_id := OLD.author_id;
      WHEN 'project_contributors' THEN v_profile_id := OLD.profile_id;
      WHEN 'skill_endorsements' THEN v_profile_id := OLD.profile_id;
      WHEN 'teams' THEN v_profile_id := OLD.created_by;
      WHEN 'team_members' THEN v_profile_id := OLD.profile_id;
      WHEN 'project_role_applications' THEN v_profile_id := OLD.profile_id;
      WHEN 'challenge_participants' THEN v_profile_id := OLD.user_id;
      WHEN 'session_participants' THEN v_profile_id := OLD.profile_id;
      ELSE NULL;
    END CASE;
  ELSE
    CASE TG_TABLE_NAME
      WHEN 'projects' THEN v_profile_id := NEW.profile_id;
      WHEN 'comments' THEN v_profile_id := NEW.author_id;
      WHEN 'posts' THEN v_profile_id := NEW.author_id;
      WHEN 'project_contributors' THEN v_profile_id := NEW.profile_id;
      WHEN 'skill_endorsements' THEN v_profile_id := NEW.profile_id;
      WHEN 'teams' THEN v_profile_id := NEW.created_by;
      WHEN 'team_members' THEN v_profile_id := NEW.profile_id;
      WHEN 'project_role_applications' THEN v_profile_id := NEW.profile_id;
      WHEN 'challenge_participants' THEN v_profile_id := NEW.user_id;
      WHEN 'session_participants' THEN v_profile_id := NEW.profile_id;
      ELSE NULL;
    END CASE;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    PERFORM public.reconcile_user_achievements(v_profile_id);
  END IF;
  RETURN NULL;
END; $$;

REVOKE ALL ON FUNCTION public.trg_reconcile_user_achievements() FROM PUBLIC, anon, authenticated;

-- Revoke on delete / downgrade. The awarder trigger stays the only INSERT path
-- (harmless overlap on project_role_applications INSERT is idempotent).
DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.projects;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.comments;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.posts;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.project_contributors;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.project_contributors
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.skill_endorsements;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.teams;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.team_members;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.project_role_applications;
CREATE TRIGGER trg_reconcile_user_achievements AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.project_role_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.challenge_participants;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.challenge_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

DROP TRIGGER IF EXISTS trg_reconcile_user_achievements ON public.session_participants;
CREATE TRIGGER trg_reconcile_user_achievements AFTER DELETE ON public.session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_reconcile_user_achievements();

-- 3. Project pages cleanup -----------------------------------------------------
-- pages.owner_id has no FK to projects, so deleting a project orphaned its
-- page. Clean it up when the project goes away.
CREATE OR REPLACE FUNCTION public.trg_cleanup_project_pages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pages WHERE owner_type = 'project' AND owner_id = OLD.id;
  RETURN OLD;
END; $$;

REVOKE ALL ON FUNCTION public.trg_cleanup_project_pages() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cleanup_project_pages ON public.projects;
CREATE TRIGGER trg_cleanup_project_pages AFTER DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_cleanup_project_pages();

NOTIFY pgrst, 'reload schema';