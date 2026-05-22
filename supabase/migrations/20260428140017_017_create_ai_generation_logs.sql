-- supabase/migrations/20260428140016_017_create_ai_generation_logs.sql

CREATE TABLE public.ai_generation_logs (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id       UUID          REFERENCES public.designs(id),
  user_id         UUID          REFERENCES public.profiles(id),
  generation_type TEXT          NOT NULL CHECK (generation_type IN ('nlp','image_gen')),
  model_version   VARCHAR(100),
  prompt_hash     VARCHAR(64),
  latency_ms      INTEGER,
  cost_usd        NUMERIC(10,6),
  status          TEXT          NOT NULL CHECK (status IN ('success','failed','timeout')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all AI logs"
  ON public.ai_generation_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "System inserts AI logs"
  ON public.ai_generation_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_ai_logs_design      ON public.ai_generation_logs(design_id);
CREATE INDEX idx_ai_logs_user_created ON public.ai_generation_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_status      ON public.ai_generation_logs(status, created_at DESC);
