-- supabase/migrations/20260530000000_create_system_settings.sql
-- Create system settings table for dynamic AI config, pricing, and API keys

CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for auto-updating updated_at timestamp
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for authenticated and anonymous users (so public APIs can read pricing configs)
CREATE POLICY "Public read system settings"
  ON public.system_settings FOR SELECT
  USING (true);

-- Allow ALL operations for admin/super_admin roles
CREATE POLICY "Admins manage system settings"
  ON public.system_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

INSERT INTO public.system_settings (key, value) VALUES
  ('gemini_api_key', '""')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value) VALUES
  ('base_product_prices', '{"mini_figure": 250000, "bag": 150000, "hat": 120000}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value) VALUES
  ('accessories_config', '{"pants": {"labelKey": "accessoryPants", "label": "Quần", "price": 15000}, "shirt": {"labelKey": "accessoryShirt", "label": "Áo", "price": 20000}, "hat": {"labelKey": "accessoryHat", "label": "Mũ phụ kiện", "price": 25000}, "hair": {"labelKey": "accessoryHair", "label": "Tóc", "price": 20000}, "bag": {"labelKey": "accessoryBag", "label": "Túi phụ kiện", "price": 15000}, "scarf": {"labelKey": "accessoryScarf", "label": "Khăn", "price": 10000}, "handAccessory": {"labelKey": "accessoryHandAccessory", "price": 30000}}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value) VALUES
  ('illustration_price', '40000')
ON CONFLICT (key) DO NOTHING;
