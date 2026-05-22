-- supabase/migrations/20260428140015_016_create_order_status_logs.sql

CREATE TABLE public.order_status_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status   TEXT,
  to_status     TEXT          NOT NULL,
  changed_by    UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_source TEXT          NOT NULL DEFAULT 'system'
                              CHECK (change_source IN ('system','admin','webhook','scheduled')),
  note          TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order logs"
  ON public.order_status_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins view all order logs"
  ON public.order_status_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "System/admins insert logs"
  ON public.order_status_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_status_logs_order ON public.order_status_logs(order_id, created_at);
