-- Per-project GitHub showcase preferences.
--
-- Owners decide which parts of the linked repository's cached GitHub data the
-- project page shows: stats (stars/forks/open issues), topics, the 52-week
-- contribution graph, and the details row (license, homepage, created).
-- Stored on the project rather than the repo row so preferences survive
-- re-linking a different repository.
--
-- Shape (all optional; absent keys render as "on" when a repo is linked):
--   { "show_stats": true, "show_topics": true, "show_graph": true,
--     "show_details": true }
--
-- NULL (the default for every existing project) means "use the defaults" —
-- the UI treats it as all-on; no backfill needed.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS github_display jsonb;

NOTIFY pgrst, 'reload schema';
