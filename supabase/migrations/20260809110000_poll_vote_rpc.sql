-- Concurrency-safe poll voting
-- Lock the post row so simultaneous votes cannot overwrite one another.

CREATE OR REPLACE FUNCTION public.vote_on_poll(
  p_post_id uuid,
  p_option_index integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _poll jsonb;
  _votes jsonb;
  _option_count integer;
  _ends_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT poll_data
    INTO _poll
  FROM public.posts
  WHERE id = p_post_id AND type = 'poll'
  FOR UPDATE;

  IF _poll IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  _option_count := jsonb_array_length(COALESCE(_poll->'options', '[]'::jsonb));
  IF p_option_index < 0 OR p_option_index >= _option_count THEN
    RAISE EXCEPTION 'Poll option is unavailable';
  END IF;

  IF NULLIF(_poll->>'ends_at', '') IS NOT NULL THEN
    _ends_at := (_poll->>'ends_at')::timestamptz;
    IF _ends_at <= now() THEN
      RAISE EXCEPTION 'This poll has ended';
    END IF;
  END IF;

  _votes := COALESCE(_poll->'votes', '[]'::jsonb);
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_votes) AS vote
    WHERE vote->>'user_id' = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  UPDATE public.posts
  SET poll_data = jsonb_set(
    _poll,
    '{votes}',
    _votes || jsonb_build_array(
      jsonb_build_object('option_index', p_option_index, 'user_id', auth.uid()::text)
    )
  )
  WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_on_poll(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_on_poll(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
