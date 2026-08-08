-- Project workspace: README + tools on projects, plus a structured activity
-- table that future GitHub syncs can write to.

-- Owner-authored README (markdown) — the project's home document.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS readme text;

-- "Tools" the creator uses to build/manage the project (VS Code, Figma, etc.)
-- — distinct from technology (project_skills) and tags.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tools jsonb DEFAULT '[]';

-- ============================================================
-- project_activity — structured events (milestone done, update
-- posted, file added, repo linked, ...). The Activity tab currently
-- aggregates from existing tables; this table is the destination for
-- future automated events (e.g. GitHub sync).
-- ============================================================

CREATE TABLE IF NOT EXISTS project_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind        text NOT NULL,   -- milestone_done, update, discussion, file_added, repo_linked, ...
  title       text NOT NULL,
  body        text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project
  ON project_activity(project_id, created_at DESC);

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Projects are public — their activity is public too.
CREATE POLICY "Project activity is publicly readable"
  ON project_activity FOR SELECT
  USING (true);

-- Only the project owner can write structured events.
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

-- Role grants. project_repositories and project_discussions were created by
-- earlier migrations without grants, so the API roles couldn't touch them;
-- restore access here (idempotent).
GRANT SELECT, INSERT, UPDATE, DELETE ON project_repositories TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_discussions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON project_activity TO anon, authenticated, service_role;
