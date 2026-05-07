-- supabase/migrations/20260428140009_010_create_designs.sql

CREATE TABLE public.designs (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id            UUID            NOT NULL REFERENCES public.products(id),
  fandom_tag_id         UUID            REFERENCES public.fandom_tags(id) ON DELETE SET NULL,
  -- User input
  prompt_text           TEXT            CHECK (char_length(prompt_text) <= 500),
  prompt_language       VARCHAR(10)     NOT NULL DEFAULT 'vi',
  style_preset          TEXT            CHECK (style_preset IN ('cute','minimal','pastel','dark','fandom')),
  -- AI output
  ai_generation_id      VARCHAR(255),
  ai_model_version      VARCHAR(100),
  ai_prompt_used        TEXT,
  ai_latency_ms         INTEGER,
  ai_cost_usd           NUMERIC(10,6),
  color_palette         JSONB,
  material_suggestions  JSONB,
  mockup_image_url      TEXT,
  mockup_storage_path   TEXT,
  variant_suggestions   JSONB,
  -- User edits
  custom_text           VARCHAR(20),
  selected_colors       JSONB,
  scale_adjustments     JSONB,
  -- Computed
  customization_fee     NUMERIC(12,2)   NOT NULL DEFAULT 0,
  complexity_score      SMALLINT,
  -- Lifecycle
  status                TEXT            NOT NULL DEFAULT 'draft'
                                        CHECK (status IN ('draft','generating','failed','ready','finalized')),
  generation_attempts   SMALLINT        NOT NULL DEFAULT 0,
  last_error            TEXT,
  session_id            VARCHAR(255),
  expires_at            TIMESTAMPTZ,
  -- Saved design metadata
  saved_at              TIMESTAMPTZ,
  was_ordered           BOOLEAN         NOT NULL DEFAULT false,
  ordered_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_designs_updated_at
  BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own designs"
  ON public.designs
  USING (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL))
  WITH CHECK (auth.uid() = user_id OR (user_id IS NULL AND session_id IS NOT NULL));

CREATE POLICY "Admins view all designs"
  ON public.designs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_designs_user_status    ON public.designs(user_id, status);
CREATE INDEX idx_designs_session        ON public.designs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_designs_status_created ON public.designs(status, created_at DESC);
CREATE INDEX idx_designs_expires_at     ON public.designs(expires_at) WHERE expires_at IS NOT NULL;
