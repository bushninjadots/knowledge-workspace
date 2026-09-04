-- Project repositories: link external repositories (GitHub, GitLab, etc.)
-- to Tethyr projects so the code lives wherever the builder wants.

CREATE TABLE IF NOT EXISTS project_repositories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url         text NOT NULL,
  provider    text NOT NULL DEFAULT 'github',  -- github, gitlab, bitbucket
  metadata    jsonb DEFAULT '{}',              -- cached: stars, language, description, etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_project_repos_project ON project_repositories(project_id);

-- Public read (projects are public)
ALTER TABLE project_repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project repositories are publicly readable"
  ON project_repositories FOR SELECT
  USING (true);

CREATE POLICY "Project owner can insert repository"
  ON project_repositories FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_repositories.project_id
      AND projects.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project owner can update repository"
  ON project_repositories FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_repositories.project_id
      AND projects.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project owner can delete repository"
  ON project_repositories FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_repositories.project_id
      AND projects.profile_id = auth.uid()
    )
  );

-- GitHub OAuth: store connected accounts for repo discovery and activity
CREATE TABLE IF NOT EXISTS connected_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL,                  -- github, gitlab, etc.
  provider_id   text NOT NULL,                  -- provider's user ID
  username      text,
  access_token  text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own connected accounts"
  ON connected_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own connected account"
  ON connected_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own connected account"
  ON connected_accounts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON connected_accounts TO authenticated;
GRANT ALL ON connected_accounts TO service_role;

CREATE TABLE IF NOT EXISTS public.user_layout_preferences (
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page        text NOT NULL,                        -- 'dashboard' | 'profile'
  layout      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page)
);

CREATE INDEX IF NOT EXISTS idx_user_layout_preferences_page ON public.user_layout_preferences(page);

ALTER TABLE public.user_layout_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own layout preferences"
  ON public.user_layout_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own layout preferences"
  ON public.user_layout_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own layout preferences"
  ON public.user_layout_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own layout preferences"
  ON public.user_layout_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_layout_preferences TO authenticated;
GRANT ALL ON public.user_layout_preferences TO service_role;

-- Project workspace: README + tools on projects, plus a structured activity table.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS readme text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tools jsonb DEFAULT '[]';

CREATE TABLE IF NOT EXISTS project_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project
  ON project_activity(project_id, created_at DESC);

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project activity is publicly readable"
  ON project_activity FOR SELECT
  USING (true);

CREATE POLICY "Project owner can insert activity"
  ON project_activity FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_activity.project_id
      AND projects.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project owner can delete activity"
  ON project_activity FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_activity.project_id
      AND projects.profile_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON project_repositories TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_discussions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_activity TO anon, authenticated, service_role;