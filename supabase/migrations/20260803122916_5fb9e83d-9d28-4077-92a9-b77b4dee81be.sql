-- ============================================================
-- PART 1a: community posts, comments, actions
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.post_type AS ENUM (
    'showcase','question','project_update','tutorial','resource',
    'achievement','discussion','help_request','collaboration_request','progress_update'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            public.post_type NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL DEFAULT '',
  community       text NOT NULL DEFAULT 'General',
  skills          text[] NOT NULL DEFAULT '{}',
  focus           text,
  question_data   jsonb,
  resource_data   jsonb,
  achievement_data jsonb,
  help_data       jsonb,
  collaboration_data jsonb,
  progress_data   jsonb,
  project_data    jsonb,
  images          text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;

CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS posts_type_idx ON public.posts (type);
CREATE INDEX IF NOT EXISTS posts_community_idx ON public.posts (community);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_skills_idx ON public.posts USING GIN (skills);

CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  is_best_answer boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;

CREATE INDEX IF NOT EXISTS comments_post_idx ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS comments_author_idx ON public.comments (author_id);

DO $$ BEGIN
  CREATE TYPE public.post_action AS ENUM ('like','helpful','save','offer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.post_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      public.post_action NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, action)
);

GRANT SELECT, INSERT, DELETE ON public.post_actions TO authenticated;
GRANT SELECT ON public.post_actions TO anon;
GRANT ALL ON public.post_actions TO service_role;

CREATE INDEX IF NOT EXISTS post_actions_post_idx ON public.post_actions (post_id);
CREATE INDEX IF NOT EXISTS post_actions_user_idx ON public.post_actions (user_id);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can insert their own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can update their own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can delete their own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can insert their own comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can update their own comments" ON public.comments FOR UPDATE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Authors can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.post_actions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Post actions are viewable by everyone" ON public.post_actions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert their own actions" ON public.post_actions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own actions" ON public.post_actions FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- PART 1b: living projects
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  position    smallint NOT NULL DEFAULT 0,
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT SELECT ON public.project_milestones TO anon;
GRANT ALL ON public.project_milestones TO service_role;
CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON public.project_milestones (project_id, position);
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Milestones viewable by everyone" ON public.project_milestones FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can manage milestones" ON public.project_milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_milestones.project_id AND p.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS set_project_milestones_updated_at ON public.project_milestones;
CREATE TRIGGER set_project_milestones_updated_at BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.project_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  week_number smallint,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_updates TO authenticated;
GRANT SELECT ON public.project_updates TO anon;
GRANT ALL ON public.project_updates TO service_role;
CREATE INDEX IF NOT EXISTS project_updates_project_idx ON public.project_updates (project_id, created_at DESC);
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Updates viewable by everyone" ON public.project_updates FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Contributors can create updates" ON public.project_updates FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.project_contributors pc WHERE pc.project_id = project_updates.project_id AND pc.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Author can delete own updates" ON public.project_updates FOR DELETE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.project_discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  category    text NOT NULL DEFAULT 'general' CHECK (category IN ('general','question','idea','feedback','announcement')),
  is_pinned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_discussions TO authenticated;
GRANT SELECT ON public.project_discussions TO anon;
GRANT ALL ON public.project_discussions TO service_role;
CREATE INDEX IF NOT EXISTS project_discussions_project_idx ON public.project_discussions (project_id, is_pinned DESC, created_at DESC);
ALTER TABLE public.project_discussions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Discussions viewable by everyone" ON public.project_discussions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Contributors can create discussions" ON public.project_discussions FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.project_contributors pc WHERE pc.project_id = project_discussions.project_id AND pc.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Author can update own discussions" ON public.project_discussions FOR UPDATE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Author can delete own discussions" ON public.project_discussions FOR DELETE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can pin/unpin discussions" ON public.project_discussions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_discussions.project_id AND p.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DROP TRIGGER IF EXISTS set_project_discussions_updated_at ON public.project_discussions;
CREATE TRIGGER set_project_discussions_updated_at BEFORE UPDATE ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id   uuid NOT NULL REFERENCES public.project_discussions(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_replies TO authenticated;
GRANT SELECT ON public.discussion_replies TO anon;
GRANT ALL ON public.discussion_replies TO service_role;
CREATE INDEX IF NOT EXISTS discussion_replies_idx ON public.discussion_replies (discussion_id, created_at);
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Replies viewable by everyone" ON public.discussion_replies FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Contributors can create replies" ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.uid() = author_id AND EXISTS (
    SELECT 1 FROM public.project_discussions pd
    JOIN public.project_contributors pc ON pc.project_id = pd.project_id
    WHERE pd.id = discussion_replies.discussion_id AND pc.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Author can delete own replies" ON public.discussion_replies FOR DELETE USING (auth.uid() = author_id); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.project_open_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  skills       text[] NOT NULL DEFAULT '{}',
  is_filled    boolean NOT NULL DEFAULT false,
  filled_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_open_roles TO authenticated;
GRANT SELECT ON public.project_open_roles TO anon;
GRANT ALL ON public.project_open_roles TO service_role;
CREATE INDEX IF NOT EXISTS project_open_roles_project_idx ON public.project_open_roles (project_id, is_filled);
ALTER TABLE public.project_open_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Open roles viewable by everyone" ON public.project_open_roles FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Owner can manage open roles" ON public.project_open_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_open_roles.project_id AND p.profile_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

NOTIFY pgrst, 'reload schema';