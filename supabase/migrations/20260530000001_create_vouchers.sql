-- Migration 021: Create vouchers table for discount management

CREATE TABLE IF NOT EXISTS public.vouchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
  discount_value      NUMERIC(12,2) NOT NULL DEFAULT 0,
  start_date          TIMESTAMPTZ DEFAULT now(),
  end_date            TIMESTAMPTZ,
  usage_limit         INTEGER, -- NULL means unlimited
  used_count          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ -- soft delete column
);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Create policy for Admin (all access)
DROP POLICY IF EXISTS "Admin full access on vouchers" ON public.vouchers;
CREATE POLICY "Admin full access on vouchers" ON public.vouchers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Create policy for users/guests to read active, valid vouchers
DROP POLICY IF EXISTS "Public read active vouchers" ON public.vouchers;
CREATE POLICY "Public read active vouchers" ON public.vouchers
  FOR SELECT
  USING (
    is_active = true 
    AND deleted_at IS NULL
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER trg_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_active ON public.vouchers(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_deleted ON public.vouchers(deleted_at) WHERE deleted_at IS NULL;
