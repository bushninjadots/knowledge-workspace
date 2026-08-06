DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Banners are publicly accessible" ON storage.objects;
CREATE POLICY "Banners are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
DROP POLICY IF EXISTS "Banners owner insert" ON storage.objects;
CREATE POLICY "Banners owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='banners' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Banners owner update" ON storage.objects;
CREATE POLICY "Banners owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='banners' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Banners owner delete" ON storage.objects;
CREATE POLICY "Banners owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='banners' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Project media is publicly accessible" ON storage.objects;
CREATE POLICY "Project media is publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'project-media');
DROP POLICY IF EXISTS "Project media owner insert" ON storage.objects;
CREATE POLICY "Project media owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Project media owner update" ON storage.objects;
CREATE POLICY "Project media owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Project media owner delete" ON storage.objects;
CREATE POLICY "Project media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='project-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','comments','notifications','connections','activity_events','messages'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;