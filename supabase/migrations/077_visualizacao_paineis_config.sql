-- ============================================================
-- GARBO Movelaria — Configuração de painéis da Visualização
-- Migration 077
-- Administrador escolhe quais cards o perfil Visualizador enxerga.
-- ============================================================

CREATE TABLE IF NOT EXISTS movelaria_visualizacao_config (
  chave             TEXT PRIMARY KEY DEFAULT 'default',
  paineis_visiveis  TEXT[] NOT NULL,
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE movelaria_visualizacao_config ENABLE ROW LEVEL SECURITY;

INSERT INTO movelaria_visualizacao_config (chave, paineis_visiveis)
VALUES (
  'default',
  ARRAY[
    'chegada_materiais',
    'calendario_obras',
    'acompanhamento_obras',
    'obras_do_dia',
    'obras_atrasadas',
    'cobrancas_atrasadas'
  ]::TEXT[]
)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION movelaria_pode_configurar_visualizacao()
RETURNS BOOLEAN AS $$
  SELECT movelaria_meu_perfil() IN ('administrador', 'administrador_obras');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_pode_configurar_visualizacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_pode_configurar_visualizacao() TO authenticated;

DROP POLICY IF EXISTS "visualizacao_config_select" ON movelaria_visualizacao_config;
CREATE POLICY "visualizacao_config_select"
  ON movelaria_visualizacao_config
  FOR SELECT
  TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "visualizacao_config_insert" ON movelaria_visualizacao_config;
CREATE POLICY "visualizacao_config_insert"
  ON movelaria_visualizacao_config
  FOR INSERT
  TO authenticated
  WITH CHECK (movelaria_pode_configurar_visualizacao());

DROP POLICY IF EXISTS "visualizacao_config_update" ON movelaria_visualizacao_config;
CREATE POLICY "visualizacao_config_update"
  ON movelaria_visualizacao_config
  FOR UPDATE
  TO authenticated
  USING (movelaria_pode_configurar_visualizacao())
  WITH CHECK (movelaria_pode_configurar_visualizacao());
