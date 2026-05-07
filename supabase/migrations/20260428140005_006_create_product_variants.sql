-- supabase/migrations/20260428140005_006_create_product_variants.sql

CREATE TABLE public.product_variants (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID            NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_suffix        VARCHAR(50)     NOT NULL,
  size              VARCHAR(50),
  color_name        VARCHAR(100),
  color_hex         CHAR(7),
  additional_price  NUMERIC(12,2)   NOT NULL DEFAULT 0,
  stock_qty         INTEGER         NOT NULL DEFAULT 0,
  is_active         BOOLEAN         NOT NULL DEFAULT true,
  image_url         TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uq_variant_sku UNIQUE (product_id, sku_suffix)
);

CREATE TRIGGER trg_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active variants"
  ON public.product_variants FOR SELECT USING (is_active = true);

CREATE POLICY "Admins manage variants"
  ON public.product_variants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_variants_product ON public.product_variants(product_id, is_active);
