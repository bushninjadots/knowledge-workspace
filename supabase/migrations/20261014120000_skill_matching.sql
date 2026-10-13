-- Matching: when someone asks for help (question, help or feedback request)
-- or looks for people (collaboration request, open role) and tags skills,
-- tell a few members who share those skills (profile_skills_teach), so asks
-- reach people who can answer instead of waiting to be scrolled past.
--
-- Limits, so it stays useful rather than noisy:
--   * at most 5 people per post, never the author;
--   * at most 3 skill_match notifications per person per day;
--   * a post in a private space only reaches that space's members;
--   * stronger signals first (verified skills, then endorsements), with a
--     random tiebreak so the same people aren't always picked.

CREATE OR REPLACE FUNCTION public.notify_skill_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _private boolean := false;
  _space_slug text;
  _actor text;
  _match record;
  _is_people boolean := NEW.type IN ('collaboration_request', 'open_role');
BEGIN
  IF coalesce(array_length(NEW.skills, 1), 0) = 0 THEN RETURN NULL; END IF;

  IF NEW.space_id IS NOT NULL THEN
    SELECT visibility = 'private', slug INTO _private, _space_slug
      FROM public.community_spaces WHERE id = NEW.space_id;
  END IF;
  SELECT coalesce(display_name, handle, 'Someone') INTO _actor
    FROM public.profiles WHERE id = NEW.author_id;

  FOR _match IN
    SELECT m.profile_id, m.skill_name
      FROM (
        SELECT DISTINCT ON (t.profile_id)
               t.profile_id, sk.name AS skill_name,
               (coalesce(t.verification_level::text, 'self_declared') <> 'self_declared') AS verified,
               (SELECT count(*) FROM public.skill_endorsements e
                 WHERE e.profile_id = t.profile_id AND e.skill_id = sk.id) AS endorsements
          FROM public.skills sk
          JOIN public.profile_skills_teach t ON t.skill_id = sk.id
         WHERE sk.slug = ANY (NEW.skills)
           AND t.profile_id <> NEW.author_id
           AND (NOT _private OR public.is_space_member(NEW.space_id, t.profile_id))
           AND (SELECT count(*) FROM public.notifications n
                 WHERE n.user_id = t.profile_id AND n.type = 'skill_match'
                   AND n.created_at > now() - interval '1 day') < 3
         ORDER BY t.profile_id, array_position(NEW.skills, sk.slug)
      ) m
     ORDER BY m.verified DESC, m.endorsements DESC, random()
     LIMIT 5
  LOOP
    PERFORM public.insert_notification(
      _match.profile_id, NEW.author_id, 'skill_match',
      CASE WHEN _is_people
        THEN _actor || ' is looking for someone with ' || _match.skill_name
        ELSE _actor || ' needs a hand with ' || _match.skill_name END,
      left(NEW.title, 200), 'post', NEW.id,
      jsonb_build_object('post_title', NEW.title, 'skill_name', _match.skill_name,
                         'space_slug', _space_slug));
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_skill_matches() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_skill_matches ON public.posts;
CREATE TRIGGER notify_skill_matches
  AFTER INSERT ON public.posts
  FOR EACH ROW
  WHEN (NEW.type IN ('question', 'help_request', 'feedback_request',
                     'collaboration_request', 'open_role'))
  EXECUTE FUNCTION public.notify_skill_matches();
