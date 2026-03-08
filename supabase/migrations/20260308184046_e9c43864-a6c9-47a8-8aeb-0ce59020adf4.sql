-- Add 'lawyer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lawyer';

-- Permissions that admin can grant to lawyers per case
CREATE TABLE public.lawyer_case_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id uuid NOT NULL,
  permission_type text NOT NULL CHECK (permission_type IN ('view_profile', 'create_consultation', 'add_comment', 'create_document')),
  granted_by uuid NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (case_id, lawyer_id, permission_type)
);

-- Log of lawyer actions for monthly rate limiting
CREATE TABLE public.lawyer_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('view_profile', 'create_consultation', 'add_comment', 'create_document')),
  performed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lawyer_case_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_action_logs ENABLE ROW LEVEL SECURITY;

-- RLS for lawyer_case_permissions
CREATE POLICY "Anyone can read permissions" ON public.lawyer_case_permissions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage permissions" ON public.lawyer_case_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS for lawyer_action_logs
CREATE POLICY "Lawyers can view own logs" ON public.lawyer_action_logs
  FOR SELECT USING (auth.uid() = lawyer_id);

CREATE POLICY "Lawyers can insert own logs" ON public.lawyer_action_logs
  FOR INSERT WITH CHECK (auth.uid() = lawyer_id);

CREATE POLICY "Admins can view all logs" ON public.lawyer_action_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Function to check if lawyer can perform action (has permission + not used this month)
CREATE OR REPLACE FUNCTION public.can_lawyer_perform_action(
  _lawyer_id uuid,
  _case_id uuid,
  _action_type text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lawyer_case_permissions
    WHERE lawyer_id = _lawyer_id 
      AND case_id = _case_id 
      AND permission_type = _action_type
  ) AND NOT EXISTS (
    SELECT 1 FROM public.lawyer_action_logs
    WHERE lawyer_id = _lawyer_id 
      AND case_id = _case_id 
      AND action_type = _action_type
      AND performed_at >= date_trunc('month', now())
  )
$$;