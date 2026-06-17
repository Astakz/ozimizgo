-- RLS policies invoke these SECURITY DEFINER helpers; authenticated role
-- must have EXECUTE so policies evaluate correctly. SECURITY DEFINER
-- still ensures they run with owner privileges.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_lawyer_perform_action(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nickname_unique(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_username() TO authenticated;