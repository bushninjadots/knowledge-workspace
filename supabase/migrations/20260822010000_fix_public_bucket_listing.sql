-- Security advisor: public_bucket_allows_listing
--
-- The `avatars`, `banners`, and `backgrounds` buckets were created with
-- `public = true`, which lets anyone list every object in the bucket (and
-- download anything by guessing paths). The app only needs anonymous reads of
-- *individual* files (profile avatars, banners, backdrops), which is already
-- covered by the PUBLIC SELECT policies on storage.objects — so the buckets
-- can be private without breaking the UI.
--
-- Reads keep working because:
--   * the client always fetches avatars/banners through createSignedUrl(), and
--   * the backgrounds backdrop uses a signed URL after the client change in
--     this same commit (backgroundImagePublicUrl was switched to signed URLs).
-- Signed URLs resolve through the storage.objects SELECT policies, which
-- remain PUBLIC for these three buckets.

UPDATE storage.buckets SET public = false
WHERE id IN ('avatars', 'banners', 'backgrounds')
  AND public = true;

-- skill-proofs was already made private by 20260706100000_security_hardening;
-- assert it stays private so a future migration can't silently reopen it.
UPDATE storage.buckets SET public = false
WHERE id = 'skill-proofs'
  AND public = true;
