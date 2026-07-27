-- Project-Post Linking: add project attachment columns to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS feedback_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS posts_project_idx ON public.posts(project_id);
CREATE INDEX IF NOT EXISTS posts_feedback_tags_idx ON public.posts USING GIN(feedback_tags);
