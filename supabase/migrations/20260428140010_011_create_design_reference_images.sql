-- supabase/migrations/20260428140010_011_create_design_reference_images.sql

CREATE TABLE public.design_reference_images (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id     UUID          NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  url           TEXT          NOT NULL,
  storage_path  TEXT          NOT NULL,
  uploaded_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.design_reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own design images"
  ON public.design_reference_images
  USING (EXISTS (
    SELECT 1 FROM public.designs
    WHERE id = design_id AND user_id = auth.uid()
  ));

CREATE INDEX idx_ref_images_design ON public.design_reference_images(design_id);
