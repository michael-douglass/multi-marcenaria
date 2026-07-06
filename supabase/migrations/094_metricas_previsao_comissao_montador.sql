-- ============================================================
-- GARBO Movelaria — Previsão de comissão por montador (métricas)
-- Migration 094
-- Restaura previsão (obras em aberto, entrega prevista no mês)
-- sem alterar recebimento real (só na conclusão — migration 093).
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_metricas_obras_por_montador(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  montador_id        UUID,
  montador_nome      TEXT,
  comissao_concluida NUMERIC,
  comissao_em_aberto NUMERIC,
  comissao_gerada    NUMERIC,
  obras_concluidas   BIGINT,
  obras_em_aberto    BIGINT
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH montadores AS (
    SELECT
      u.id,
      COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)) AS nome
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
  ),
  concluida AS (
    SELECT
      ci.prestador_id,
      SUM(ci.valor) AS valor,
      COUNT(DISTINCT o.id) AS qtd
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_obras o ON o.id = ci.obra_id
    WHERE o.status_kanban = 'concluida'
      AND o.finalizado_em IS NOT NULL
      AND o.comissao_habilitada = true
      AND ci.valor > 0
      AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
      AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    GROUP BY ci.prestador_id
  ),
  em_aberto AS (
    SELECT
      ci.prestador_id,
      SUM(ci.valor) AS valor,
      COUNT(DISTINCT o.id) AS qtd
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_obras o ON o.id = ci.obra_id
    WHERE o.status_kanban NOT IN ('concluida', 'cancelada')
      AND o.finalizado_em IS NULL
      AND o.comissao_habilitada = true
      AND ci.valor > 0
      AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
      AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
    GROUP BY ci.prestador_id
  ),
  gerada AS (
    SELECT
      cp.prestador_id,
      SUM(cp.valor_parcela) AS valor
    FROM movelaria_contas_pagar cp
    WHERE cp.prestador_id IS NOT NULL
      AND (
        cp.prestador_id IS NOT NULL
        OR cp.descricao ILIKE 'Comissão:%'
        OR cp.obra_id IS NOT NULL
      )
      AND EXTRACT(MONTH FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_mes
      AND EXTRACT(YEAR  FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_ano
    GROUP BY cp.prestador_id
  )
  SELECT
    m.id,
    m.nome,
    COALESCE(c.valor, 0),
    COALESCE(a.valor, 0),
    COALESCE(g.valor, 0),
    COALESCE(c.qtd, 0),
    COALESCE(a.qtd, 0)
  FROM montadores m
  LEFT JOIN concluida c ON c.prestador_id = m.id
  LEFT JOIN em_aberto a ON a.prestador_id = m.id
  LEFT JOIN gerada g ON g.prestador_id = m.id
  WHERE COALESCE(c.valor, 0) > 0
     OR COALESCE(a.valor, 0) > 0
     OR COALESCE(g.valor, 0) > 0
  ORDER BY (COALESCE(c.valor, 0) + COALESCE(a.valor, 0) + COALESCE(g.valor, 0)) DESC, m.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) TO authenticated;

-- Detalhe por obra: concluídas + previsão (em aberto)
DROP FUNCTION IF EXISTS movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION movelaria_metricas_comissao_obras_montador(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_montador_id UUID DEFAULT NULL
)
RETURNS TABLE (
  obra_id          UUID,
  cliente_nome     TEXT,
  tipo_obra_nome   TEXT,
  status_kanban    TEXT,
  comissao_valor   NUMERIC,
  situacao         TEXT,
  oculto_prestador BOOLEAN
) AS $$
DECLARE
  v_perfil         TEXT := movelaria_meu_perfil();
  v_uid            UUID := auth.uid();
  v_filtrar_oculto BOOLEAN;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_montador_id IS NULL THEN
    RAISE EXCEPTION 'Montador não informado';
  END IF;

  IF v_perfil = 'montador' AND p_montador_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_filtrar_oculto := (
    v_perfil = 'montador'
    OR (v_perfil = 'montador_admin' AND p_montador_id = v_uid)
  );

  RETURN QUERY
  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    ci.valor,
    'concluida'::TEXT,
    COALESCE(ci.oculto_prestador, false)
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND (NOT v_filtrar_oculto OR NOT COALESCE(ci.oculto_prestador, false))
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
    'em_aberto'::TEXT,
    COALESCE(ci.oculto_prestador, false)
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND (NOT v_filtrar_oculto OR NOT COALESCE(ci.oculto_prestador, false))
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
