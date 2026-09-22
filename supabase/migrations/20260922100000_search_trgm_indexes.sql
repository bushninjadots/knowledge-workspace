-- ============================================================================
-- Search performance: trigram indexes for leading-wildcard ILIKE.
--
-- global-search.tsx queries six tables with `%term%` patterns (leading
-- wildcard). A btree cannot serve those; every keystroke past the debounce
-- threshold was a sequential scan per table. pg_trgm GIN indexes serve
-- ILIKE '%…%' from the index, turning search from O(table) into index lookups
-- as the data grows.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- profiles: display_name, handle, category, creator_title
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_handle_trgm_idx
  ON public.profiles USING gin (handle gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_category_trgm_idx
  ON public.profiles USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_creator_title_trgm_idx
  ON public.profiles USING gin (creator_title gin_trgm_ops);

-- skills: name
CREATE INDEX IF NOT EXISTS skills_name_trgm_idx
  ON public.skills USING gin (name gin_trgm_ops);

-- projects: title, description
CREATE INDEX IF NOT EXISTS projects_title_trgm_idx
  ON public.projects USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS projects_description_trgm_idx
  ON public.projects USING gin (description gin_trgm_ops);

-- posts: title, body
CREATE INDEX IF NOT EXISTS posts_title_trgm_idx
  ON public.posts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS posts_body_trgm_idx
  ON public.posts USING gin (body gin_trgm_ops);

-- library_items: title, content (per-user search)
CREATE INDEX IF NOT EXISTS library_items_title_trgm_idx
  ON public.library_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS library_items_content_trgm_idx
  ON public.library_items USING gin (content gin_trgm_ops);

-- sessions: title, description (organizer-scoped search)
CREATE INDEX IF NOT EXISTS sessions_title_trgm_idx
  ON public.sessions USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS sessions_description_trgm_idx
  ON public.sessions USING gin (description gin_trgm_ops);
