
CREATE TABLE public.signature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_file_path TEXT NOT NULL,
  signed_file_path TEXT,
  page_count INT NOT NULL DEFAULT 1,
  file_size BIGINT NOT NULL DEFAULT 0,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  signer_name TEXT,
  signer_email TEXT,
  opened_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signer_ip TEXT,
  signer_ua TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sig_req_owner ON public.signature_requests(owner_id);
CREATE INDEX idx_sig_req_token ON public.signature_requests(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_requests TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own requests"
ON public.signature_requests FOR ALL
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sig_req_updated BEFORE UPDATE ON public.signature_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.signature_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sig_audit_req ON public.signature_audit(request_id);

GRANT SELECT, INSERT ON public.signature_audit TO authenticated;
GRANT SELECT, INSERT ON public.signature_audit TO anon;
GRANT ALL ON public.signature_audit TO service_role;

ALTER TABLE public.signature_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own audit"
ON public.signature_audit FOR SELECT
USING (EXISTS (SELECT 1 FROM public.signature_requests r WHERE r.id = request_id AND r.owner_id = auth.uid()));

CREATE POLICY "Anyone inserts audit"
ON public.signature_audit FOR INSERT
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(_token TEXT)
RETURNS TABLE (
  id UUID, title TEXT, page_count INT, file_size BIGINT,
  status TEXT, expires_at TIMESTAMPTZ, fields JSONB,
  original_file_path TEXT, created_at TIMESTAMPTZ,
  owner_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.title, r.page_count, r.file_size, r.status, r.expires_at, r.fields,
         r.original_file_path, r.created_at,
         COALESCE(p.full_name, p.nickname, 'Пользователь') as owner_name
  FROM public.signature_requests r
  LEFT JOIN public.profiles p ON p.user_id = r.owner_id
  WHERE r.token = _token
    AND (r.expires_at IS NULL OR r.expires_at > now())
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(TEXT) TO anon, authenticated;
