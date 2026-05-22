-- supabase/migrations/20260428140017_018_create_blog_posts.sql

CREATE TABLE public.blog_posts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255)  NOT NULL,
  slug            VARCHAR(255)  NOT NULL,
  content         TEXT,
  excerpt         TEXT,
  cover_image_url TEXT,
  author_id       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published    BOOLEAN       NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  tags            TEXT[],
  meta_title      VARCHAR(255),
  meta_description VARCHAR(500),
  views_count     INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_blog_slug UNIQUE (slug)
);

CREATE TRIGGER trg_blog_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published posts"
  ON public.blog_posts FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins manage blog posts"
  ON public.blog_posts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE INDEX idx_blog_published ON public.blog_posts(is_published, published_at DESC);
CREATE INDEX idx_blog_slug      ON public.blog_posts(slug);
CREATE INDEX idx_blog_tags      ON public.blog_posts USING gin(tags);
