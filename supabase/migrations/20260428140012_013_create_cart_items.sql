-- supabase/migrations/20260428140012_013_create_cart_items.sql

CREATE TABLE public.cart_items (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id             UUID            NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  item_type           TEXT            NOT NULL CHECK (item_type IN ('normal','ai_personalization')),
  -- Normal items
  product_id          UUID            REFERENCES public.products(id),
  variant_id          UUID            REFERENCES public.product_variants(id),
  quantity            SMALLINT        NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  -- AI items
  design_id           UUID            REFERENCES public.designs(id),
  -- Pricing snapshot
  unit_price          NUMERIC(12,2)   NOT NULL,
  customization_fee   NUMERIC(12,2)   NOT NULL DEFAULT 0,
  line_total          NUMERIC(12,2)   NOT NULL,
  -- Product detail snapshot
  product_name        VARCHAR(255)    NOT NULL,
  product_snapshot    JSONB           NOT NULL,
  added_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own cart items"
  ON public.cart_items
  USING (EXISTS (
    SELECT 1 FROM public.carts
    WHERE id = cart_id AND (user_id = auth.uid() OR session_id IS NOT NULL)
  ));

CREATE INDEX idx_cart_items_cart ON public.cart_items(cart_id);
