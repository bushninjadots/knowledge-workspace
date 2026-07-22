-- Community posts and comments tables
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout

-- ============================================================
-- 1. POSTS TABLE
-- ============================================================

DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type            public.post_type NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL DEFAULT '',
  community       text NOT NULL DEFAULT 'General',
  skills          text[] NOT NULL DEFAULT '{}',
  focus           text,

  -- Type-specific metadata (JSONB for flexibility)
  question_data   jsonb,
  resource_data   jsonb,
  achievement_data jsonb,
  help_data       jsonb,
  collaboration_data jsonb,
  progress_data   jsonb,
  project_data    jsonb,

  -- Images stored as text array (signed URLs generated client-side)
  images          text[] NOT NULL DEFAULT '{}',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes (IF NOT EXISTS not supported for indexes, use DO blocks)
DO $$ BEGIN CREATE INDEX posts_author_idx ON public.posts (author_id); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX posts_type_idx ON public.posts (type); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX posts_community_idx ON public.posts (community); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX posts_skills_idx ON public.posts USING GIN (skills); EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ============================================================
-- 2. COMMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body        text NOT NULL,
  is_best_answer boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX comments_post_idx ON public.comments (post_id); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX comments_author_idx ON public.comments (author_id); EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ============================================================
-- 3. POST INTERACTIONS (likes, helpful, saves, offers)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.post_action AS ENUM ('like', 'helpful', 'save', 'offer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.post_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      public.post_action NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, action)
);

DO $$ BEGIN CREATE INDEX post_actions_post_idx ON public.post_actions (post_id); EXCEPTION WHEN duplicate_table THEN null; END $$;
DO $$ BEGIN CREATE INDEX post_actions_user_idx ON public.post_actions (user_id); EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Posts are viewable by everyone"
    ON public.posts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can insert their own posts"
    ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can update their own posts"
    ON public.posts FOR UPDATE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can delete their own posts"
    ON public.posts FOR DELETE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Comments are viewable by everyone"
    ON public.comments FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can insert their own comments"
    ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can update their own comments"
    ON public.comments FOR UPDATE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authors can delete their own comments"
    ON public.comments FOR DELETE USING (auth.uid() = author_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.post_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Post actions are viewable by everyone"
    ON public.post_actions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own actions"
    ON public.post_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own actions"
    ON public.post_actions FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

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

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. ENABLE REALTIME
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 7. REVOKE FROM PUBLIC
-- ============================================================

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN null; END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
