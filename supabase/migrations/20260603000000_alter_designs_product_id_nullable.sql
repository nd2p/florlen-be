-- supabase/migrations/20260603000000_alter_designs_product_id_nullable.sql
ALTER TABLE public.designs ALTER COLUMN product_id DROP NOT NULL;
