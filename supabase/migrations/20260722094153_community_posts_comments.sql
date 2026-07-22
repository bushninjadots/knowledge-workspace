-- Community posts and comments tables
-- Replaces seed data with real Supabase tables

-- ============================================================
-- 1. POSTS TABLE
-- ============================================================

CREATE TYPE public.post_type AS ENUM (
  'showcase',
  'question',
  'project_update',
  'tutorial',
  'resource',
  'achievement',
  'discussion',
  'help_request',
  'collaboration_request',
  'progress_update'
);

CREATE TABLE public.posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            public.post_type NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL DEFAULT '',
  community       text NOT NULL DEFAULT 'General',
  skills          text[] NOT NULL DEFAULT '{}',
  focus           text,

  -- Type-specific metadata (JSONB for flexibility)
  question_data   jsonb,  -- { solved, difficulty, best_answer }
  resource_data   jsonb,  -- { kind }
  achievement_data jsonb, -- { milestone }
  help_data       jsonb,  -- { skill_needed, difficulty }
  collaboration_data jsonb, -- { roles_needed }
  progress_data   jsonb,  -- { skill }
  project_data    jsonb,  -- { progress, contributors, feedback, journey_stage }

  -- Images stored as text array (signed URLs generated client-side)
  images          text[] NOT NULL DEFAULT '{}',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX posts_author_idx ON public.posts (author_id);
CREATE INDEX posts_type_idx ON public.posts (type);
CREATE INDEX posts_community_idx ON public.posts (community);
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);
CREATE INDEX posts_skills_idx ON public.posts USING GIN (skills);

-- ============================================================
-- 2. COMMENTS TABLE
-- ============================================================

CREATE TABLE public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  is_best_answer boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX comments_post_idx ON public.comments (post_id);
CREATE INDEX comments_author_idx ON public.comments (author_id);

-- ============================================================
-- 3. POST INTERACTIONS (likes, helpful, saves, offers)
-- ============================================================

CREATE TYPE public.post_action AS ENUM ('like', 'helpful', 'save', 'offer');

CREATE TABLE public.post_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      public.post_action NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, action)
);

-- Indexes
CREATE INDEX post_actions_post_idx ON public.post_actions (post_id);
CREATE INDEX post_actions_user_idx ON public.post_actions (user_id);

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- Posts: everyone can read, author can CRUD their own
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (true);

CREATE POLICY "Authors can insert their own posts"
  ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own posts"
  ON public.posts FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own posts"
  ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Comments: everyone can read, author can CRUD their own
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Authors can insert their own comments"
  ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own comments"
  ON public.comments FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own comments"
  ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- Post actions: everyone can read, user can manage their own
ALTER TABLE public.post_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post actions are viewable by everyone"
  ON public.post_actions FOR SELECT USING (true);

CREATE POLICY "Users can insert their own actions"
  ON public.post_actions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own actions"
  ON public.post_actions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. TRIGGERS (updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;

-- ============================================================
-- 7. REVOKE FROM PUBLIC
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
