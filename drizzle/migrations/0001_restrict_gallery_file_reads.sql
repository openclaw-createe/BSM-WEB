DROP POLICY IF EXISTS "Public read gallery files" ON storage.objects;
CREATE POLICY "Admins read gallery files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'::public.app_role));