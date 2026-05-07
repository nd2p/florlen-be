-- supabase/migrations/20260428140013_014_create_payments.sql

CREATE TABLE public.payments (
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID            REFERENCES public.profiles(id),
  cart_id                 UUID            REFERENCES public.carts(id),
  order_id                UUID,
  payment_intent_id       VARCHAR(255)    NOT NULL,
  payment_type            TEXT            NOT NULL
                                          CHECK (payment_type IN ('deposit','remaining_balance','full_payment')),
  payment_method          TEXT            NOT NULL
                                          CHECK (payment_method IN ('payos_qr','bank_transfer','momo','vnpay','manual')),
  gateway                 TEXT            NOT NULL,
  amount                  NUMERIC(12,2)   NOT NULL,
  currency                CHAR(3)         NOT NULL DEFAULT 'VND',
  status                  TEXT            NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending','processing','succeeded','failed','refunded','partially_refunded')),
  failure_code            VARCHAR(100),
  failure_message         TEXT,
  refund_amount           NUMERIC(12,2)   NOT NULL DEFAULT 0,
  refunded_at             TIMESTAMPTZ,
  refund_reason           TEXT,
  qr_code_url             TEXT,
  qr_expires_at           TIMESTAMPTZ,
  qr_poll_count           SMALLINT        NOT NULL DEFAULT 0,
  manually_confirmed_by   UUID            REFERENCES public.profiles(id),
  manually_confirmed_at   TIMESTAMPTZ,
  gateway_response        JSONB,
  ip_address              INET,
  user_agent              TEXT,
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uq_payments_intent UNIQUE (payment_intent_id)
);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all payments"
  ON public.payments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_payments_intent      ON public.payments(payment_intent_id);
CREATE INDEX idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX idx_payments_cart        ON public.payments(cart_id);
CREATE INDEX idx_payments_type_status ON public.payments(payment_type, status);
