
-- banners
CREATE POLICY "Banners readable to authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'banners');
CREATE POLICY "Banners owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Banners owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Banners owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

-- project-media
CREATE POLICY "Project media readable to authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-media');
CREATE POLICY "Project media owner insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Project media owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Project media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-media' AND (storage.foldername(name))[1] = auth.uid()::text);
