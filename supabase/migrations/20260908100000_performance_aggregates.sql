-- Performance aggregation and matching
--
-- Keep high-cardinality counting and skill matching in Postgres so public
-- surfaces transfer only the rows they render instead of entire join tables.
-- All functions are additive and preserve the existing client response shapes.

CREATE OR REPLACE FUNCTION public.discussion_reply_counts(p_discussion_ids uuid[])
RETURNS TABLE (discussion_id uuid, reply_count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT dr.discussion_id, count(*)::bigint
  FROM public.discussion_replies dr
  WHERE dr.discussion_id = ANY(COALESCE(p_discussion_ids, '{}'::uuid[]))
  GROUP BY dr.discussion_id;
$$;

GRANT EXECUTE ON FUNCTION public.discussion_reply_counts(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.post_engagement_counts(p_post_ids uuid[])
RETURNS TABLE (
  post_id uuid,
  likes bigint,
  helpful bigint,
  saves bigint,
  offers bigint,
  comment_count bigint,
  user_actions text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH requested AS (
    SELECT DISTINCT post_id
    FROM unnest(COALESCE(p_post_ids, '{}'::uuid[])) AS input(post_id)
  ),
  action_counts AS (
    SELECT
      pa.post_id,
      count(*) FILTER (WHERE pa.action = 'like')::bigint AS likes,
      count(*) FILTER (WHERE pa.action = 'helpful')::bigint AS helpful,
      count(*) FILTER (WHERE pa.action = 'save')::bigint AS saves,
      count(*) FILTER (WHERE pa.action = 'offer')::bigint AS offers,
      COALESCE(
        array_agg(pa.action::text ORDER BY pa.action::text)
          FILTER (WHERE pa.user_id = auth.uid()),
        '{}'::text[]
      ) AS user_actions
    FROM public.post_actions pa
    JOIN requested r ON r.post_id = pa.post_id
    GROUP BY pa.post_id
  ),
  comment_counts AS (
    SELECT c.post_id, count(*)::bigint AS comment_count
    FROM public.comments c
    JOIN requested r ON r.post_id = c.post_id
    GROUP BY c.post_id
  )
  SELECT
    r.post_id,
    COALESCE(a.likes, 0),
    COALESCE(a.helpful, 0),
    COALESCE(a.saves, 0),
    COALESCE(a.offers, 0),
    COALESCE(c.comment_count, 0),
    COALESCE(a.user_actions, '{}'::text[])
  FROM requested r
  LEFT JOIN action_counts a ON a.post_id = r.post_id
  LEFT JOIN comment_counts c ON c.post_id = r.post_id;
$$;

GRANT EXECUTE ON FUNCTION public.post_engagement_counts(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trending_skills(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  category text,
  description text,
  usage_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH usage AS (
    SELECT skill_id FROM public.profile_skills_teach
    UNION ALL
    SELECT skill_id FROM public.profile_skills_learn
    UNION ALL
    SELECT skill_id FROM public.project_skills
  ), counts AS (
    SELECT skill_id, count(*)::bigint AS usage_count
    FROM usage
    GROUP BY skill_id
  )
  SELECT s.id, s.slug, s.name, s.category, s.description,
         COALESCE(c.usage_count, 0)::bigint
  FROM public.skills s
  LEFT JOIN counts c ON c.skill_id = s.id
  ORDER BY COALESCE(c.usage_count, 0) DESC, s.name COLLATE "C" ASC
  LIMIT GREATEST(COALESCE(p_limit, 100), 0);
$$;

GRANT EXECUTE ON FUNCTION public.trending_skills(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_projects(
  p_user_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  stage public.project_stage,
  looking_for_collaborators boolean,
  looking_for_feedback boolean,
  profile_id uuid,
  skill_ids uuid[],
  score integer,
  reasons text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH target AS (
    SELECT
      COALESCE((SELECT array_agg(skill_id) FROM public.profile_skills_learn WHERE profile_id = p_user_id), '{}'::uuid[]) AS learn_ids,
      COALESCE((SELECT array_agg(skill_id) FROM public.profile_skills_teach WHERE profile_id = p_user_id), '{}'::uuid[]) AS teach_ids
  ),
  project_data AS (
    SELECT
      p.id,
      p.title,
      p.description,
      p.stage,
      p.looking_for_collaborators,
      p.looking_for_feedback,
      p.profile_id,
      COALESCE(array_agg(ps.skill_id) FILTER (WHERE ps.skill_id IS NOT NULL), '{}'::uuid[]) AS skill_ids
    FROM public.projects p
    LEFT JOIN public.project_skills ps ON ps.project_id = p.id
    WHERE p.profile_id <> p_user_id
      AND p.visibility = 'public'
      AND p.stage IN ('planning', 'building', 'testing', 'launch', 'growing')
    GROUP BY p.id
  ), scored AS (
    SELECT
      pd.*,
      (
        COALESCE((SELECT sum(CASE WHEN sid = ANY(t.learn_ids) THEN 3 ELSE 0 END) FROM unnest(pd.skill_ids) sid), 0)
        + COALESCE((SELECT sum(CASE WHEN sid = ANY(t.teach_ids) THEN 1 ELSE 0 END) FROM unnest(pd.skill_ids) sid), 0)
        + CASE WHEN pd.looking_for_collaborators THEN 2 ELSE 0 END
        + CASE WHEN pd.looking_for_feedback THEN 1 ELSE 0 END
      )::integer AS score
    FROM project_data pd
    CROSS JOIN target t
  )
  SELECT
    s.id, s.title, s.description, s.stage, s.looking_for_collaborators,
    s.looking_for_feedback, s.profile_id, s.skill_ids, s.score,
    array_remove(ARRAY[
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(s.skill_ids) sid
        CROSS JOIN target t WHERE sid = ANY(t.learn_ids)
      ) THEN 'Matches your learning goals' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM unnest(s.skill_ids) sid
        CROSS JOIN target t WHERE sid = ANY(t.teach_ids)
      ) THEN 'Uses your skills' END,
      CASE WHEN s.looking_for_collaborators THEN 'Looking for collaborators' END,
      CASE WHEN s.looking_for_feedback THEN 'Looking for feedback' END
    ], NULL)::text[]
  FROM scored s
  WHERE auth.uid() = p_user_id
    AND s.score > 0
  ORDER BY s.score DESC, s.id
  LIMIT GREATEST(COALESCE(p_limit, 100), 0);
$$;

REVOKE ALL ON FUNCTION public.match_projects(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_projects(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.match_creators(
  p_user_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  handle text,
  display_name text,
  creator_title text,
  category text,
  avatar_url text,
  availability public.availability_status,
  languages text[],
  teach_skills jsonb,
  learn_skills jsonb,
  match_score integer,
  match_reasons text[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH target AS (
    SELECT
      COALESCE((SELECT array_agg(skill_id) FROM public.profile_skills_learn WHERE profile_id = p_user_id), '{}'::uuid[]) AS learn_ids,
      COALESCE((SELECT array_agg(skill_id) FROM public.profile_skills_teach WHERE profile_id = p_user_id), '{}'::uuid[]) AS teach_ids,
      COALESCE((SELECT languages FROM public.profiles WHERE id = p_user_id), '{}'::text[]) AS languages,
      (SELECT availability FROM public.profiles WHERE id = p_user_id) AS availability
  ),
  candidates AS (
    SELECT p.*
    FROM public.profiles p
    WHERE p.id <> p_user_id
      AND p.display_name IS NOT NULL
  ),
  scored AS (
    SELECT
      c.*,
      COALESCE((
        SELECT sum(
          (CASE pst.verification_level
            WHEN 'community_recognized' THEN 3
            WHEN 'proof_certified' THEN 2
            ELSE 1 END)
          + (CASE pst.experience_level
            WHEN 'expert' THEN 4
            WHEN 'advanced' THEN 3
            WHEN 'intermediate' THEN 2
            ELSE 1 END)
        ) * 3
        FROM public.profile_skills_teach pst
        CROSS JOIN target t
        WHERE pst.profile_id = c.id AND pst.skill_id = ANY(t.learn_ids)
      ), 0)::integer AS teach_score,
      COALESCE((
        SELECT count(*) * 2
        FROM public.profile_skills_learn psl
        CROSS JOIN target t
        WHERE psl.profile_id = c.id AND psl.skill_id = ANY(t.teach_ids)
      ), 0)::integer AS learn_score,
      (
        CASE WHEN c.availability IN ('available', 'looking_for_team') THEN 2 ELSE 0 END
        + CASE WHEN t.availability IN ('available', 'looking_for_team') THEN 1 ELSE 0 END
        + CASE WHEN c.availability = 'looking_for_team' AND t.availability = 'available' THEN 2 ELSE 0 END
      )::integer AS availability_score,
      COALESCE((
        SELECT count(*)
        FROM unnest(COALESCE(c.languages, '{}'::text[])) AS candidate(candidate_language)
        CROSS JOIN target t
        WHERE EXISTS (
          SELECT 1
          FROM unnest(COALESCE(t.languages, '{}'::text[])) AS target_language(language)
          WHERE lower(candidate.candidate_language) = lower(target_language.language)
        )
      ), 0)::integer AS language_score
    FROM candidates c
    CROSS JOIN target t
  ),
  enriched AS (
    SELECT
      s.*,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'skill_id', pst.skill_id,
          'name', sk.name,
          'category', sk.category,
          'experience_level', pst.experience_level,
          'verification_level', pst.verification_level
        ) ORDER BY sk.name)
        FROM public.profile_skills_teach pst
        JOIN public.skills sk ON sk.id = pst.skill_id
        WHERE pst.profile_id = s.id
      ), '[]'::jsonb) AS teach_skills,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'skill_id', psl.skill_id,
          'name', sk.name,
          'category', sk.category
        ) ORDER BY sk.name)
        FROM public.profile_skills_learn psl
        JOIN public.skills sk ON sk.id = psl.skill_id
        WHERE psl.profile_id = s.id
      ), '[]'::jsonb) AS learn_skills
    FROM scored s
  )
  SELECT
    e.id, e.handle, e.display_name, e.creator_title, e.category, e.avatar_url,
    e.availability, e.languages, e.teach_skills, e.learn_skills,
    (e.teach_score + e.learn_score + e.availability_score + e.language_score)::integer AS match_score,
    array_remove(ARRAY[
      CASE WHEN e.teach_score > 0 THEN 'Teaches skills you want to learn' END,
      CASE WHEN e.learn_score > 0 THEN 'Wants to learn skills you share' END,
      CASE WHEN e.availability_score > 0 THEN 'Available to collaborate' END,
      CASE WHEN e.language_score > 0 THEN 'Shares a language with you' END
    ], NULL)::text[] AS match_reasons
  FROM enriched e
  WHERE auth.uid() = p_user_id
    AND (e.teach_score + e.learn_score + e.availability_score + e.language_score) > 0
  ORDER BY match_score DESC, e.id
  LIMIT GREATEST(COALESCE(p_limit, 100), 0);
$$;

REVOKE ALL ON FUNCTION public.match_creators(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_creators(uuid, integer) TO authenticated;

-- Composite indexes keep the aggregate and cursor queries index-backed as the
-- catalog and activity tables grow.
CREATE INDEX IF NOT EXISTS discussion_replies_discussion_created_idx
  ON public.discussion_replies(discussion_id, created_at);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON public.comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS profile_skills_teach_profile_skill_idx
  ON public.profile_skills_teach(profile_id, skill_id);

CREATE INDEX IF NOT EXISTS profile_skills_teach_skill_profile_idx
  ON public.profile_skills_teach(skill_id, profile_id);

CREATE INDEX IF NOT EXISTS profile_skills_learn_profile_skill_idx
  ON public.profile_skills_learn(profile_id, skill_id);

CREATE INDEX IF NOT EXISTS profile_skills_learn_skill_profile_idx
  ON public.profile_skills_learn(skill_id, profile_id);

CREATE INDEX IF NOT EXISTS project_skills_project_skill_idx
  ON public.project_skills(project_id, skill_id);

CREATE INDEX IF NOT EXISTS project_skills_skill_project_idx
  ON public.project_skills(skill_id, project_id);

CREATE INDEX IF NOT EXISTS projects_visibility_stage_created_idx
  ON public.projects(visibility, stage, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS profiles_updated_id_idx
  ON public.profiles(updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS follows_follower_created_idx
  ON public.follows(follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS session_participants_profile_session_idx
  ON public.session_participants(profile_id, session_id);

-- The snapshot trigger makes this a selective, index-backed report lookup.
CREATE INDEX IF NOT EXISTS post_reports_space_snapshot_status_idx
  ON public.post_reports(space_id_snapshot, status, created_at DESC);

CREATE INDEX IF NOT EXISTS post_actions_post_action_idx
  ON public.post_actions(post_id, action);

-- Repair rows created before snapshotting was added.
UPDATE public.post_reports r
SET space_id_snapshot = p.space_id,
    post_title_snapshot = COALESCE(r.post_title_snapshot, p.title)
FROM public.posts p
WHERE r.post_id = p.id
  AND (r.space_id_snapshot IS NULL OR r.post_title_snapshot IS NULL);

NOTIFY pgrst, 'reload schema';
