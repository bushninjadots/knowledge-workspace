-- ============================================================================
-- Schedule the orphaned-media prune
--
-- Runs public.prune_orphaned_media weekly (Mondays 03:00 UTC) so storage
-- objects no longer referenced by any row clean themselves up instead of
-- accumulating. The job only ever deletes objects older than 48 hours
-- (p_min_age_hours := 48), so in-flight uploads are never at risk.
--
-- pg_cron ships with Supabase but is not always installed/enabled (and can be
-- disabled by the project), so this migration installs it when possible and
-- otherwise skips scheduling with a NOTICE — it must never break a migration
-- run. Re-running is safe: the job is unscheduled and recreated under the
-- same name (idempotent).
--
-- Inspect afterwards:
--   SELECT jobid, jobname, schedule, command FROM cron.job
--     WHERE jobname = 'prune-orphaned-media';
-- ============================================================================

DO $do$
BEGIN
  -- Ensure the cron extension/namespace exists (best effort).
  IF to_regnamespace('cron') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron unavailable — media prune not scheduled: %', SQLERRM;
      RETURN;
    END;
  END IF;

  -- Idempotent: drop any previous job with this name, then (re)schedule.
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'prune-orphaned-media';
  PERFORM cron.schedule(
    'prune-orphaned-media',
    '0 3 * * 1',  -- Mondays 03:00 UTC
    $cron$SELECT public.prune_orphaned_media(p_dry_run := false, p_min_age_hours := 48);$cron$
  );
END
$do$;
