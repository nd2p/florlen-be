-- supabase/migrations/20260428140004_005_create_product_images.sql

CREATE TABLE public.product_images (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url           TEXT          NOT NULL,
  storage_path  TEXT,
  alt_text      VARCHAR(255),
  width         INTEGER,
  height        INTEGER,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  is_primary    BOOLEAN       NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product images"
  ON public.product_images FOR SELECT USING (true);

CREATE POLICY "Admins manage product images"
  ON public.product_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_product_images_product ON public.product_images(product_id, sort_order);
CREATE UNIQUE INDEX idx_product_primary_image
  ON public.product_images(product_id) WHERE is_primary = true;
