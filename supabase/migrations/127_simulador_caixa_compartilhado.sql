-- ============================================================
-- GARBO Movelaria — Simulador de Caixa compartilhado
-- Migration 127
-- Uma simulação por ano, visível e editável por quem acessa o Dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS movelaria_simulador_caixa (
  ano                    INTEGER PRIMARY KEY
                         CHECK (ano >= 2000 AND ano <= 2100),
  meses                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  previsao_recebimento   NUMERIC(14, 2) NOT NULL DEFAULT 0
                         CHECK (previsao_recebimento >= 0),
  previsao_despesas      NUMERIC(14, 2) NOT NULL DEFAULT 0
                         CHECK (previsao_despesas >= 0),
  ajustes                JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por         UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE movelaria_simulador_caixa IS
  'Simulação de caixa do Dashboard por ano (compartilhada entre usuários).';

COMMENT ON COLUMN movelaria_simulador_caixa.meses IS
  'Array JSON: [{ "mes": "Jan", "receitas": 0, "despesas": 0 }, ...]';

COMMENT ON COLUMN movelaria_simulador_caixa.ajustes IS
  'Array JSON de ajustes (+/−) com título, tipo, valor, mês e campo.';

CREATE INDEX IF NOT EXISTS idx_simulador_caixa_atualizado
  ON movelaria_simulador_caixa (atualizado_em DESC);

ALTER TABLE movelaria_simulador_caixa ENABLE ROW LEVEL SECURITY;

-- Quem acessa o Dashboard (Admin / Financeiro / Marceneiro) pode ver e editar.
CREATE OR REPLACE FUNCTION movelaria_pode_usar_simulador_caixa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('administrador', 'financeiro', 'marceneiro')
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'marceneiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  );
$$;

REVOKE ALL ON FUNCTION movelaria_pode_usar_simulador_caixa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_pode_usar_simulador_caixa() TO authenticated;

DROP POLICY IF EXISTS "simulador_caixa_select" ON movelaria_simulador_caixa;
CREATE POLICY "simulador_caixa_select"
  ON movelaria_simulador_caixa
  FOR SELECT
  TO authenticated
  USING (movelaria_pode_usar_simulador_caixa());

DROP POLICY IF EXISTS "simulador_caixa_insert" ON movelaria_simulador_caixa;
CREATE POLICY "simulador_caixa_insert"
  ON movelaria_simulador_caixa
  FOR INSERT
  TO authenticated
  WITH CHECK (movelaria_pode_usar_simulador_caixa());

DROP POLICY IF EXISTS "simulador_caixa_update" ON movelaria_simulador_caixa;
CREATE POLICY "simulador_caixa_update"
  ON movelaria_simulador_caixa
  FOR UPDATE
  TO authenticated
  USING (movelaria_pode_usar_simulador_caixa())
  WITH CHECK (movelaria_pode_usar_simulador_caixa());

DROP POLICY IF EXISTS "simulador_caixa_delete" ON movelaria_simulador_caixa;
CREATE POLICY "simulador_caixa_delete"
  ON movelaria_simulador_caixa
  FOR DELETE
  TO authenticated
  USING (movelaria_pode_usar_simulador_caixa());

GRANT SELECT, INSERT, UPDATE, DELETE ON movelaria_simulador_caixa TO authenticated;

-- Realtime: outro usuário vê a simulação atualizar sem recarregar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_simulador_caixa'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_simulador_caixa;
  END IF;
END $$;
