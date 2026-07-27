-- Community Spaces: named, moderated spaces for grouped posts.
-- Replaces the free-text community field on posts with structured entities.

CREATE TYPE public.space_member_role AS ENUM ('owner', 'moderator', 'member');

CREATE TABLE public.community_spaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  avatar_url  text,
  created_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spaces_slug ON public.community_spaces(slug);
CREATE INDEX idx_spaces_created_by ON public.community_spaces(created_by);

CREATE TABLE public.community_space_members (
  space_id  uuid NOT NULL REFERENCES public.community_spaces(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      public.space_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

CREATE INDEX idx_space_members_user ON public.community_space_members(user_id);

-- Add space_id and is_pinned to posts
ALTER TABLE public.posts ADD COLUMN space_id uuid REFERENCES public.community_spaces(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;
CREATE INDEX idx_posts_space ON public.posts(space_id);
CREATE INDEX idx_posts_space_pinned ON public.posts(space_id, is_pinned) WHERE is_pinned = true;

-- RLS for community_spaces
ALTER TABLE public.community_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spaces are publicly readable"
  ON public.community_spaces FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create spaces"
  ON public.community_spaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Only creator can update spaces"
  ON public.community_spaces FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Only creator can delete spaces"
  ON public.community_spaces FOR DELETE
  USING (auth.uid() = created_by);

-- RLS for community_space_members
ALTER TABLE public.community_space_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see member list"
  ON public.community_space_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join spaces"
  ON public.community_space_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave spaces"
  ON public.community_space_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners and moderators can manage members"
  ON public.community_space_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "Owners and moderators can remove members"
  ON public.community_space_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_space_members m
      WHERE m.space_id = community_space_members.space_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'moderator')
    )
  );

-- Create default "General" space and migrate existing posts
DO $$
DECLARE
  first_user uuid;
BEGIN
  SELECT id INTO first_user FROM public.profiles ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    INSERT INTO public.community_spaces (name, slug, description, created_by)
    VALUES ('General', 'general', 'The default community space for all topics.', first_user)
    ON CONFLICT (slug) DO NOTHING;

    UPDATE public.posts
    SET space_id = (SELECT id FROM public.community_spaces WHERE slug = 'general')
    WHERE community = 'General' AND space_id IS NULL;
  END IF;
END $$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_spaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_space_members TO authenticated;
GRANT ALL ON public.community_spaces TO service_role;
GRANT ALL ON public.community_space_members TO service_role;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
