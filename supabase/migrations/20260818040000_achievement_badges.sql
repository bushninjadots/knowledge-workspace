-- Add achievement badges that reflect the core Tethyr loop
-- (build → collaborate → become known) and fix the badge-award logic.
--
-- New badges:
--   crew_founder          — formed a crew
--   team_player           — joined a crew as contributor/core
--   milestone_master      — completed 3+ milestones
--   helping_hand          — offered help on a request
--   conversation_starter  — posted a first comment
--   role_filler           — accepted into an open role
--
-- Also fixes `learner_journey`, which previously counted contribution_log
-- entries with action 'learning_started' — an action nothing ever writes —
-- so the badge could never be awarded. It now counts the skills the user is
-- actually growing (profile_skills_learn).

ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'crew_founder';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'team_player';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'milestone_master';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'helping_hand';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'conversation_starter';
ALTER TYPE public.achievement_type ADD VALUE IF NOT EXISTS 'role_filler';

CREATE OR REPLACE FUNCTION public.award_earned_achievements()
RETURNS SETOF public.achievement_type
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := auth.uid();
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
    CASE WHEN v_created_at <= now() - interval '30 days' THEN 'reliable_collaborator'::public.achievement_type END
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

REVOKE ALL ON FUNCTION public.award_earned_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_earned_achievements() TO authenticated;
