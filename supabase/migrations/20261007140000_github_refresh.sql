-- ============================================================================
-- GitHub: crew organisations, and a daily refresh
--
-- • teams.github_snapshot caches a crew's public GitHub repositories (from
--   its github link) so the crew page never calls GitHub:
--     { org, repos: [{ full_name, description, language, stargazers_count }],
--       synced_at }
--   Written by the server only (refreshTeamSnapshot in src/lib/github-refresh.ts).
--
-- • A daily job (04:15 UTC) asks the app to refresh every linked repo's
--   snapshot and every crew's organisation: POST {site}/api/cron/github-refresh
--   with the shared secret. It needs pg_cron + pg_net and two Vault secrets:
--
--     select vault.create_secret('https://your-site.example', 'tethyr_site_url');
--     select vault.create_secret('<same value as GITHUB_REFRESH_SECRET>',
--                                'github_refresh_secret');
--
--   Until they exist the job runs and does nothing. Missing extensions skip
--   scheduling with a NOTICE — this migration never fails a run, and
--   re-running it is safe.
--
-- Inspect: SELECT jobname, schedule FROM cron.job WHERE jobname = 'github-refresh';
-- ============================================================================

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS github_snapshot JSONB;

COMMENT ON COLUMN public.teams.github_snapshot IS
  'Cached public GitHub repos of the crew''s organisation ({ org, repos, synced_at }); NULL = none.';

DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron/pg_net unavailable — GitHub refresh not scheduled: %', SQLERRM;
    RETURN;
  END;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'github-refresh';
  PERFORM cron.schedule(
    'github-refresh',
    '15 4 * * *',  -- daily, 04:15 UTC
    $cron$
      SELECT net.http_post(
        url := site.url || '/api/cron/github-refresh',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || secret.value,
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      )
      FROM (SELECT decrypted_secret AS url FROM vault.decrypted_secrets
             WHERE name = 'tethyr_site_url') AS site,
           (SELECT decrypted_secret AS value FROM vault.decrypted_secrets
             WHERE name = 'github_refresh_secret') AS secret;
    $cron$
  );
END
$do$;
