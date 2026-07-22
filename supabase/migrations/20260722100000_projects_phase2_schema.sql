-- Phase 2.1 — Living Projects: expand the project model with vision, gallery,
-- resources, milestones, weekly updates, project discussions, and open roles.

-- ============================================================
-- 1. New columns on projects
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.projects.vision IS 'Longer-form project vision / why this exists';
COMMENT ON COLUMN public.projects.gallery IS 'Array of { url: string, caption?: string, type: "image"|"video" }';
COMMENT ON COLUMN public.projects.resources IS 'Array of { title: string, url: string, type: "article"|"tool"|"video"|"doc"|"other" }';

-- ============================================================
-- 2. Project milestones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  position    smallint NOT NULL DEFAULT 0,
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_milestones_project_idx ON public.project_milestones (project_id, position);

ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Milestones viewable by everyone"
  ON public.project_milestones FOR SELECT USING (true);

CREATE POLICY "Owner can manage milestones"
  ON public.project_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_milestones.project_id
        AND p.profile_id = auth.uid()
    )
  );

CREATE TRIGGER set_project_milestones_updated_at
  BEFORE UPDATE ON public.project_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.project_milestones TO anon;

-- ============================================================
-- 3. Project weekly updates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  week_number smallint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_updates_project_idx ON public.project_updates (project_id, created_at DESC);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Updates viewable by everyone"
  ON public.project_updates FOR SELECT USING (true);

CREATE POLICY "Contributors can create updates"
  ON public.project_updates FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.project_contributors pc
      WHERE pc.project_id = project_updates.project_id
        AND pc.profile_id = auth.uid()
    )
  );

CREATE POLICY "Author can delete own updates"
  ON public.project_updates FOR DELETE
  USING (auth.uid() = author_id);

GRANT SELECT ON public.project_updates TO anon;

-- ============================================================
-- 4. Project discussions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_discussions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  category    text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'question', 'idea', 'feedback', 'announcement')),
  is_pinned   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_discussions_project_idx ON public.project_discussions (project_id, is_pinned DESC, created_at DESC);

ALTER TABLE public.project_discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Discussions viewable by everyone"
  ON public.project_discussions FOR SELECT USING (true);

CREATE POLICY "Contributors can create discussions"
  ON public.project_discussions FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.project_contributors pc
      WHERE pc.project_id = project_discussions.project_id
        AND pc.profile_id = auth.uid()
    )
  );

CREATE POLICY "Author can update own discussions"
  ON public.project_discussions FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Author can delete own discussions"
  ON public.project_discussions FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Owner can pin/unpin discussions"
  ON public.project_discussions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_discussions.project_id
        AND p.profile_id = auth.uid()
    )
  );

CREATE TRIGGER set_project_discussions_updated_at
  BEFORE UPDATE ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.project_discussions TO anon;

-- ============================================================
-- 5. Discussion replies (threaded comments on discussions)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id   uuid NOT NULL REFERENCES public.project_discussions(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussion_replies_idx ON public.discussion_replies (discussion_id, created_at);

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies viewable by everyone"
  ON public.discussion_replies FOR SELECT USING (true);

CREATE POLICY "Contributors can create replies"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.project_discussions pd
      JOIN public.project_contributors pc ON pc.project_id = pd.project_id
      WHERE pd.id = discussion_replies.discussion_id
        AND pc.profile_id = auth.uid()
    )
  );

CREATE POLICY "Author can delete own replies"
  ON public.discussion_replies FOR DELETE
  USING (auth.uid() = author_id);

GRANT SELECT ON public.discussion_replies TO anon;

-- ============================================================
-- 6. Project open roles
-- ============================================================

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

CREATE INDEX IF NOT EXISTS project_open_roles_project_idx ON public.project_open_roles (project_id, is_filled);

ALTER TABLE public.project_open_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open roles viewable by everyone"
  ON public.project_open_roles FOR SELECT USING (true);

CREATE POLICY "Owner can manage open roles"
  ON public.project_open_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_open_roles.project_id
        AND p.profile_id = auth.uid()
    )
  );

GRANT SELECT ON public.project_open_roles TO anon;
