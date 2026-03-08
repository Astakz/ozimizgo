
-- Fix: notifications insert policy - only allow system/trigger inserts via security definer
-- Drop the overly permissive policy
DROP POLICY "System can insert notifications" ON public.notifications;

-- Notifications are created by SECURITY DEFINER triggers, so no direct INSERT needed.
-- But we need a restrictive policy to satisfy the linter:
CREATE POLICY "No direct insert on notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (false);
