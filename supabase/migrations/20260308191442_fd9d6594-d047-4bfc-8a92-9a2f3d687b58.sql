
-- Function to check if a nickname/username is unique
CREATE OR REPLACE FUNCTION public.is_nickname_unique(check_nickname text, exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE nickname = check_nickname
    AND (exclude_user_id IS NULL OR user_id != exclude_user_id)
  )
$$;

-- Function to generate a unique username
CREATE OR REPLACE FUNCTION public.generate_unique_username()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_username text;
  is_unique boolean := false;
BEGIN
  WHILE NOT is_unique LOOP
    new_username := 'User' || floor(random() * 90000 + 10000)::int::text;
    SELECT NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE nickname = new_username
    ) INTO is_unique;
  END LOOP;
  RETURN new_username;
END;
$$;

-- Update handle_new_user to auto-generate username if not provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  generated_nickname text;
BEGIN
  -- Use provided nickname or generate one
  IF NEW.raw_user_meta_data->>'nickname' IS NOT NULL AND NEW.raw_user_meta_data->>'nickname' != '' THEN
    generated_nickname := NEW.raw_user_meta_data->>'nickname';
  ELSE
    generated_nickname := public.generate_unique_username();
  END IF;

  INSERT INTO public.profiles (user_id, name, email, invite_code, nickname, full_name, specialization, profession)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'invite_code', ''),
    generated_nickname,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'specialization' IS NOT NULL 
      THEN string_to_array(NEW.raw_user_meta_data->>'specialization', ',')
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'profession', '')
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user'));
  RETURN NEW;
END;
$function$;
