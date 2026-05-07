-- supabase/migrations/20260428140008_009_create_collection_products.sql

CREATE TABLE public.collection_products (
  collection_id UUID    NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id    UUID    NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read collection products"
  ON public.collection_products FOR SELECT USING (true);

CREATE POLICY "Admins manage collection products"
  ON public.collection_products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_cp_product_id ON public.collection_products(product_id);
