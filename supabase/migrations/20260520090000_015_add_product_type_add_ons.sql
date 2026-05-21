-- Add add_ons to products.product_type check constraint

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_type_check
  CHECK (product_type IN ('normal', 'ai_base', 'add_ons'));
