-- ============================================================================
-- Storage upload hardening: server-side file-type + size enforcement.
--
-- The client already validates uploads (src/lib/validators.ts), but the RLS
-- policies previously only checked the owner folder — the "final line of
-- defence" the code comments promise didn't actually exist. Anyone could POST
-- straight to the storage API (or the objects table) with an .exe, a 2 GB
-- file, or an SVG with embedded scripts.
--
-- This migration adds two layers:
--   1. file_size_limit on every bucket  — enforced by the storage service
--      itself, so even service-role uploads are capped.
--   2. Extension + size checks inside the INSERT/UPDATE policies, mirroring
--      the client validators exactly (images 8 MB, proofs 15 MB, library
--      files 50/100/200 MB).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Bucket-level size caps (enforced server-side by the storage service)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
  SET file_size_limit = 8388608      -- 8 MB  (validateImageFile)
  WHERE id IN ('avatars', 'banners', 'backgrounds', 'team-avatars');

UPDATE storage.buckets
  SET file_size_limit = 15728640     -- 15 MB (validateProofFile)
  WHERE id = 'skill-proofs';

UPDATE storage.buckets
  SET file_size_limit = 209715200    -- 200 MB (validateLibraryFile video max)
  WHERE id IN ('project-media', 'library-files', 'challenge-submissions');

-- ---------------------------------------------------------------------------
-- 2. Shared upload gate used by the storage policies below.
--    Mirrors src/lib/validators.ts:
--      validateImageFile   -> jpg/jpeg/png/webp/gif,   <= 8 MB
--      validateProofFile   -> jpg/jpeg/png/webp/pdf,   <= 15 MB
--      validateLibraryFile -> LIBRARY_FILE_EXTS, video 200 MB / audio 100 MB /
--                             everything else 50 MB
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

REVOKE ALL ON FUNCTION public.is_allowed_storage_upload(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_allowed_storage_upload(text, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Recreate INSERT/UPDATE policies with the upload gate.
--    Ownership/folder conditions are preserved exactly; the gate is appended.
-- ---------------------------------------------------------------------------

-- avatars ------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
  CREATE POLICY "Users upload own avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('avatars', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
  CREATE POLICY "Users update own avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (
      bucket_id = 'avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('avatars', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- banners ------------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners owner insert" ON storage.objects;
  CREATE POLICY "Banners owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'banners'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('banners', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Banners owner update" ON storage.objects;
  CREATE POLICY "Banners owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (
      bucket_id = 'banners'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('banners', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- backgrounds --------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Background owner insert" ON storage.objects;
  CREATE POLICY "Background owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'backgrounds'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('backgrounds', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Background owner update" ON storage.objects;
  CREATE POLICY "Background owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'backgrounds' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (
      bucket_id = 'backgrounds'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('backgrounds', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- team-avatars -------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads upload team avatar" ON storage.objects;
  CREATE POLICY "Team leads upload team avatar"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
      AND public.is_allowed_storage_upload('team-avatars', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Team leads update team avatar" ON storage.objects;
  CREATE POLICY "Team leads update team avatar"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
    )
    WITH CHECK (
      bucket_id = 'team-avatars'
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.profile_id = auth.uid()
          AND tm.role = 'lead'
          AND tm.team_id::text = (storage.foldername(name))[1]
      )
      AND public.is_allowed_storage_upload('team-avatars', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- skill-proofs -------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner can upload skill proof files" ON storage.objects;
  CREATE POLICY "Owner can upload skill proof files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'skill-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('skill-proofs', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner can replace skill proof files" ON storage.objects;
  CREATE POLICY "Owner can replace skill proof files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'skill-proofs' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (
      bucket_id = 'skill-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('skill-proofs', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- project-media ------------------------------------------------------------
-- Owners and contributors may upload into the project folder. The USING/WITH
-- CHECK contributor conditions are preserved from the earlier hardening pass.
DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner insert" ON storage.objects;
  CREATE POLICY "Project media owner insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
      AND public.is_allowed_storage_upload('project-media', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Project media owner update" ON storage.objects;
  CREATE POLICY "Project media owner update"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
    )
    WITH CHECK (
      bucket_id = 'project-media'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND (
              p.profile_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.project_contributors pc
                WHERE pc.project_id = p.id AND pc.profile_id = auth.uid()
              )
            )
        )
      )
      AND public.is_allowed_storage_upload('project-media', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- library-files ------------------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner insert library files" ON storage.objects;
  CREATE POLICY "Owner insert library files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'library-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
      AND public.is_allowed_storage_upload('library-files', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Owner update library files" ON storage.objects;
  CREATE POLICY "Owner update library files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'library-files' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (
      bucket_id = 'library-files'
      AND auth.uid()::text = (storage.foldername(name))[1]
      AND public.is_allowed_storage_upload('library-files', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- challenge-submissions ----------------------------------------------------
DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants upload submissions" ON storage.objects;
  CREATE POLICY "Challenge participants upload submissions"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'challenge-submissions'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('challenge-submissions', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Challenge participants manage own submissions" ON storage.objects;
  CREATE POLICY "Challenge participants manage own submissions"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'challenge-submissions' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (
      bucket_id = 'challenge-submissions'
      AND (storage.foldername(name))[1] = auth.uid()::text
      AND public.is_allowed_storage_upload('challenge-submissions', name, metadata)
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
