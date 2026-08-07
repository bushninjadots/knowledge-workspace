-- Add uploaded_files column to projects for storing file upload metadata.
-- Each file is { name, path, size, type, uploaded_at }.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS uploaded_files jsonb DEFAULT '[]';

-- Re-grant public read access (new column inherits table policies)
COMMENT ON COLUMN projects.uploaded_files IS 'Array of uploaded files with name, path, size, type, and uploaded_at. Files live in project-media bucket.';
