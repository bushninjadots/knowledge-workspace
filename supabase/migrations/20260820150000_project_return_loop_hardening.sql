-- Harden the return loop's external activity boundary.
-- The application deduplicates GitHub commits before inserting, but the
-- unique index also protects against concurrent syncs or repeated requests.

-- Remove duplicates from an earlier client/server sync before adding the
-- constraint. The oldest event is retained so its original timeline position
-- remains stable.
DELETE FROM public.project_activity older
USING public.project_activity newer
WHERE older.kind = 'github_commit'
  AND newer.kind = 'github_commit'
  AND older.project_id = newer.project_id
  AND older.metadata->>'external_id' IS NOT NULL
  AND older.metadata->>'external_id' = newer.metadata->>'external_id'
  AND older.id > newer.id;

CREATE UNIQUE INDEX IF NOT EXISTS project_activity_github_commit_unique
  ON public.project_activity (project_id, (metadata->>'external_id'))
  WHERE kind = 'github_commit' AND metadata->>'external_id' IS NOT NULL;
