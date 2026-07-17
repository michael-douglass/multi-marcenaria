-- ============================================================
-- GARBO Movelaria — Observação + anexos em Contas a Receber
-- Migration 123
--
-- Observação por parcela; anexos com escopo:
--   - conta_receber_id → só esta parcela
--   - grupo_id → todas as parcelas do parcelamento
-- Backfill: orçamentos sem grupo_id recebem origem_lead_id.
-- ============================================================

ALTER TABLE movelaria_contas_receber
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Agrupa cobranças de orçamento fechado sem grupo_id
UPDATE movelaria_contas_receber
SET grupo_id = origem_lead_id
WHERE grupo_id IS NULL
  AND origem_lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS movelaria_contas_receber_anexos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id  UUID REFERENCES movelaria_contas_receber(id) ON DELETE CASCADE,
  grupo_id          TEXT,
  nome_arquivo      TEXT        NOT NULL,
  tipo_mime         TEXT        NOT NULL,
  storage_path      TEXT        NOT NULL,
  preview_path      TEXT,
  preview_paths     TEXT[],
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contas_receber_anexos_escopo_chk CHECK (
    conta_receber_id IS NOT NULL OR grupo_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_mov_cr_anexos_conta
  ON movelaria_contas_receber_anexos(conta_receber_id)
  WHERE conta_receber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mov_cr_anexos_grupo
  ON movelaria_contas_receber_anexos(grupo_id)
  WHERE grupo_id IS NOT NULL;

ALTER TABLE movelaria_contas_receber_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anexos_cr_select" ON movelaria_contas_receber_anexos;
CREATE POLICY "anexos_cr_select" ON movelaria_contas_receber_anexos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "anexos_cr_insert" ON movelaria_contas_receber_anexos;
CREATE POLICY "anexos_cr_insert" ON movelaria_contas_receber_anexos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "anexos_cr_delete" ON movelaria_contas_receber_anexos;
CREATE POLICY "anexos_cr_delete" ON movelaria_contas_receber_anexos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-contas-receber-anexos',
  'movelaria-contas-receber-anexos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_anexos_cr_select" ON storage.objects;
CREATE POLICY "storage_anexos_cr_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-contas-receber-anexos'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "storage_anexos_cr_insert" ON storage.objects;
CREATE POLICY "storage_anexos_cr_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-contas-receber-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_anexos_cr_update" ON storage.objects;
CREATE POLICY "storage_anexos_cr_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-contas-receber-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

DROP POLICY IF EXISTS "storage_anexos_cr_delete" ON storage.objects;
CREATE POLICY "storage_anexos_cr_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-contas-receber-anexos'
    AND movelaria_meu_perfil() IN ('administrador', 'financeiro')
  );

NOTIFY pgrst, 'reload schema';
