-- ============================================================
-- Community Improvements: post_space_shares, cross-links, notifications
-- ============================================================

-- 1. Post-space sharing junction table
CREATE TABLE IF NOT EXISTS public.post_space_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  space_id   uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  shared_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, space_id)
);

CREATE INDEX IF NOT EXISTS post_space_shares_post_idx ON public.post_space_shares(post_id);
CREATE INDEX IF NOT EXISTS post_space_shares_space_idx ON public.post_space_shares(space_id);

-- RLS: members of a space can see shared posts in that space
ALTER TABLE public.post_space_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view shares in their spaces"
  ON public.post_space_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members csm
      WHERE csm.space_id = post_space_shares.space_id
        AND csm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can share posts to their spaces"
  ON public.post_space_shares FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM public.community_space_members csm
      WHERE csm.space_id = post_space_shares.space_id
        AND csm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can unshare their own shares"
  ON public.post_space_shares FOR DELETE
  USING (auth.uid() = shared_by);

-- 2. Cross-link: community_post_id on project_discussions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_discussions'
  ) THEN
    ALTER TABLE public.project_discussions
      ADD COLUMN IF NOT EXISTS community_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Notification trigger: notify project owner when someone posts about their project
CREATE OR REPLACE FUNCTION public.notify_project_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_owner uuid;
  _project_title text;
  _actor_name text;
  _post_title text;
BEGIN
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;

  SELECT profile_id, title INTO _project_owner, _project_title
  FROM public.projects WHERE id = NEW.project_id;

  IF _project_owner IS NULL OR _project_owner = NEW.author_id THEN RETURN NEW; END IF;

  SELECT COALESCE(display_name, handle) INTO _actor_name
  FROM public.profiles WHERE id = NEW.author_id;

  _post_title := COALESCE(NEW.title, 'Untitled');

  PERFORM public.insert_notification(
    _project_owner,
    NEW.author_id,
    'project_post',
    COALESCE(_actor_name, 'Someone') || ' posted about your project: ' || left(_project_title, 50),
    left(_post_title, 200),
    'project',
    NEW.project_id,
    jsonb_build_object('project_title', _project_title, 'post_id', NEW.id, 'post_title', _post_title)
  );
  RETURN NEW;
END;
$$;

SELECT public._create_trigger_if_table_exists(
  'notify_on_project_post', 'posts',
  'notify_project_post', 'AFTER', 'INSERT'
);
