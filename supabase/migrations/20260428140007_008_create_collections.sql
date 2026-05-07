-- supabase/migrations/20260428140007_008_create_collections.sql

CREATE TABLE public.collections (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255)  NOT NULL,
  slug              VARCHAR(255)  NOT NULL,
  description       TEXT,
  cover_image_url   TEXT,
  banner_image_url  TEXT,
  collection_type   TEXT          NOT NULL DEFAULT 'seasonal'
                                  CHECK (collection_type IN ('seasonal','fandom','event_drop','permanent')),
  is_active         BOOLEAN       NOT NULL DEFAULT false,
  is_featured       BOOLEAN       NOT NULL DEFAULT false,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  countdown_visible BOOLEAN       NOT NULL DEFAULT false,
  meta_title        VARCHAR(255),
  meta_description  VARCHAR(500),
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  created_by        UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_collections_slug UNIQUE (slug)
);

CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active collections"
  ON public.collections FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage collections"
  ON public.collections FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_collections_active ON public.collections(is_active, ends_at);
CREATE INDEX idx_collections_featured ON public.collections(is_featured, is_active);
