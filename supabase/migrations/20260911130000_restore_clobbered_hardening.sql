-- ============================================================================
-- Restore hardening clobbered by the v0 replay migrations
-- ============================================================================
-- A batch of UUID-named migrations from the v0/Lovable agent re-applied older
-- definitions on top of newer security work. Every statement in them is
-- idempotent, so nothing failed loudly — the hardening was simply undone, and
-- the pgTAP pins that guard it had been red since 2026-09-04:
--
--   20260904132208  re-added a table-wide
--                     GRANT SELECT, INSERT, UPDATE, DELETE ON connected_accounts
--                   TO authenticated, undoing the column-scoped grants from
--                   20260822030000_restrict_connected_account_columns. Any
--                   authenticated browser session could read its own OAuth
--                   access_token through PostgREST again.
--
--   20260904132407  recreated "Project media owner insert"/"...update" without
--                   public.is_allowed_storage_upload(), undoing the per-type
--                   size gate from 20260820180000_storage_upload_hardening.
--                   Only the 200 MB bucket cap was left, so a 50 MB+ .pdf (or
--                   any extension at all) landed.
--
--   20260906100554  did the same to "Team leads upload/update team avatar",
--                   leaving any file type up to the 8 MB bucket cap.
--
-- This migration restates both. Predicates are copied from the *latest*
-- definitions so the replay's contributor/ownership conditions are preserved
-- exactly; only the missing conditions are added back. UPDATE policies get back
-- their WITH CHECK — the gate belongs on the new row, not just the old one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. connected_accounts: tokens and metadata are service-role only
-- ---------------------------------------------------------------------------
-- RLS already limited rows to their owner, but an owner's raw access_token must
-- never reach the browser (XSS / shared-device risk). Server code reads tokens
-- with the service role, which keeps its table-level ALL and is unaffected.
REVOKE ALL ON public.connected_accounts FROM anon;
REVOKE ALL ON public.connected_accounts FROM authenticated;

GRANT SELECT (id, user_id, provider, provider_id, username, created_at, updated_at)
  ON public.connected_accounts TO authenticated;
GRANT INSERT (user_id, provider, provider_id, username)
  ON public.connected_accounts TO authenticated;
GRANT UPDATE (provider_id, username)
  ON public.connected_accounts TO authenticated;
GRANT DELETE ON public.connected_accounts TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. project-media: restore the extension + per-type size gate
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. team-avatars: restore the image-only 8 MB gate
-- ---------------------------------------------------------------------------
-- Matches validateImageFile() in src/lib/validators.ts, which team-page.tsx
-- already runs before every crew-picture upload.
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

-- Column grants change what PostgREST exposes, so refresh its schema cache.
NOTIFY pgrst, 'reload schema';
