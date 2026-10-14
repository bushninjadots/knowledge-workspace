-- ============================================================================
-- Journal: project sync + profile summary; launcher: web fallbacks
--
-- • journal_entries(author_id, source_url) is unique when there's a link, so
--   the project sync (feat/fix commits from a project's GitHub / GitLab repo
--   into its owner's journal) can run any number of times without doubling.
-- • journal_summary(profile) — the numbers for the Studio "Dev journal"
--   block: counts by kind and active days over the last 30 days. Counts only,
--   never the text of private entries.
-- • member_apps.web_url — the web version a desktop launcher tile opens when
--   the app isn't installed on this device (vscode.dev, an Obsidian Publish
--   site, …).
-- ============================================================================

-- Earlier duplicates (if any) would block the unique index.
DELETE FROM public.journal_entries a
 USING public.journal_entries b
 WHERE a.source_url IS NOT NULL
   AND a.author_id = b.author_id AND a.source_url = b.source_url
   AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_author_source_url_key
  ON public.journal_entries (author_id, source_url) WHERE source_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.journal_summary(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'did', count(*) FILTER (WHERE kind = 'did'),
    'fixed', count(*) FILTER (WHERE kind = 'fixed'),
    'decided', count(*) FILTER (WHERE kind = 'decided'),
    'learned', count(*) FILTER (WHERE kind = 'learned'),
    'active_days', count(DISTINCT (occurred_at AT TIME ZONE 'utc')::date),
    'total', count(*)
  )
  FROM public.journal_entries
  WHERE author_id = p_profile_id
    AND occurred_at > now() - interval '30 days';
$$;

REVOKE ALL ON FUNCTION public.journal_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.journal_summary(uuid) TO anon, authenticated;

ALTER TABLE public.member_apps
  ADD COLUMN IF NOT EXISTS web_url text
    CHECK (web_url IS NULL OR (web_url ~ '^https://' AND char_length(web_url) <= 1000));

GRANT INSERT (web_url) ON public.member_apps TO authenticated;
GRANT UPDATE (web_url) ON public.member_apps TO authenticated;
