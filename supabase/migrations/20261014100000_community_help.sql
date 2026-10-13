-- Community help that counts: asks get a solution picked by the person who
-- asked, replies can be thanked with a reason, and both roll up into a public
-- help summary on the helper's profile.
--
-- 1. Solutions. `comments.is_best_answer` existed but nothing could set it
--    honestly: the only UPDATE policy is "authors update their own comments",
--    which let a replier mark their *own* reply as the answer and stopped the
--    asker from marking anything. Column privileges now limit direct writes to
--    `body`; the flag is set only through mark_solution(), by the post author.
-- 2. Thanks (community_kudos): one per person per reply, with a short reason,
--    written through thank_reply() so the recipient is always the reply's
--    author and nobody thanks themselves.
-- 3. community_help_summary(profile): solutions, thanks, people helped, the
--    skills it was for and recent thanks — counted only on posts anyone can
--    see (no space, or a public space), so private rooms never leak.
-- Also: comments now follow their post's visibility (they were readable by
-- everyone even inside private spaces).

-- ── Comments: visibility follows the post; only `body` is directly writable ──
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable with their post" ON public.comments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id));

REVOKE INSERT, UPDATE ON public.comments FROM anon, authenticated;
GRANT INSERT (post_id, author_id, body, parent_id) ON public.comments TO authenticated;
GRANT UPDATE (body) ON public.comments TO authenticated;

-- Kinds of post that ask for something and can be marked solved.
CREATE OR REPLACE FUNCTION public.post_type_is_ask(p_type public.post_type)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$ SELECT p_type IN ('question', 'help_request', 'feedback_request') $$;

REVOKE ALL ON FUNCTION public.post_type_is_ask(public.post_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_type_is_ask(public.post_type) TO authenticated;

-- ── Solutions ──────────────────────────────────────────────────────────────
-- Mark (or, with p_on = false, unmark) a reply as the solution to an ask.
-- One solution per post; only the post's author may choose it.
CREATE OR REPLACE FUNCTION public.mark_solution(p_comment_id uuid, p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _post public.posts%ROWTYPE;
  _comment public.comments%ROWTYPE;
  _actor text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _comment FROM public.comments WHERE id = p_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reply not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO _post FROM public.posts WHERE id = _comment.post_id;
  IF _post.author_id IS DISTINCT FROM _uid THEN
    RAISE EXCEPTION 'Only the person who asked can pick the solution' USING ERRCODE = '42501';
  END IF;
  IF NOT public.post_type_is_ask(_post.type) THEN
    RAISE EXCEPTION 'Only questions and requests for help or feedback have solutions'
      USING ERRCODE = '22023';
  END IF;
  IF _comment.author_id = _uid AND p_on THEN
    RAISE EXCEPTION 'Pick someone else''s reply as the solution' USING ERRCODE = '22023';
  END IF;

  UPDATE public.comments SET is_best_answer = false
   WHERE post_id = _post.id AND is_best_answer AND id <> p_comment_id;
  UPDATE public.comments SET is_best_answer = p_on WHERE id = p_comment_id;

  IF p_on AND NOT _comment.is_best_answer THEN
    SELECT COALESCE(display_name, handle) INTO _actor FROM public.profiles WHERE id = _uid;
    PERFORM public.insert_notification(
      _comment.author_id, _uid, 'solution',
      COALESCE(_actor, 'Someone') || ' marked your reply as the solution',
      left(_post.title, 200), 'post', _post.id,
      jsonb_build_object('post_title', _post.title, 'comment_id', _comment.id,
        'space_slug', (SELECT slug FROM public.community_spaces WHERE id = _post.space_id)));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_solution(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_solution(uuid, boolean) TO authenticated;

-- ── Thanks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_kudos_not_self CHECK (giver_id <> recipient_id),
  CONSTRAINT community_kudos_once UNIQUE (giver_id, comment_id)
);

CREATE INDEX IF NOT EXISTS community_kudos_recipient_idx
  ON public.community_kudos (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_kudos_comment_idx ON public.community_kudos (comment_id);
CREATE INDEX IF NOT EXISTS community_kudos_post_idx ON public.community_kudos (post_id);

ALTER TABLE public.community_kudos ENABLE ROW LEVEL SECURITY;

-- Readable wherever the post is readable. Written only through thank_reply();
-- givers may take their own thanks back.
CREATE POLICY "Thanks are visible with their post" ON public.community_kudos
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = community_kudos.post_id));
CREATE POLICY "Givers can take back their thanks" ON public.community_kudos
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = giver_id);

REVOKE ALL ON public.community_kudos FROM anon, authenticated;
GRANT SELECT ON public.community_kudos TO anon, authenticated;
GRANT DELETE ON public.community_kudos TO authenticated;

-- Thank a reply's author, with a short reason. Re-thanking the same reply
-- updates the reason instead of adding a second thanks.
CREATE OR REPLACE FUNCTION public.thank_reply(p_comment_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _comment public.comments%ROWTYPE;
  _title text;
  _space_slug text;
  _reason text := btrim(coalesce(p_reason, ''));
  _id uuid;
  _fresh boolean;
  _actor text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _comment FROM public.comments WHERE id = p_comment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reply not found' USING ERRCODE = 'P0002'; END IF;
  -- The caller must be able to see the post (same rule as the posts policy).
  SELECT p.title, s2.slug INTO _title, _space_slug
    FROM public.posts p LEFT JOIN public.community_spaces s2 ON s2.id = p.space_id
   WHERE p.id = _comment.post_id
     AND (p.space_id IS NULL OR EXISTS (
       SELECT 1 FROM public.community_spaces s
        WHERE s.id = p.space_id
          AND (s.visibility = 'public' OR s.created_by = _uid OR public.is_space_member(s.id, _uid))));
  IF NOT FOUND THEN RAISE EXCEPTION 'Reply not found' USING ERRCODE = 'P0002'; END IF;
  IF _comment.author_id = _uid THEN
    RAISE EXCEPTION 'You can''t thank yourself' USING ERRCODE = '22023';
  END IF;
  IF char_length(_reason) NOT BETWEEN 3 AND 140 THEN
    RAISE EXCEPTION 'Say what helped in 3 to 140 characters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.community_kudos (giver_id, recipient_id, post_id, comment_id, reason)
  VALUES (_uid, _comment.author_id, _comment.post_id, _comment.id, _reason)
  ON CONFLICT ON CONSTRAINT community_kudos_once DO UPDATE SET reason = EXCLUDED.reason
  RETURNING id, (xmax = 0) INTO _id, _fresh;

  IF _fresh THEN
    SELECT COALESCE(display_name, handle) INTO _actor FROM public.profiles WHERE id = _uid;
    PERFORM public.insert_notification(
      _comment.author_id, _uid, 'thanks',
      COALESCE(_actor, 'Someone') || ' thanked you',
      _reason, 'post', _comment.post_id,
      jsonb_build_object('post_title', _title, 'comment_id', _comment.id, 'reason', _reason,
        'space_slug', _space_slug));
  END IF;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.thank_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.thank_reply(uuid, text) TO authenticated;

-- ── Help summary for profiles ─────────────────────────────────────────────
-- Public by design (it is profile content), so it counts only posts that are
-- public: outside any space, or in a public space. SECURITY INVOKER: every row
-- it reads is one a signed-out visitor can already read, so it needs no
-- elevated rights (and stays on the anon allowlist as a plain read RPC).
CREATE OR REPLACE FUNCTION public.community_help_summary(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  WITH public_posts AS (
    SELECT p.id, p.author_id, p.title, p.skills
      FROM public.posts p
      LEFT JOIN public.community_spaces s ON s.id = p.space_id
     WHERE p.space_id IS NULL OR s.visibility = 'public'
  ),
  solved AS (
    SELECT DISTINCT c.post_id
      FROM public.comments c JOIN public_posts pp ON pp.id = c.post_id
     WHERE c.author_id = p_profile_id AND c.is_best_answer AND pp.author_id <> p_profile_id
  ),
  thanks AS (
    SELECT k.* FROM public.community_kudos k JOIN public_posts pp ON pp.id = k.post_id
     WHERE k.recipient_id = p_profile_id
  ),
  helped_posts AS (
    SELECT post_id FROM solved UNION SELECT post_id FROM thanks
  ),
  skill_counts AS (
    SELECT sk AS slug, count(*) AS n
      FROM helped_posts h JOIN public_posts pp ON pp.id = h.post_id, unnest(pp.skills) sk
     GROUP BY sk ORDER BY n DESC, sk LIMIT 6
  )
  SELECT jsonb_build_object(
    'solutions', (SELECT count(*) FROM solved),
    'thanks', (SELECT count(*) FROM thanks),
    'people_helped', (
      SELECT count(DISTINCT pp.author_id) FROM helped_posts h JOIN public_posts pp ON pp.id = h.post_id
       WHERE pp.author_id <> p_profile_id),
    'skills', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('slug', sc.slug, 'name', COALESCE(sk.name, sc.slug), 'count', sc.n)
                       ORDER BY sc.n DESC, sc.slug)
        FROM skill_counts sc LEFT JOIN public.skills sk ON sk.slug = sc.slug), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(r ORDER BY r->>'created_at' DESC) FROM (
        SELECT jsonb_build_object(
          'reason', t.reason, 'created_at', t.created_at, 'post_id', t.post_id,
          'post_title', pp.title,
          'from_name', COALESCE(pr.display_name, pr.handle), 'from_handle', pr.handle) AS r
          FROM thanks t
          JOIN public_posts pp ON pp.id = t.post_id
          LEFT JOIN public.profiles pr ON pr.id = t.giver_id
         ORDER BY t.created_at DESC LIMIT 5) x), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.community_help_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_help_summary(uuid) TO anon, authenticated;

-- ── Feed stats carry "solved" ─────────────────────────────────────────────
-- post_engagement_counts gains a `solved` column (an ask has a solution), so
-- cards can show it without another round trip. The return type changes, so
-- it is dropped and recreated with its grants.
DROP FUNCTION IF EXISTS public.post_engagement_counts(uuid[]);
CREATE FUNCTION public.post_engagement_counts(p_post_ids uuid[])
RETURNS TABLE(post_id uuid, likes bigint, helpful bigint, saves bigint, offers bigint,
              comment_count bigint, user_actions text[], solved boolean)
LANGUAGE sql STABLE
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
    SELECT c.post_id, count(*)::bigint AS comment_count, bool_or(c.is_best_answer) AS solved
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
    COALESCE(a.user_actions, '{}'::text[]),
    COALESCE(c.solved, false)
  FROM requested r
  LEFT JOIN action_counts a ON a.post_id = r.post_id
  LEFT JOIN comment_counts c ON c.post_id = r.post_id;
$$;

REVOKE ALL ON FUNCTION public.post_engagement_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_engagement_counts(uuid[]) TO anon, authenticated, service_role;
