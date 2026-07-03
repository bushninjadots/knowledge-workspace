
-- Public profiles at /u/:handle are meant to be viewable by signed-out
-- visitors, but the previous hardening pass restricted avatar/banner SELECT
-- to `authenticated` only, so anonymous visitors got no photo. Profile
-- photos are meant to be public-facing (like any creator profile picture),
-- so open read access back up while keeping writes owner-only.

DROP POLICY IF EXISTS "Authenticated can read avatars" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Banners readable to authenticated" ON storage.objects;

CREATE POLICY "Banner images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'banners');
