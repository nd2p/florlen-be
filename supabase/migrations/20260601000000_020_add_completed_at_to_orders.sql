-- Add completed_at timestamp to orders

ALTER TABLE public.orders
  ADD COLUMN completed_at TIMESTAMPTZ;
