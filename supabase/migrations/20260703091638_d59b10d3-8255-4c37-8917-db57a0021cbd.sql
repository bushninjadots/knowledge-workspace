
-- activity_events: restrict SELECT to owner, add owner-only INSERT policy
DROP POLICY IF EXISTS "Activity viewable by everyone" ON public.activity_events;

CREATE POLICY "Owner can read own activity"
  ON public.activity_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Owner can insert own activity"
  ON public.activity_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- avatars bucket: replace public SELECT with authenticated-only SELECT
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated can read avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
