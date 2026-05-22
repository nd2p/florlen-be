-- supabase/migrations/20260428140014_015b_create_order_items.sql

CREATE TABLE public.order_items (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID            NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id            UUID            REFERENCES public.products(id) ON DELETE SET NULL,
  product_name          VARCHAR(255)    NOT NULL,
  product_sku           VARCHAR(100)    NOT NULL,
  product_image_url     TEXT,
  variant_label         VARCHAR(255),
  design_mockup_url     TEXT,
  design_summary        JSONB,
  unit_price            NUMERIC(12,2)   NOT NULL,
  customization_fee     NUMERIC(12,2)   NOT NULL DEFAULT 0,
  quantity              SMALLINT        NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  subtotal              NUMERIC(12,2)   NOT NULL,
  item_type             TEXT            NOT NULL CHECK (item_type IN ('normal','ai_personalization')),
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = order_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins manage all order items"
  ON public.order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_order_items_order ON public.order_items(order_id);
