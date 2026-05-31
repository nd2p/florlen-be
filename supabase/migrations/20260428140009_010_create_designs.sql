-- supabase/migrations/20260428140009_010_create_designs.sql

CREATE TABLE public.designs (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id            UUID            NOT NULL REFERENCES public.products(id),
  base                  VARCHAR(50)     CHECK (base IN ('mini_figure', 'hat', 'bag')),
  -- User input
  prompt_text           TEXT            CHECK (char_length(prompt_text) <= 500),
  prompt_language       VARCHAR(10)     NOT NULL DEFAULT 'vi',
  -- AI output
  ai_prompt_used        TEXT,
  color_palette         JSONB,
  material_suggestions  JSONB,
  mockup_image_url      TEXT,
  mockup_storage_path   TEXT,
  -- User edits
  selected_colors       JSONB,
  -- Computed
  customization_fee     NUMERIC(12,2)   NOT NULL DEFAULT 0,
  complexity_score      SMALLINT,
  -- Lifecycle
  status                TEXT            NOT NULL DEFAULT 'draft'
                                        CHECK (status IN ('draft','generating','failed','ready','finalized')),
  generation_attempts   SMALLINT        NOT NULL DEFAULT 0,
  -- Saved design metadata
  saved_at              TIMESTAMPTZ,
  was_ordered           BOOLEAN         NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_designs_updated_at
  BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own designs"
  ON public.designs
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all designs"
  ON public.designs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_designs_user_status    ON public.designs(user_id, status);
CREATE INDEX idx_designs_status_created ON public.designs(status, created_at DESC);
