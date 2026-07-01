
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_daily_limit integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ai_unlimited_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_unlimited_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_updated_by uuid,
  ADD COLUMN IF NOT EXISTS ai_updated_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ai_daily_limit_positive CHECK (ai_daily_limit >= 0) NOT VALID;
