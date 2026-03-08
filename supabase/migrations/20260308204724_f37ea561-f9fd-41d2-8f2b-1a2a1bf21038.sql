
CREATE POLICY "Admins can delete any document"
ON public.documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
