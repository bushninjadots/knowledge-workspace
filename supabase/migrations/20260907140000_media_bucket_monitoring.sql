-- ============================================================================
-- Media bucket monitoring
--
-- Surfaces storage growth trends so an upload site that starts leaking files
-- (object count climbing faster than references grow) is visible instead of
-- silent. A daily pg_cron job records per-bucket object/byte counts into
-- media_bucket_snapshots; media_bucket_growth then compares the latest
-- snapshot with the oldest one from the last 7 days.
--
--   -- Latest 7-day growth per bucket:
--   SELECT * FROM public.media_bucket_growth ORDER BY object_growth_7d DESC;
--
-- The snapshot counts are cheap index scans over storage.objects — no text
-- scanning. Orphan detection itself stays with the (weekly) prune job.
--
-- Like the prune schedule, this job is created idempotently and skips
-- gracefully when pg_cron is unavailable.
-- ============================================================================

-- Snapshots are ops-only data; RLS on with no policies keeps them out of the
-- app data plane while the SECURITY DEFINER snapshot function (and pg_cron,
-- which runs as the table owner) can still write.
CREATE TABLE IF NOT EXISTS public.media_bucket_snapshots (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  taken_at     timestamptz NOT NULL DEFAULT now(),
  bucket       text NOT NULL,
  object_count bigint NOT NULL DEFAULT 0,
  byte_count   bigint NOT NULL DEFAULT 0
);

ALTER TABLE public.media_bucket_snapshots ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS media_bucket_snapshots_taken_idx
  ON public.media_bucket_snapshots (taken_at);
CREATE INDEX IF NOT EXISTS media_bucket_snapshots_bucket_idx
  ON public.media_bucket_snapshots (bucket, taken_at);

COMMENT ON TABLE public.media_bucket_snapshots
  IS 'Daily per-bucket storage object/byte counts recorded by the media-bucket-snapshot cron job.';

-- One row per bucket present in storage.buckets at snapshot time. Returns the
-- number of buckets recorded.
CREATE OR REPLACE FUNCTION public.record_media_bucket_snapshot()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buckets integer;
BEGIN
  INSERT INTO public.media_bucket_snapshots (bucket, object_count, byte_count)
  SELECT b.id,
         count(o.id),
         COALESCE(sum((o.metadata ->> 'size')::bigint), 0)
    FROM storage.buckets b
    LEFT JOIN storage.objects o ON o.bucket_id = b.id
   GROUP BY b.id;

  GET DIAGNOSTICS v_buckets = ROW_COUNT;
  RETURN v_buckets;
END;
$$;

-- Latest snapshot vs the oldest snapshot within the last 7 days.
CREATE OR REPLACE VIEW public.media_bucket_growth AS
WITH latest AS (
  SELECT DISTINCT ON (bucket) bucket, taken_at, object_count, byte_count
    FROM public.media_bucket_snapshots
   ORDER BY bucket, taken_at DESC
),
baseline AS (
  SELECT DISTINCT ON (bucket) bucket, object_count, byte_count
    FROM public.media_bucket_snapshots
   WHERE taken_at >= now() - interval '7 days'
   ORDER BY bucket, taken_at ASC
)
SELECT l.bucket,
       l.taken_at                              AS last_measured_at,
       l.object_count,
       l.byte_count,
       l.object_count - COALESCE(b.object_count, l.object_count) AS object_growth_7d,
       l.byte_count  - COALESCE(b.byte_count,  l.byte_count)    AS byte_growth_7d
  FROM latest l
  LEFT JOIN baseline b USING (bucket)
 ORDER BY l.bucket;

COMMENT ON VIEW public.media_bucket_growth
  IS 'Latest media bucket snapshot compared with the oldest snapshot from the last 7 days.';

-- Schedule the daily snapshot (03:17 UTC, right after the Monday prune window).
DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron unavailable — media snapshots not scheduled: %', SQLERRM;
      RETURN;
    END;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'media-bucket-snapshot';
  PERFORM cron.schedule(
    'media-bucket-snapshot',
    '17 3 * * *',  -- daily 03:17 UTC
    $cron$SELECT public.record_media_bucket_snapshot();$cron$
  );
END
$do$;
