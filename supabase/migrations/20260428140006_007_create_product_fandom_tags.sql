-- supabase/migrations/20260428140006_007_create_product_fandom_tags.sql

CREATE TABLE public.product_fandom_tags (
  product_id    UUID  NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  fandom_tag_id UUID  NOT NULL REFERENCES public.fandom_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, fandom_tag_id)
);

ALTER TABLE public.product_fandom_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product fandom tags"
  ON public.product_fandom_tags FOR SELECT USING (true);

CREATE POLICY "Admins manage product fandom tags"
  ON public.product_fandom_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_pft_tag_id ON public.product_fandom_tags(fandom_tag_id);
