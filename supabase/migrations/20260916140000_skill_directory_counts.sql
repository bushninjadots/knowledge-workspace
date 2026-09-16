-- Browsable skill directory: distinct profile counts per skill.
--
-- The directory page groups the public skills catalog by category and shows,
-- for each skill, how many people teach or learn it. Unlike trending_skills
-- (which counts rows), this counts DISTINCT profiles across the teach and
-- learn tables so a person who both teaches and learns a skill counts once.

CREATE OR REPLACE FUNCTION public.skill_profile_counts(p_skill_ids uuid[] DEFAULT NULL)
RETURNS TABLE (skill_id uuid, profile_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH usage AS (
    SELECT skill_id, profile_id FROM public.profile_skills_teach
    UNION
    SELECT skill_id, profile_id FROM public.profile_skills_learn
  ), counts AS (
    SELECT skill_id, count(DISTINCT profile_id)::bigint AS profile_count
    FROM usage
    WHERE p_skill_ids IS NULL OR skill_id = ANY(p_skill_ids)
    GROUP BY skill_id
  )
  SELECT s.id AS skill_id, COALESCE(c.profile_count, 0)::bigint AS profile_count
  FROM public.skills s
  LEFT JOIN counts c ON c.skill_id = s.id
  WHERE p_skill_ids IS NULL OR s.id = ANY(p_skill_ids)
  ORDER BY s.name COLLATE "C" ASC;
$$;

GRANT EXECUTE ON FUNCTION public.skill_profile_counts(uuid[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';