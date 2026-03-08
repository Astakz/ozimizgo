
-- Reviews table for lawyer ratings
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 5,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lawyer_id, client_id)
);

-- Validation trigger for rating (1-5)
CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_review_rating
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_rating();

-- Cases table
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  case_type text NOT NULL DEFAULT 'civil',
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Case responses from lawyers
CREATE TABLE public.case_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  lawyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Messages table for direct chat
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Reviews RLS: anyone authenticated can read, clients can insert/update their own
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clients can insert reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete own reviews" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = client_id);

-- Cases RLS: authenticated can read open cases, clients manage their own
CREATE POLICY "Anyone can read open cases" ON public.cases FOR SELECT TO authenticated USING (status = 'open' OR auth.uid() = client_id);
CREATE POLICY "Clients can create cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own cases" ON public.cases FOR UPDATE TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete own cases" ON public.cases FOR DELETE TO authenticated USING (auth.uid() = client_id);

-- Case responses RLS
CREATE POLICY "Anyone can read case responses" ON public.case_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lawyers can respond to cases" ON public.case_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = lawyer_id);
CREATE POLICY "Lawyers can update own responses" ON public.case_responses FOR UPDATE TO authenticated USING (auth.uid() = lawyer_id);
CREATE POLICY "Lawyers can delete own responses" ON public.case_responses FOR DELETE TO authenticated USING (auth.uid() = lawyer_id);

-- Messages RLS: sender and receiver can read, sender can insert
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
