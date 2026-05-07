-- supabase/migrations/20260428140011_012_create_carts.sql

CREATE TABLE public.carts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id      VARCHAR(255)  UNIQUE,
  currency        CHAR(3)       NOT NULL DEFAULT 'VND',
  coupon_code     VARCHAR(50),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  merged_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT cart_must_have_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
  ON public.carts
  USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

CREATE INDEX idx_carts_user_id    ON public.carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_carts_session_id ON public.carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_carts_expires_at ON public.carts(expires_at) WHERE expires_at IS NOT NULL;
