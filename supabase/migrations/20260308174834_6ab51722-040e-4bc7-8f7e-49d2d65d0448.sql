
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_message', 'case_response', 'new_review'
  title text NOT NULL,
  body text,
  link text, -- URL to navigate to
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: create notification on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(full_name, nickname, 'Пользователь') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.receiver_id,
    'new_message',
    'Новое сообщение',
    sender_name || ': ' || LEFT(NEW.message_text, 100),
    '/chat?to=' || NEW.sender_id,
    jsonb_build_object('sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- Trigger: create notification on case response
CREATE OR REPLACE FUNCTION public.notify_case_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  case_client_id uuid;
  case_title text;
  lawyer_name text;
BEGIN
  SELECT client_id, title INTO case_client_id, case_title
  FROM public.cases WHERE id = NEW.case_id;

  SELECT COALESCE(full_name, nickname, 'Юрист') INTO lawyer_name
  FROM public.profiles WHERE user_id = NEW.lawyer_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    case_client_id,
    'case_response',
    'Отклик на дело',
    lawyer_name || ' откликнулся на «' || LEFT(case_title, 60) || '»',
    '/cases',
    jsonb_build_object('case_id', NEW.case_id, 'lawyer_id', NEW.lawyer_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_case_response
  AFTER INSERT ON public.case_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_case_response();

-- Trigger: notify lawyer on new review
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer_name text;
BEGIN
  SELECT COALESCE(full_name, nickname, 'Пользователь') INTO reviewer_name
  FROM public.profiles WHERE user_id = NEW.client_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.lawyer_id,
    'new_review',
    'Новый отзыв',
    reviewer_name || ' оставил оценку ' || NEW.rating || '/5',
    '/lawyers',
    jsonb_build_object('review_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();
