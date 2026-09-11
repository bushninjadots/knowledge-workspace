-- Profile README: the member's long-form home document.
--
-- Mirrors projects.readme — a member-authored markdown document rendered as the
-- member's README block in their Studio. Stored on profiles (not the page
-- layout) so it follows the member everywhere and can be imported from GitHub
-- the same way a project README is.
--
-- Read/write access needs no new policy: profiles is already publicly
-- selectable and owner-updatable, and the README is public profile content.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS readme text;
