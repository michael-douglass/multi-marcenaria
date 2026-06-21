-- ============================================================
-- GARBO Movelaria — Painel "Obras do Dia" na Visualização
-- Migration 078
-- ============================================================

UPDATE movelaria_visualizacao_config
SET
  paineis_visiveis = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        paineis_visiveis || ARRAY['obras_do_dia']::TEXT[]
      )
    )
  ),
  atualizado_em = NOW()
WHERE chave = 'default'
  AND NOT ('obras_do_dia' = ANY(paineis_visiveis));
