-- ============================================================
-- Orçamentos IA — Fase 1 (conclusão): Storage + Realtime
-- Bucket autenticado `orcamentos-ia`, policies e publicação Realtime.
-- ============================================================

-- 1) Bucket (PDFs de projeto + páginas convertidas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orcamentos-ia',
  'orcamentos-ia',
  false,
  104857600, -- 100 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Policies de storage (autenticados)
DROP POLICY IF EXISTS "orcamentos_ia_storage_select" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'orcamentos-ia');

DROP POLICY IF EXISTS "orcamentos_ia_storage_insert" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'orcamentos-ia');

DROP POLICY IF EXISTS "orcamentos_ia_storage_update" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'orcamentos-ia')
  WITH CHECK (bucket_id = 'orcamentos-ia');

DROP POLICY IF EXISTS "orcamentos_ia_storage_delete" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'orcamentos-ia');

-- 3) Modo Pro (além de max/fast do PRD)
ALTER TABLE public.quote_analyses
  DROP CONSTRAINT IF EXISTS quote_analyses_mode_check;

ALTER TABLE public.quote_analyses
  ADD CONSTRAINT quote_analyses_mode_check
  CHECK (mode IN ('fast', 'max', 'pro'));

-- 4) Realtime: barra de progresso escuta quote_analyses.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'quote_analyses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_analyses;
  END IF;
END $$;
