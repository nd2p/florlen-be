-- Migration 022: Add voucher limit per user and track user usages

-- Add limit_per_user to vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS limit_per_user INTEGER;

-- Create user_voucher_usages table to track voucher consumption per user
CREATE TABLE IF NOT EXISTS public.user_voucher_usages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voucher_id      UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_voucher_usages ENABLE ROW LEVEL SECURITY;

-- Policy for Admin (all access)
DROP POLICY IF EXISTS "Admin full access on user_voucher_usages" ON public.user_voucher_usages;
CREATE POLICY "Admin full access on user_voucher_usages" ON public.user_voucher_usages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Policy for User (read own usages)
DROP POLICY IF EXISTS "Users can view own voucher usages" ON public.user_voucher_usages;
CREATE POLICY "Users can view own voucher usages" ON public.user_voucher_usages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_voucher_usages_lookup ON public.user_voucher_usages(user_id, voucher_id);
