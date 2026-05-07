-- supabase/migrations/20260428140003_004_create_products.sql

CREATE TABLE public.products (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                   VARCHAR(100)    NOT NULL,
  name                  VARCHAR(255)    NOT NULL,
  slug                  VARCHAR(255)    NOT NULL,
  description           TEXT            NOT NULL,
  short_description     VARCHAR(500),
  product_type          TEXT            NOT NULL
                                        CHECK (product_type IN ('normal', 'ai_base')),
  base_price            NUMERIC(12,2)   NOT NULL CHECK (base_price >= 0),
  compare_at_price      NUMERIC(12,2),
  customization_fee     NUMERIC(12,2),
  currency              CHAR(3)         NOT NULL DEFAULT 'VND',
  production_days_min   INTEGER         NOT NULL CHECK (production_days_min > 0),
  production_days_max   INTEGER         NOT NULL CHECK (production_days_max >= production_days_min),
  weight_grams          INTEGER,
  is_active             BOOLEAN         NOT NULL DEFAULT true,
  is_featured           BOOLEAN         NOT NULL DEFAULT false,
  sort_order            INTEGER         NOT NULL DEFAULT 0,
  -- ai_base specific
  style_options         TEXT[],
  material_defaults     JSONB,
  -- normal specific
  available_stock       INTEGER,
  low_stock_threshold   INTEGER         DEFAULT 5,
  -- deposit
  deposit_rate          NUMERIC(5,4)    NOT NULL DEFAULT 0.3000
                                        CHECK (deposit_rate BETWEEN 0.30 AND 1.00),
  -- SEO
  meta_title            VARCHAR(255),
  meta_description      VARCHAR(500),
  og_image_url          TEXT,
  created_by            UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_sku  UNIQUE (sku),
  CONSTRAINT uq_products_slug UNIQUE (slug)
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_products_type_active  ON public.products(product_type, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_slug         ON public.products(slug);
CREATE INDEX idx_products_featured     ON public.products(is_featured, is_active) WHERE deleted_at IS NULL;
