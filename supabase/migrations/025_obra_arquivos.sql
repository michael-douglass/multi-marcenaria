-- ============================================================
-- GARBO Movelaria — Arquivos de Obra (fotos + PDFs)
-- Migration 025
-- ============================================================

-- ── 1. Bucket de storage ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-obra-arquivos',
  'movelaria-obra-arquivos',
  false,
  20971520, -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Políticas de storage ───────────────────────────────────
-- Leitura: todos os usuários movelaria ativos
DROP POLICY IF EXISTS "obra_arq_select" ON storage.objects;
CREATE POLICY "obra_arq_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-obra-arquivos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

-- Upload: admin e montador_admin
DROP POLICY IF EXISTS "obra_arq_insert" ON storage.objects;
CREATE POLICY "obra_arq_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-arquivos'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin')
  );

-- Exclusão: admin e montador_admin
DROP POLICY IF EXISTS "obra_arq_delete" ON storage.objects;
CREATE POLICY "obra_arq_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-arquivos'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin')
  );

-- ── 3. Tabela de metadados dos arquivos ──────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_arquivos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id      UUID        NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  nome_arquivo TEXT        NOT NULL,
  tipo_mime    TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('image','pdf')),
  storage_path TEXT        NOT NULL,
  preview_path TEXT,
  criado_por   UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obra_arq_obra ON movelaria_obra_arquivos(obra_id);

ALTER TABLE movelaria_obra_arquivos ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os perfis (acesso real restrito pelo RLS de obras via app)
DROP POLICY IF EXISTS "obra_arq_meta_select" ON movelaria_obra_arquivos;
CREATE POLICY "obra_arq_meta_select" ON movelaria_obra_arquivos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

-- Insert: admin e montador_admin
DROP POLICY IF EXISTS "obra_arq_meta_insert" ON movelaria_obra_arquivos;
CREATE POLICY "obra_arq_meta_insert" ON movelaria_obra_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin'));

-- Delete: admin e montador_admin
DROP POLICY IF EXISTS "obra_arq_meta_delete" ON movelaria_obra_arquivos;
CREATE POLICY "obra_arq_meta_delete" ON movelaria_obra_arquivos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin'));
