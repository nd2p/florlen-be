-- Migration 024: Create voucher_users junction table for multi-user voucher assignment
-- Replaces the single user_id column approach with a many-to-many relationship

CREATE TABLE IF NOT EXISTS public.voucher_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(voucher_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voucher_users_voucher_id ON public.voucher_users(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_users_user_id ON public.voucher_users(user_id);

-- Migrate existing user_id data from vouchers table to junction table
INSERT INTO public.voucher_users (voucher_id, user_id)
SELECT id, user_id FROM public.vouchers
WHERE user_id IS NOT NULL AND deleted_at IS NULL
ON CONFLICT (voucher_id, user_id) DO NOTHING;

-- Drop the old user_id column from vouchers
ALTER TABLE public.vouchers DROP COLUMN IF EXISTS user_id;
