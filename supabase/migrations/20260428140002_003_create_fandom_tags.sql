-- supabase/migrations/20260428140002_003_create_fandom_tags.sql

CREATE TABLE public.fandom_tags (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100)  NOT NULL,
  slug            VARCHAR(100)  NOT NULL,
  category        TEXT          NOT NULL
                                CHECK (category IN ('kpop', 'anime', 'games', 'western_pop', 'other')),
  cover_image_url TEXT,
  description     VARCHAR(500),
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  product_count   INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_fandom_tags_name UNIQUE (name),
  CONSTRAINT uq_fandom_tags_slug UNIQUE (slug)
);

CREATE TRIGGER trg_fandom_tags_updated_at
  BEFORE UPDATE ON public.fandom_tags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fandom tags chỉ admin mới tạo/sửa; mọi người đều đọc được
ALTER TABLE public.fandom_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fandom tags"
  ON public.fandom_tags FOR SELECT
  USING (true);

CREATE POLICY "Admins manage fandom tags"
  ON public.fandom_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_fandom_tags_category ON public.fandom_tags(category, is_active);
CREATE INDEX idx_fandom_tags_slug ON public.fandom_tags(slug);
