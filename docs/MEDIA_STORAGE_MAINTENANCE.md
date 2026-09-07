# Media Storage Maintenance

How uploaded files are stored, how orphans are pruned, and how bucket growth is
monitored. Everything below is implemented in migrations:

- `20260907120000_media_prune_tooling.sql` — `public.prune_orphaned_media()`
- `20260907130000_schedule_media_prune.sql` — weekly prune cron job
- `20260907140000_media_bucket_monitoring.sql` — daily usage snapshots + growth view

## Upload conventions (source of truth)

All client uploads must follow these rules or orphaned files accumulate:

1. **Unique path per upload.** Never reuse a fixed path with `upsert`. Every
   upload writes a fresh name (`<id>/<kind>-<Date.now()>.<ext>`, a UUID, or a
   timestamped file name). This is also what keeps signed/public URLs from
   going stale in the browser.
2. **Clean up the file you replaced.** When an upload supersedes an existing
   file, remove the previous object best-effort (never block the UI on it).
3. **No `upsert` on collision-prone paths.** A same-name collision should
   surface as an error, not silently replace an image a row still references.
4. **Persist the reference.** Every object must be pointed at by a row or by
   content stored in a row (a column, a JSON array, or rich text) — that is
   what makes it pruneable instead of orphaned.

## Pruning orphans

`public.prune_orphaned_media(p_bucket, p_min_age_hours, p_dry_run)` deletes
storage objects that no row references.

```sql
-- Preview everything (dry-run is the default)
SELECT * FROM public.prune_orphaned_media();

-- Preview one bucket
SELECT * FROM public.prune_orphaned_media('project-media');

-- Actually delete objects older than 48 h
SELECT * FROM public.prune_orphaned_media(p_dry_run := false, p_min_age_hours := 48);
```

Safety rails: dry-run by default, an age guard (default 24 h) so in-flight
uploads are never touched, schema-drift tolerance (missing reference columns
are skipped with a NOTICE), and Supabase's `storage.allow_delete_query` escape
hatch scoped to the current transaction.

### Reference registry — the contract ⚠️

The function decides "referenced" by checking each bucket's objects against a
**registry of reference sources** inside the function body. An object is kept
if its path appears anywhere in one of those columns (path columns, public
URLs that embed the path, JSON arrays, and rich-text bodies all match):

| Bucket                  | Reference sources (schema.table.column)                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `avatars`               | `profiles.avatar_url`                                                                                                                            |
| `banners`               | `profiles.banner_url`                                                                                                                            |
| `team-avatars`          | `teams.avatar_url`                                                                                                                               |
| `backgrounds`           | `profiles.background`, `profiles.public_background` (jsonb)                                                                                      |
| `skill-proofs`          | `profile_skills_teach.proof_url`                                                                                                                 |
| `challenge-submissions` | `challenge_participants.submission_url`                                                                                                          |
| `library-files`         | `library_items.file_url`, `library_items.content`                                                                                                |
| `project-media`         | `projects.cover_url`, `projects.gallery`, `projects.resources`, `projects.uploaded_files`, `projects.readme`, `layouts.sections`, `pages.config` |

**Whenever you add a new upload site, add its reference source to the registry
in `20260907120000_media_prune_tooling.sql`.** The only failure mode that can
lose data is an object that IS referenced somewhere we are not checking — the
registry is deliberately the complete list of where media can be referenced
today. Matching errs toward retention.

## Schedule

- **`prune-orphaned-media`** — `0 3 * * 1` (Mondays 03:00 UTC): runs
  `prune_orphaned_media(p_dry_run := false, p_min_age_hours := 48)`.
- **`media-bucket-snapshot`** — `17 3 * * *` (daily 03:17 UTC): records
  per-bucket object/byte counts into `media_bucket_snapshots`.

Both jobs are created idempotently by their migrations and skip gracefully
(RAISE NOTICE) when `pg_cron` is unavailable, so they never break a migration
run.

## Monitoring bucket growth

Daily snapshots land in `public.media_bucket_snapshots`
(`taken_at, bucket, object_count, byte_count`). Query the latest 7-day trend
with:

```sql
SELECT * FROM public.media_bucket_growth ORDER BY object_growth_7d DESC;
```

Columns: `last_measured_at`, `object_count`, `byte_count`, and the 7-day
deltas (`object_growth_7d`, `byte_growth_7d`). A bucket whose object count
climbs faster than its references grow is a sign an upload site is leaking
files — re-check that site against the upload conventions above.
