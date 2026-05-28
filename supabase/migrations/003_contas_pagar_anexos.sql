-- ============================================================
-- GARBO Movelaria — Anexos em lançamentos manuais (Contas a Pagar)
-- ============================================================

ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS grupo_lancamento_id UUID;

CREATE INDEX IF NOT EXISTS idx_mov_contas_pagar_grupo
  ON movelaria_contas_pagar(grupo_lancamento_id)
  WHERE grupo_lancamento_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS movelaria_contas_pagar_anexos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_lancamento_id UUID        NOT NULL,
  nome_arquivo        TEXT        NOT NULL,
  tipo_mime           TEXT        NOT NULL,
  storage_path        TEXT        NOT NULL,
  preview_path        TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_cp_anexos_grupo
  ON movelaria_contas_pagar_anexos(grupo_lancamento_id);

ALTER TABLE movelaria_contas_pagar_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anexos_cp_select" ON movelaria_contas_pagar_anexos;
CREATE POLICY "anexos_cp_select" ON movelaria_contas_pagar_anexos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "anexos_cp_insert" ON movelaria_contas_pagar_anexos;
CREATE POLICY "anexos_cp_insert" ON movelaria_contas_pagar_anexos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "anexos_cp_delete" ON movelaria_contas_pagar_anexos;
CREATE POLICY "anexos_cp_delete" ON movelaria_contas_pagar_anexos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

-- Bucket de storage (privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-contas-pagar-anexos',
  'movelaria-contas-pagar-anexos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_anexos_cp_select" ON storage.objects;
CREATE POLICY "storage_anexos_cp_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-contas-pagar-anexos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "storage_anexos_cp_insert" ON storage.objects;
CREATE POLICY "storage_anexos_cp_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-contas-pagar-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_anexos_cp_update" ON storage.objects;
CREATE POLICY "storage_anexos_cp_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-contas-pagar-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_anexos_cp_delete" ON storage.objects;
CREATE POLICY "storage_anexos_cp_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-contas-pagar-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );
