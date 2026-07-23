-- Production hardening follow-up. This migration is deliberately forward-only:
-- existing production migration history must never be rewritten.

-- Reputation and achievements are derived data. Direct browser writes would let
-- users forge badges, timeline entries, and reputation totals.
DROP POLICY IF EXISTS "System can insert achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "System can insert contributions" ON public.contribution_log;

REVOKE ALL ON FUNCTION public.log_contribution(uuid, text, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Trigger functions call log_contribution internally. This function is the only
-- client-callable entry point and always operates on the authenticated user.
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
  v_contributor_count integer;
  v_community_posts integer;
  v_learning_starts integer;
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
  SELECT count(*) INTO v_contributor_count FROM public.project_contributors WHERE profile_id = v_profile_id;
  SELECT count(*) INTO v_community_posts FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'community_post_created';
  SELECT count(*) INTO v_learning_starts FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'learning_started';
  SELECT EXISTS(SELECT 1 FROM public.contribution_log
    WHERE profile_id = v_profile_id AND action = 'milestone_completed') INTO v_has_milestone;

  FOREACH v_achievement IN ARRAY ARRAY[
    CASE WHEN v_project_count >= 1 THEN 'first_project'::public.achievement_type END,
    CASE WHEN v_project_count >= 3 THEN 'project_builder'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 1 THEN 'first_endorsement'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 5 THEN 'five_endorsements'::public.achievement_type END,
    CASE WHEN v_endorsement_count >= 10 THEN 'ten_endorsements'::public.achievement_type END,
    CASE WHEN v_teach_count >= 5 THEN 'prolific_teacher'::public.achievement_type END,
    CASE WHEN v_contributor_count >= 1 THEN 'collaborator'::public.achievement_type END,
    CASE WHEN v_contributor_count >= 3 THEN 'helped_ten_people'::public.achievement_type END,
    CASE WHEN v_has_milestone THEN 'first_milestone'::public.achievement_type END,
    CASE WHEN v_community_posts >= 10 THEN 'community_builder'::public.achievement_type END,
    CASE WHEN v_learning_starts >= 3 THEN 'learner_journey'::public.achievement_type END,
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

-- Library files remain private. Owners can replace their own object and the
-- browser stores the object path, never a misleading public URL.
CREATE POLICY "Owner update library files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1]);
