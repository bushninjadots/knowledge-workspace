-- ============================================================================
-- Crew banners and richer crew identity
--
-- The crew page gets a banner section (banner + profile photo + caption) and a
-- crew-settings surface. This migration adds the fields those surfaces render:
--   • caption      — short one-line tagline shown in the crew header
--   • website_url  — the crew's own site / external homepage
--   • social_links — keyed like profiles.social_links (github, x, youtube, …)
-- plus a private `team-covers` bucket (lead-only writes, image-only 8 MB gate
-- via the shared storage-upload predicate) and the media-prune registry row,
-- so replaced banners are cleaned up like every other upload site.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New teams columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.teams.caption IS
  'Short one-line tagline shown under the crew name in the crew header.';
COMMENT ON COLUMN public.teams.website_url IS
  'The crew''s website or external homepage, linked from the crew header.';
COMMENT ON COLUMN public.teams.social_links IS
  'Social presence keyed like profiles.social_links (github, x, youtube, ...).';

-- ---------------------------------------------------------------------------
-- 2. team-covers bucket (banner uploads)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-covers', 'team-covers', false)
ON CONFLICT (id) DO NOTHING;

-- Image-only, 8 MB — same cap as team-avatars/banners (validateImageFile).
UPDATE storage.buckets SET file_size_limit = 8388608 WHERE id = 'team-covers';

-- Public read: signed URLs are shown on public crew pages.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team covers are publicly readable" ON storage.objects;
  CREATE POLICY "Team covers are publicly readable"
    ON storage.objects FOR SELECT USING (bucket_id = 'team-covers');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Leads can upload/replace/delete the team banner. The path is
-- teams/<teamId>/... so the first folder identifies the team — mirroring
-- team-avatars exactly, including the shared upload gate.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads upload team cover" ON storage.objects;
  CREATE POLICY "Team leads upload team cover"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'team-covers'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
      AND public.is_allowed_storage_upload('team-covers', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads update team cover" ON storage.objects;
  CREATE POLICY "Team leads update team cover"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'team-covers'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    )
    WITH CHECK (
      bucket_id = 'team-covers'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
      AND public.is_allowed_storage_upload('team-covers', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads delete team cover" ON storage.objects;
  CREATE POLICY "Team leads delete team cover"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'team-covers'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------------------------------------------------------------------------
-- 3. Shared upload gate: extend with team-covers (image-only, 8 MB).
--    CREATE OR REPLACE preserves existing EXECUTE grants, so the anon
--    allowlist pinned by supabase/tests/anon_execute_grants.sql is untouched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_allowed_storage_upload(
  p_bucket text,
  p_name text,
  p_metadata jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_bucket
    WHEN 'avatars' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','gif')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 8388608
    WHEN 'banners' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','gif')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 8388608
    WHEN 'backgrounds' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','gif')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 8388608
    WHEN 'team-avatars' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','gif')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 8388608
    WHEN 'team-covers' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','gif')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 8388608
    WHEN 'skill-proofs' THEN
      lower(storage.extension(p_name)) IN ('jpg','jpeg','png','webp','pdf')
      AND COALESCE((p_metadata->>'size')::bigint, 0) <= 15728640
    WHEN 'project-media' THEN
      lower(storage.extension(p_name)) IN (
        -- images
        'jpg','jpeg','png','webp','gif','svg','bmp','tiff','tif','ico','heic','heif',
        -- raw / design
        'psd','ai','eps','sketch','fig','xd','indd','afdesign','afphoto',
        -- documents
        'pdf','doc','docx','ppt','pptx','xls','xlsx','odt','ods','odp','pages','numbers','key',
        -- text & code
        'txt','md','csv','json','xml','yaml','yml','toml','rtf','tex','log',
        'html','css','scss','less','js','jsx','ts','tsx','py','rb','go','rs',
        'java','kt','swift','c','cpp','h','sh','bash','zsh','sql','r','lua','php',
        -- video
        'mp4','webm','mov','avi','mkv','wmv','flv','m4v',
        -- audio
        'mp3','wav','aac','ogg','flac','m4a','wma','aiff',
        -- 3D / CAD
        'blend','fbx','obj','stl','glb','gltf','usd','usdz','dae','3ds','max','ma','mb','c4d',
        -- archives
        'zip','rar','7z','tar','gz','bz2','xz',
        -- fonts
        'ttf','otf','woff','woff2',
        -- other
        'unitypackage','uproject','apk','ipa'
      )
      AND COALESCE((p_metadata->>'size')::bigint, 0) <=
        CASE
          WHEN lower(storage.extension(p_name)) IN ('mp4','webm','mov','avi','mkv','wmv','flv','m4v')
            THEN 209715200  -- 200 MB video
          WHEN lower(storage.extension(p_name)) IN ('mp3','wav','aac','ogg','flac','m4a','wma','aiff')
            THEN 104857600  -- 100 MB audio
          ELSE 52428800     -- 50 MB everything else
        END
    WHEN 'library-files' THEN
      lower(storage.extension(p_name)) IN (
        'jpg','jpeg','png','webp','gif','svg','bmp','tiff','tif','ico','heic','heif',
        'psd','ai','eps','sketch','fig','xd','indd','afdesign','afphoto',
        'pdf','doc','docx','ppt','pptx','xls','xlsx','odt','ods','odp','pages','numbers','key',
        'txt','md','csv','json','xml','yaml','yml','toml','rtf','tex','log',
        'html','css','scss','less','js','jsx','ts','tsx','py','rb','go','rs',
        'java','kt','swift','c','cpp','h','sh','bash','zsh','sql','r','lua','php',
        'mp4','webm','mov','avi','mkv','wmv','flv','m4v',
        'mp3','wav','aac','ogg','flac','m4a','wma','aiff',
        'blend','fbx','obj','stl','glb','gltf','usd','usdz','dae','3ds','max','ma','mb','c4d',
        'zip','rar','7z','tar','gz','bz2','xz',
        'ttf','otf','woff','woff2',
        'unitypackage','uproject','apk','ipa'
      )
      AND COALESCE((p_metadata->>'size')::bigint, 0) <=
        CASE
          WHEN lower(storage.extension(p_name)) IN ('mp4','webm','mov','avi','mkv','wmv','flv','m4v')
            THEN 209715200
          WHEN lower(storage.extension(p_name)) IN ('mp3','wav','aac','ogg','flac','m4a','wma','aiff')
            THEN 104857600
          ELSE 52428800
        END
    WHEN 'challenge-submissions' THEN
      lower(storage.extension(p_name)) IN (
        'jpg','jpeg','png','webp','gif','svg','bmp','tiff','tif','ico','heic','heif',
        'psd','ai','eps','sketch','fig','xd','indd','afdesign','afphoto',
        'pdf','doc','docx','ppt','pptx','xls','xlsx','odt','ods','odp','pages','numbers','key',
        'txt','md','csv','json','xml','yaml','yml','toml','rtf','tex','log',
        'html','css','scss','less','js','jsx','ts','tsx','py','rb','go','rs',
        'java','kt','swift','c','cpp','h','sh','bash','zsh','sql','r','lua','php',
        'mp4','webm','mov','avi','mkv','wmv','flv','m4v',
        'mp3','wav','aac','ogg','flac','m4a','wma','aiff',
        'blend','fbx','obj','stl','glb','gltf','usd','usdz','dae','3ds','max','ma','mb','c4d',
        'zip','rar','7z','tar','gz','bz2','xz',
        'ttf','otf','woff','woff2',
        'unitypackage','uproject','apk','ipa'
      )
      AND COALESCE((p_metadata->>'size')::bigint, 0) <=
        CASE
          WHEN lower(storage.extension(p_name)) IN ('mp4','webm','mov','avi','mkv','wmv','flv','m4v')
            THEN 209715200
          WHEN lower(storage.extension(p_name)) IN ('mp3','wav','aac','ogg','flac','m4a','wma','aiff')
            THEN 104857600
          ELSE 52428800
        END
    ELSE false
  END
$$;

-- ---------------------------------------------------------------------------
-- 4. Media-prune registry: team-covers objects are referenced by teams.cover_url
-- ---------------------------------------------------------------------------
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
    ('team-covers',           'public', 'teams',                  'cover_url'),
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

-- New columns must reach PostgREST (api) and the storage service.
NOTIFY pgrst, 'reload schema';