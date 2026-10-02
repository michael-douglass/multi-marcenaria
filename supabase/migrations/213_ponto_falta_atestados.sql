-- ============================================================
-- GARBO Movelaria — Atestados anexados às faltas do ponto
-- Migration 213
-- ============================================================

CREATE TABLE IF NOT EXISTS movelaria_funcionario_ponto_atestados (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id  UUID        NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  data            DATE        NOT NULL,
  nome_arquivo    TEXT        NOT NULL,
  tipo_mime       TEXT        NOT NULL,
  storage_path    TEXT        NOT NULL,
  preview_path    TEXT,
  preview_paths   TEXT[],
  kind            TEXT        NOT NULL DEFAULT 'image'
                  CHECK (kind IN ('image', 'pdf')),
  criado_por      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_ponto_atestados_func_data
  ON movelaria_funcionario_ponto_atestados(funcionario_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_mov_ponto_atestados_data
  ON movelaria_funcionario_ponto_atestados(data);

COMMENT ON TABLE movelaria_funcionario_ponto_atestados IS
  'Atestados/comprovantes anexados a um dia de falta (justificativa no resumo de ponto).';

ALTER TABLE movelaria_funcionario_ponto_atestados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_atestado_select" ON movelaria_funcionario_ponto_atestados;
CREATE POLICY "ponto_atestado_select" ON movelaria_funcionario_ponto_atestados
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'montador_admin')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_atestado_insert" ON movelaria_funcionario_ponto_atestados;
CREATE POLICY "ponto_atestado_insert" ON movelaria_funcionario_ponto_atestados
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "ponto_atestado_delete" ON movelaria_funcionario_ponto_atestados;
CREATE POLICY "ponto_atestado_delete" ON movelaria_funcionario_ponto_atestados
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));
