
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_review() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_case_response() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_review_rating() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_lawyer_perform_action(uuid, uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_unique_username() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_nickname_unique(text, uuid) FROM anon, authenticated, PUBLIC;
