-- ============================================================
-- GARBO Movelaria — Obras de comissão por montador no mês
-- Migration 074
-- Mesma regra de movelaria_metricas_obras_por_montador (063).
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_metricas_comissao_obras_montador(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_montador_id UUID DEFAULT NULL
)
RETURNS TABLE (
  obra_id         UUID,
  cliente_nome    TEXT,
  tipo_obra_nome  TEXT,
  status_kanban   TEXT,
  comissao_valor  NUMERIC,
  situacao        TEXT
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_montador_id IS NULL THEN
    RAISE EXCEPTION 'Montador não informado';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    ci.valor,
    'concluida'::TEXT
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND o.status_kanban = 'concluida'
    AND o.finalizado_em IS NOT NULL
    AND o.comissao_habilitada = true
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
    AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano

  UNION ALL

  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    ci.valor,
    'em_aberto'::TEXT
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND o.status_kanban NOT IN ('concluida', 'cancelada')
    AND o.finalizado_em IS NULL
    AND o.comissao_habilitada = true
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
    AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano

  ORDER BY 6, 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) TO authenticated;
