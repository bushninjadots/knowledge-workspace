-- Fix media-prune linting without rewriting the already-pushed migration.
-- The original function used a temporary _media_sources table. Supabase's
-- database linter analyzes the function body without executing CREATE TEMP TABLE,
-- so it reported the later references as a missing relation. This replacement
-- keeps the registry in VALUES clauses and checks each candidate dynamically.

CREATE OR REPLACE FUNCTION public.media_object_is_referenced(
  p_bucket text,
  p_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source record;
  found_reference boolean;
BEGIN
  FOR source IN
    SELECT registry.sch, registry.tbl, registry.col
    FROM (
      VALUES
        ('avatars', 'public', 'profiles', 'avatar_url'),
        ('banners', 'public', 'profiles', 'banner_url'),
        ('team-avatars', 'public', 'teams', 'avatar_url'),
        ('backgrounds', 'public', 'profiles', 'background'),
        ('backgrounds', 'public', 'profiles', 'public_background'),
        ('skill-proofs', 'public', 'profile_skills_teach', 'proof_url'),
        ('challenge-submissions', 'public', 'challenge_participants', 'submission_url'),
        ('library-files', 'public', 'library_items', 'file_url'),
        ('library-files', 'public', 'library_items', 'content'),
        ('project-media', 'public', 'projects', 'cover_url'),
        ('project-media', 'public', 'projects', 'gallery'),
        ('project-media', 'public', 'projects', 'resources'),
        ('project-media', 'public', 'projects', 'uploaded_files'),
        ('project-media', 'public', 'projects', 'readme'),
        ('project-media', 'public', 'layouts', 'sections'),
        ('project-media', 'public', 'pages', 'config')
    ) AS registry(bucket, sch, tbl, col)
    WHERE registry.bucket = p_bucket
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = source.sch AND table_name = source.tbl
    ) OR NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = source.sch
        AND table_name = source.tbl
        AND column_name = source.col
    ) THEN
      RAISE NOTICE 'media_object_is_referenced: skipping missing source %.%.%',
        source.sch, source.tbl, source.col;
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I AS ref WHERE strpos(ref.%I::text, $1) > 0)',
      source.sch,
      source.tbl,
      source.col
    )
    INTO found_reference
    USING p_name;

    IF found_reference THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.media_object_is_referenced(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.prune_orphaned_media(
  p_bucket        text    DEFAULT NULL,
  p_min_age_hours integer DEFAULT 24,
  p_dry_run       boolean DEFAULT true
)
RETURNS TABLE (
  bucket_name text,
  candidates  bigint,
  retained    bigint,
  pruned      bigint,
  mode        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bucket_row record;
  object_row record;
  cutoff timestamptz;
  total_count bigint;
  retained_count bigint;
BEGIN
  IF p_min_age_hours < 0 THEN
    RAISE EXCEPTION 'p_min_age_hours must be >= 0 (got %)', p_min_age_hours;
  END IF;

  IF p_bucket IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = p_bucket) THEN
    RAISE EXCEPTION 'Unknown bucket: %', p_bucket;
  END IF;

  cutoff := now() - make_interval(hours => p_min_age_hours);

  FOR bucket_row IN
    SELECT DISTINCT registry.bucket AS id
    FROM (
      VALUES
        ('avatars'),
        ('banners'),
        ('team-avatars'),
        ('backgrounds'),
        ('skill-proofs'),
        ('challenge-submissions'),
        ('library-files'),
        ('project-media')
    ) AS registry(bucket)
    WHERE p_bucket IS NULL OR registry.bucket = p_bucket
    ORDER BY registry.bucket
  LOOP
    SELECT count(*)
    INTO total_count
    FROM storage.objects AS objects
    WHERE objects.bucket_id = bucket_row.id
      AND objects.created_at < cutoff;

    retained_count := 0;
    FOR object_row IN
      SELECT objects.name
      FROM storage.objects AS objects
      WHERE objects.bucket_id = bucket_row.id
        AND objects.created_at < cutoff
    LOOP
      IF public.media_object_is_referenced(bucket_row.id, object_row.name) THEN
        retained_count := retained_count + 1;
      END IF;
    END LOOP;

    bucket_name := bucket_row.id;
    candidates := total_count;
    retained := retained_count;
    pruned := total_count - retained_count;
    mode := CASE WHEN p_dry_run THEN 'dry-run' ELSE 'deleted' END;

    IF NOT p_dry_run AND total_count > retained_count THEN
      PERFORM set_config('storage.allow_delete_query', 'true', true);
      FOR object_row IN
        SELECT objects.name
        FROM storage.objects AS objects
        WHERE objects.bucket_id = bucket_row.id
          AND objects.created_at < cutoff
      LOOP
        IF NOT public.media_object_is_referenced(bucket_row.id, object_row.name) THEN
          DELETE FROM storage.objects AS objects
          WHERE objects.bucket_id = bucket_row.id
            AND objects.name = object_row.name;
        END IF;
      END LOOP;
    END IF;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_orphaned_media(text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_orphaned_media(text, integer, boolean)
  TO authenticated, service_role;
