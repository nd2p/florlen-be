-- supabase/migrations/20260516120000_016_add_is_active_to_product_images.sql

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_product_images_product_active
  ON public.product_images(product_id, is_active);