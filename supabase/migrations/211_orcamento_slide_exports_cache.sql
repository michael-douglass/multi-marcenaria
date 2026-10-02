-- ============================================================
-- Cache de exportação PDF dos slides de orçamento
-- Bucket privado + metadados com fingerprint (invalidação automática).
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orcamento-slide-exports',
  'orcamento-slide-exports',
  false,
  104857600, -- 100 MB
  ARRAY[
    'application/pdf',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "orcamento_slide_exports_storage_select" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'orcamento-slide-exports');

DROP POLICY IF EXISTS "orcamento_slide_exports_storage_insert" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orcamento-slide-exports');

DROP POLICY IF EXISTS "orcamento_slide_exports_storage_update" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'orcamento-slide-exports')
  WITH CHECK (bucket_id = 'orcamento-slide-exports');

DROP POLICY IF EXISTS "orcamento_slide_exports_storage_delete" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'orcamento-slide-exports');

CREATE TABLE IF NOT EXISTS public.orcamento_slide_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_schema TEXT NOT NULL,
  orcamento_id UUID NOT NULL,
  viewport TEXT NOT NULL CHECK (viewport IN ('desktop', 'mobile')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'imagens')),
  content_fingerprint TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_schema, orcamento_id, viewport, format)
);

CREATE INDEX IF NOT EXISTS orcamento_slide_exports_orcamento_idx
  ON public.orcamento_slide_exports (orcamento_id);

CREATE INDEX IF NOT EXISTS orcamento_slide_exports_fingerprint_idx
  ON public.orcamento_slide_exports (empresa_schema, orcamento_id, content_fingerprint);

ALTER TABLE public.orcamento_slide_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamento_slide_exports_select" ON public.orcamento_slide_exports;
CREATE POLICY "orcamento_slide_exports_select" ON public.orcamento_slide_exports
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "orcamento_slide_exports_insert" ON public.orcamento_slide_exports;
CREATE POLICY "orcamento_slide_exports_insert" ON public.orcamento_slide_exports
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "orcamento_slide_exports_update" ON public.orcamento_slide_exports;
CREATE POLICY "orcamento_slide_exports_update" ON public.orcamento_slide_exports
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "orcamento_slide_exports_delete" ON public.orcamento_slide_exports;
CREATE POLICY "orcamento_slide_exports_delete" ON public.orcamento_slide_exports
  FOR DELETE TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_slide_exports TO authenticated;
