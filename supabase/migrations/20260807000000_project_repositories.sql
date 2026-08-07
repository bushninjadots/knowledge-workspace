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
  access_token  text,                           -- encrypted by Supabase Vault or stored as plaintext (Supabase manages encryption)
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
