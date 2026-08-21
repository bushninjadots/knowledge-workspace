-- Library workspaces can store rich text (HTML) or Markdown, and an item can
-- be linked to a file in a GitHub repository for manual pull-sync.
-- Existing rows keep working unchanged: they default to 'html' and stay
-- unlinked (github_source NULL).

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'html'
    CHECK (content_format IN ('html', 'markdown'));

ALTER TABLE public.library_items
  ADD COLUMN IF NOT EXISTS github_source JSONB;
