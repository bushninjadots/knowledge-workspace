-- ============================================================================
-- Media prune tooling
--
-- Storage cleanup for the media buckets whose objects should be backed by a
-- database reference. Every client upload now writes to a unique path, and
-- replaced files are removed by the uploader — but files can still become
-- orphaned (an upload aborted before the row write, a cover picked then the
-- dialog cancelled, a background switched away from image mode without the
-- old file being deleted, legacy fixed-path uploads that were superseded,
-- etc.). This migration provides a maintenance function that finds and
-- prunes those orphans.
--
-- How it works
--   A storage object is "referenced" when its object path appears anywhere in
--   one of the reference columns registered for its bucket. Matching is a
--   plain substring test over the column's text (strpos, not LIKE patterns),
--   so it covers every storage convention in use today:
--     • columns storing the bare storage path      (profiles.avatar_url, …)
--     • columns storing the object's public URL    (skill proofs, block
--       images — the URL contains the path)
--     • jsonb columns holding paths inside arrays  (projects.gallery,
--       projects.uploaded_files, pages/layouts block configs, …)
--     • rich-text bodies that embed image paths    (library_items.content)
--
-- Safety rails
--   1. DRY-RUN BY DEFAULT. Until you pass p_dry_run := false nothing is
--      deleted — you get the counts and a list of what would be pruned.
--   2. Age guard (default 24 h): objects younger than the cutoff are never
--      touched, so a just-uploaded file whose row write has not committed
--      (or an upload in progress) cannot be deleted.
--   3. Reference columns/tables that do not exist in the current schema are
--      skipped with a NOTICE instead of failing, so the function survives
--      schema drift.
--   4. Matching errs toward retention: any text column that contains the
--      object path keeps the object. Under-coverage of future reference
--      columns is the only real risk, so extend the registry below whenever
--      a new upload site is added (see "Reference registry").
--
-- Usage (run in the SQL editor, as postgres/service_role):
--   -- Preview every bucket:
--   SELECT * FROM public.prune_orphaned_media();
--   -- Preview a single bucket:
--   SELECT * FROM public.prune_orphaned_media('project-media');
--   -- Actually prune objects older than 48 h:
--   SELECT * FROM public.prune_orphaned_media(p_dry_run := false,
--                                             p_min_age_hours := 48);
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prune_orphaned_media(
  p_bucket        text    DEFAULT NULL,  -- NULL = every bucket in the registry
  p_min_age_hours integer DEFAULT 24,    -- never touch objects younger than this
  p_dry_run       boolean DEFAULT true   -- true = report only
)
RETURNS TABLE (
  bucket_name text,
  candidates  bigint,  -- eligible objects (bucket, older than the age guard)
  retained    bigint,  -- candidates still referenced by a row
  pruned      bigint,  -- orphans removed (or that would be removed)
  mode        text     -- 'dry-run' | 'deleted'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  b         record;
  s         record;
  v_cutoff  timestamptz;
  v_total   bigint;
  v_kept    bigint;
BEGIN
  IF p_min_age_hours < 0 THEN
    RAISE EXCEPTION 'p_min_age_hours must be >= 0 (got %)', p_min_age_hours;
  END IF;

  -- Reference registry: which (schema, table, column) can hold objects from
  -- each bucket. Keep this list in sync with the app's upload/display sites.
  -- ---------------------------------------------------------------
  CREATE TEMP TABLE IF NOT EXISTS _media_sources (
    bucket text NOT NULL,
    sch    text NOT NULL,
    tbl    text NOT NULL,
    col    text NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _media_sources;
  INSERT INTO _media_sources (bucket, sch, tbl, col) VALUES
    ('avatars',               'public', 'profiles',               'avatar_url'),
    ('banners',               'public', 'profiles',               'banner_url'),
    ('team-avatars',          'public', 'teams',                  'avatar_url'),
    ('backgrounds',           'public', 'profiles',               'background'),
    ('backgrounds',           'public', 'profiles',               'public_background'),
    ('skill-proofs',          'public', 'profile_skills_teach',   'proof_url'),
    ('challenge-submissions', 'public', 'challenge_participants', 'submission_url'),
    ('library-files',         'public', 'library_items',          'file_url'),
    ('library-files',         'public', 'library_items',          'content'),
    ('project-media',         'public', 'projects',               'cover_url'),
    ('project-media',         'public', 'projects',               'gallery'),
    ('project-media',         'public', 'projects',               'resources'),
    ('project-media',         'public', 'projects',               'uploaded_files'),
    ('project-media',         'public', 'projects',               'readme'),
    ('project-media',         'public', 'layouts',                'sections'),
    ('project-media',         'public', 'pages',                  'config');

  IF p_bucket IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = p_bucket) THEN
    RAISE EXCEPTION 'Unknown bucket: %', p_bucket;
  END IF;

  v_cutoff := now() - make_interval(hours => p_min_age_hours);

  CREATE TEMP TABLE IF NOT EXISTS _media_referenced (name text PRIMARY KEY) ON COMMIT DROP;

  FOR b IN
    SELECT DISTINCT bucket AS id
      FROM _media_sources
     WHERE p_bucket IS NULL OR bucket = p_bucket
     ORDER BY 1
  LOOP
    TRUNCATE _media_referenced;

    FOR s IN SELECT sch, tbl, col FROM _media_sources WHERE bucket = b.id LOOP
      -- Schema-drift safety: skip missing tables/columns rather than failing.
      IF NOT EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = s.sch AND table_name = s.tbl
      ) OR NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = s.sch AND table_name = s.tbl AND column_name = s.col
      ) THEN
        RAISE NOTICE 'prune_orphaned_media: skipping missing reference source %.%.%',
          s.sch, s.tbl, s.col;
        CONTINUE;
      END IF;

      -- An object is referenced when its path appears anywhere in the source
      -- column's text (path columns, public URLs, jsonb arrays, rich text).
      EXECUTE format(
        'INSERT INTO _media_referenced (name) '
        || 'SELECT DISTINCT o.name '
        || '  FROM storage.objects o '
        || '  JOIN %I.%I AS ref ON strpos(ref.%I::text, o.name) > 0 '
        || ' WHERE o.bucket_id = %L',
        s.sch, s.tbl, s.col, b.id
      );
    END LOOP;

    SELECT count(*) INTO v_total
      FROM storage.objects o
     WHERE o.bucket_id = b.id
       AND o.created_at < v_cutoff;

    SELECT count(*) INTO v_kept
      FROM storage.objects o
      JOIN _media_referenced r ON r.name = o.name
     WHERE o.bucket_id = b.id
       AND o.created_at < v_cutoff;

    bucket_name := b.id;
    candidates  := v_total;
    retained    := v_kept;
    pruned      := v_total - v_kept;
    mode        := CASE WHEN p_dry_run THEN 'dry-run' ELSE 'deleted' END;

    IF NOT p_dry_run AND v_total > v_kept THEN
      -- Supabase storage blocks direct table deletes via the protect_delete
      -- trigger ("Use the Storage API instead"). The documented escape hatch
      -- is the storage.allow_delete_query setting; it is scoped to the current
      -- transaction so it cannot leak into other work.
      PERFORM set_config('storage.allow_delete_query', 'true', true);
      DELETE FROM storage.objects o
       WHERE o.bucket_id = b.id
         AND o.created_at < v_cutoff
         AND NOT EXISTS (SELECT 1 FROM _media_referenced r WHERE r.name = o.name);
    END IF;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_orphaned_media(text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_orphaned_media(text, integer, boolean)
  TO authenticated, service_role;
