
DROP POLICY IF EXISTS "Anyone can check invite codes" ON public.invite_codes;
CREATE POLICY "Admins can view invite codes"
  ON public.invite_codes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can read case responses" ON public.case_responses;
CREATE POLICY "Authorized parties can read case responses"
  ON public.case_responses FOR SELECT TO authenticated
  USING (
    auth.uid() = lawyer_id
    OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_responses.case_id AND c.client_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Anyone can read open cases" ON public.cases;
CREATE POLICY "Authorized parties can read cases"
  ON public.cases FOR SELECT TO authenticated
  USING (
    auth.uid() = client_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lawyer_case_permissions p
      WHERE p.case_id = cases.id AND p.lawyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Lawyers can insert own logs" ON public.lawyer_action_logs;

DROP POLICY IF EXISTS "Anyone can read permissions" ON public.lawyer_case_permissions;
CREATE POLICY "Authorized parties can read permissions"
  ON public.lawyer_case_permissions FOR SELECT TO authenticated
  USING (
    auth.uid() = lawyer_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = lawyer_case_permissions.case_id AND c.client_id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can view lawyer profiles" ON public.profiles;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_lawyer_perform_action(uuid, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_username() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_nickname_unique(text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.use_invite_code(text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_invite_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(text) TO anon, authenticated;
