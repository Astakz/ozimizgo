CREATE POLICY "Anyone can view lawyer roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'lawyer'::app_role);