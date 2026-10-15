DROP POLICY IF EXISTS "Anyone reads photos" ON public.gallery_photos;
DROP POLICY IF EXISTS "Anyone reads settings" ON public.site_settings;
CREATE POLICY "Admins read photos" ON public.gallery_photos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins read settings" ON public.site_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
REVOKE SELECT ON public.gallery_photos FROM anon;
REVOKE SELECT ON public.site_settings FROM anon;