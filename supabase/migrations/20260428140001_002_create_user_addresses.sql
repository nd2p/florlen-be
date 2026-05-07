-- supabase/migrations/20260428140001_002_create_user_addresses.sql

CREATE TABLE public.user_addresses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label             VARCHAR(50),
  is_default        BOOLEAN       NOT NULL DEFAULT false,
  recipient_name    VARCHAR(255)  NOT NULL,
  phone_number      VARCHAR(20)   NOT NULL,
  address_line_1    VARCHAR(255)  NOT NULL,
  address_line_2    VARCHAR(255),
  city              VARCHAR(100)  NOT NULL,
  province_state    VARCHAR(100),
  postal_code       VARCHAR(20),
  country_code      CHAR(2)       NOT NULL DEFAULT 'VN',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses"
  ON public.user_addresses
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_addresses_default ON public.user_addresses(user_id, is_default);
