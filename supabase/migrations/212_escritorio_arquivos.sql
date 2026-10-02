-- ============================================================
-- GARBO Movelaria — Pastas de arquivos do Escritório / Contabilidade
-- Área compartilhada em /funcionarios (aba Escritório) para PDF e imagens.
-- ============================================================

CREATE TABLE IF NOT EXISTS movelaria_escritorio_pastas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  descricao     TEXT,
  ordem         INT         NOT NULL DEFAULT 0,
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT movelaria_escritorio_pastas_nome_check CHECK (char_length(trim(nome)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_mov_escritorio_pastas_ordem
  ON movelaria_escritorio_pastas(ordem, nome);

CREATE TABLE IF NOT EXISTS movelaria_escritorio_arquivos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id      UUID        NOT NULL REFERENCES movelaria_escritorio_pastas(id) ON DELETE CASCADE,
  nome_arquivo  TEXT        NOT NULL,
  tipo_mime     TEXT        NOT NULL,
  storage_path  TEXT        NOT NULL,
  preview_path  TEXT,
  preview_paths TEXT[],
  kind          TEXT        NOT NULL DEFAULT 'image'
                CHECK (kind IN ('image', 'pdf')),
  criado_por    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_escritorio_arquivos_pasta
  ON movelaria_escritorio_arquivos(pasta_id, criado_em DESC);

ALTER TABLE movelaria_escritorio_pastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_escritorio_arquivos ENABLE ROW LEVEL SECURITY;

-- Pastas: RH (admin + financeiro)
DROP POLICY IF EXISTS "escritorio_pastas_select" ON movelaria_escritorio_pastas;
CREATE POLICY "escritorio_pastas_select" ON movelaria_escritorio_pastas
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "escritorio_pastas_insert" ON movelaria_escritorio_pastas;
CREATE POLICY "escritorio_pastas_insert" ON movelaria_escritorio_pastas
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "escritorio_pastas_update" ON movelaria_escritorio_pastas;
CREATE POLICY "escritorio_pastas_update" ON movelaria_escritorio_pastas
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "escritorio_pastas_delete" ON movelaria_escritorio_pastas;
CREATE POLICY "escritorio_pastas_delete" ON movelaria_escritorio_pastas
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

-- Arquivos
DROP POLICY IF EXISTS "escritorio_arquivos_select" ON movelaria_escritorio_arquivos;
CREATE POLICY "escritorio_arquivos_select" ON movelaria_escritorio_arquivos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "escritorio_arquivos_insert" ON movelaria_escritorio_arquivos;
CREATE POLICY "escritorio_arquivos_insert" ON movelaria_escritorio_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "escritorio_arquivos_delete" ON movelaria_escritorio_arquivos;
CREATE POLICY "escritorio_arquivos_delete" ON movelaria_escritorio_arquivos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

-- Bucket privado (PDF + imagens)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-escritorio-arquivos',
  'movelaria-escritorio-arquivos',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "storage_escritorio_select" ON storage.objects;
CREATE POLICY "storage_escritorio_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-escritorio-arquivos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_escritorio_insert" ON storage.objects;
CREATE POLICY "storage_escritorio_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-escritorio-arquivos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_escritorio_update" ON storage.objects;
CREATE POLICY "storage_escritorio_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-escritorio-arquivos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_escritorio_delete" ON storage.objects;
CREATE POLICY "storage_escritorio_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-escritorio-arquivos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

-- Pastas iniciais (só se ainda não houver nenhuma)
INSERT INTO movelaria_escritorio_pastas (nome, descricao, ordem)
SELECT v.nome, v.descricao, v.ordem
FROM (VALUES
  ('Contabilidade', 'Notas, balancetes, impostos e comprovantes contábeis', 10),
  ('Escritório', 'Documentos administrativos e do dia a dia do escritório', 20)
) AS v(nome, descricao, ordem)
WHERE NOT EXISTS (SELECT 1 FROM movelaria_escritorio_pastas LIMIT 1);
