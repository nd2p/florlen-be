-- Migration 023: Add user_id to vouchers for user-specific vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for lookup performance
CREATE INDEX IF NOT EXISTS idx_vouchers_user_id ON public.vouchers(user_id);
