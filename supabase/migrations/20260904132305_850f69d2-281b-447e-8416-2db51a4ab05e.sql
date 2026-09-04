ALTER TABLE public.community_spaces
  ADD COLUMN IF NOT EXISTS join_type text NOT NULL DEFAULT 'auto'
    CHECK (join_type IN ('auto', 'review')),
  ADD COLUMN IF NOT EXISTS rules text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.community_space_join_requests (
  space_id   uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_space_join_requests_space
  ON public.community_space_join_requests(space_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.community_space_join_requests TO authenticated;
GRANT ALL ON public.community_space_join_requests TO service_role;

ALTER TABLE public.community_space_join_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can request to join spaces"
    ON public.community_space_join_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners and requesters can see join requests"
    ON public.community_space_join_requests FOR SELECT TO authenticated
    USING (
      public.is_space_owner_or_moderator(space_id, auth.uid())
      OR auth.uid() = user_id
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can cancel own join requests"
    ON public.community_space_join_requests FOR DELETE TO authenticated
    USING (
      auth.uid() = user_id
      OR public.is_space_owner_or_moderator(space_id, auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.approve_space_join_request(p_space_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to approve join requests';
  END IF;

  INSERT INTO public.community_space_members (space_id, user_id, role)
  VALUES (p_space_id, p_user_id, 'member')
  ON CONFLICT (space_id, user_id) DO NOTHING;

  DELETE FROM public.community_space_join_requests
  WHERE space_id = p_space_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_space_join_request(p_space_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_space_owner_or_moderator(p_space_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to reject join requests';
  END IF;

  DELETE FROM public.community_space_join_requests
  WHERE space_id = p_space_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_space_join_request(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_space_join_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_space_join_request(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_space_join_request(uuid, uuid) TO authenticated;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS flair text,
  ADD COLUMN IF NOT EXISTS link_url text;

CREATE INDEX IF NOT EXISTS idx_posts_flair ON public.posts(flair);

GRANT SELECT, INSERT, UPDATE ON public.posts TO authenticated;
GRANT SELECT, UPDATE ON public.community_spaces TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_github_tokens (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_github_tokens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.user_github_tokens TO service_role;

NOTIFY pgrst, 'reload schema';