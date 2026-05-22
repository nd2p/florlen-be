-- supabase/migrations/20260428140014_015_create_orders.sql

CREATE TABLE public.orders (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          VARCHAR(20)     NOT NULL,
  user_id               UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_id            UUID            NOT NULL REFERENCES public.payments(id),
  -- Status
  status                TEXT            NOT NULL DEFAULT 'confirmed'
                                        CHECK (status IN (
                                          'draft','confirmed','in_production','quality_check',
                                          'awaiting_remaining_payment','ready_to_ship',
                                          'shipping','completed','cancelled'
                                        )),
  status_updated_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  -- Pricing
  subtotal              NUMERIC(12,2)   NOT NULL,
  discount_amount       NUMERIC(12,2)   NOT NULL DEFAULT 0,
  shipping_fee          NUMERIC(12,2)   NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2)   NOT NULL,
  currency              CHAR(3)         NOT NULL DEFAULT 'VND',
  -- Payment option
  payment_option        TEXT            NOT NULL CHECK (payment_option IN ('full','deposit')),
  deposit_rate          NUMERIC(5,4)    NOT NULL,
  deposit_amount        NUMERIC(12,2)   NOT NULL,
  deposit_payment_id    UUID            REFERENCES public.payments(id),
  deposit_paid_at       TIMESTAMPTZ,
  remaining_amount      NUMERIC(12,2)   NOT NULL,
  remaining_payment_id  UUID            REFERENCES public.payments(id),
  remaining_paid_at     TIMESTAMPTZ,
  remaining_due_date    DATE,
  payment_stage         TEXT            NOT NULL DEFAULT 'deposit_pending'
                                        CHECK (payment_stage IN ('deposit_pending','deposit_paid','fully_paid','refunded')),
  -- Shipping
  recipient_name        VARCHAR(255)    NOT NULL,
  recipient_phone       VARCHAR(20)     NOT NULL,
  shipping_address      JSONB           NOT NULL,
  shipping_carrier      VARCHAR(100),
  tracking_number       VARCHAR(255),
  tracking_url          TEXT,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  -- Production
  production_started_at TIMESTAMPTZ,
  production_notes      TEXT,
  estimated_production_days INTEGER     NOT NULL,
  estimated_delivery    DATE            NOT NULL,
  -- Cancellation
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID            REFERENCES public.profiles(id),
  cancellation_reason   TEXT,
  refund_status         TEXT            CHECK (refund_status IN ('not_applicable','pending','processed')),
  customer_note         TEXT,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uq_orders_number UNIQUE (order_number)
);

-- FK ngược từ payments.order_id về orders (payments tạo trước)
ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_order
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all orders"
  ON public.orders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_orders_user_status   ON public.orders(user_id, status);
CREATE INDEX idx_orders_number        ON public.orders(order_number);
CREATE INDEX idx_orders_status        ON public.orders(status, created_at DESC);
CREATE INDEX idx_orders_tracking      ON public.orders(tracking_number) WHERE tracking_number IS NOT NULL;
