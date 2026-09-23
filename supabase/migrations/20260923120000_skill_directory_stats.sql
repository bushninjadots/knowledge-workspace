-- Per-skill activity stats for the /skills discovery directory and the skill
-- hub page: distinct sharing profiles, distinct growing profiles, distinct
-- projects using the skill, and open project needs (opportunities) for it.
--
-- Supersedes skill_profile_counts (20260916140000), which merged teach + learn
-- into a single "how many people" number. The directory and hub now need the
-- relationship broken out so a skill reads as "18 sharing · 11 growing ·
-- 7 projects" instead of "29 people". Nothing outside /skills consumed the
-- merged count, so the old function is dropped rather than left to drift.
--
-- SECURITY INVOKER, STABLE: reads only tables a visitor can already read
-- (teach / learn / project_skills / project_needs are world-readable for
-- visible projects), so anon and authenticated callers get identical numbers.
-- Counts are DISTINCT where the unit is a person (a profile may share and
-- grow the same skill without being double-counted) and per-row otherwise
-- (projects, needs). Skills with no activity still appear with zeros so the
-- directory can render the whole catalog from one call.

CREATE OR REPLACE FUNCTION public.skill_directory_stats(p_skill_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  skill_id      uuid,
  sharing_count bigint,
  growing_count bigint,
  project_count bigint,
  need_count    bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sharing AS (
    SELECT skill_id, count(DISTINCT profile_id) AS c
    FROM public.profile_skills_teach
    GROUP BY skill_id
  ), growing AS (
    SELECT skill_id, count(DISTINCT profile_id) AS c
    FROM public.profile_skills_learn
    GROUP BY skill_id
  ), projects AS (
    SELECT skill_id, count(DISTINCT project_id) AS c
    FROM public.project_skills
    GROUP BY skill_id
  ), needs AS (
    SELECT skill_id, count(*) AS c
    FROM public.project_needs
    WHERE NOT is_filled AND skill_id IS NOT NULL
    GROUP BY skill_id
  )
  SELECT s.id AS skill_id,
         COALESCE(sh.c, 0)::bigint,
         COALESCE(gr.c, 0)::bigint,
         COALESCE(pj.c, 0)::bigint,
         COALESCE(nd.c, 0)::bigint
  FROM public.skills s
  LEFT JOIN sharing sh ON sh.skill_id = s.id
  LEFT JOIN growing gr ON gr.skill_id = s.id
  LEFT JOIN projects pj ON pj.skill_id = s.id
  LEFT JOIN needs nd ON nd.skill_id = s.id
  WHERE p_skill_ids IS NULL OR s.id = ANY(p_skill_ids)
  ORDER BY s.name COLLATE "C" ASC;
$$;

DROP FUNCTION IF EXISTS public.skill_profile_counts(uuid[]);

GRANT EXECUTE ON FUNCTION public.skill_directory_stats(uuid[]) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';