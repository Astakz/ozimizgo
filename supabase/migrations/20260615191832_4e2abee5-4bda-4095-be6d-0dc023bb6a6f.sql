
ALTER TABLE public.invite_codes 
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_invite_code(invite_code_value text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.invite_codes
    WHERE code = invite_code_value 
      AND is_used = false
      AND disabled = false
      AND (expires_at IS NULL OR expires_at > now())
  )
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.invite_codes;
ALTER TABLE public.invite_codes REPLICA IDENTITY FULL;
