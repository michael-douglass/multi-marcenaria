-- Corrige métricas de comissão: considera lançamentos em contas a pagar
-- (comissão gerada), não apenas o flag comissao_gerada na obra.

DROP FUNCTION IF EXISTS movelaria_metricas_obras_resumo(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_resumo(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  comissao_a_pagar_mes    NUMERIC,
  comissao_em_aberto      NUMERIC,
  comissoes_geradas_mes   NUMERIC,
  obras_concluidas_mes    BIGINT,
  obras_abertas_comissao  BIGINT,
  mes_referencia          INTEGER,
  ano_referencia          INTEGER
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    -- Obras concluídas no mês com comissão configurada (previsto a pagar)
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      JOIN movelaria_obras o ON o.id = ci.obra_id
      WHERE o.status_kanban = 'concluida'
        AND o.finalizado_em IS NOT NULL
        AND o.comissao_habilitada = true
        AND ci.valor > 0
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    ), 0),
    -- Obras em aberto previstas para o mês
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      JOIN movelaria_obras o ON o.id = ci.obra_id
      WHERE o.status_kanban NOT IN ('concluida', 'cancelada')
        AND o.finalizado_em IS NULL
        AND o.comissao_habilitada = true
        AND ci.valor > 0
        AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
    ), 0),
    -- Comissões já geradas em contas a pagar no mês (fonte real dos R$ lançados)
    COALESCE((
      SELECT SUM(cp.valor_parcela)
      FROM movelaria_contas_pagar cp
      WHERE (
          cp.prestador_id IS NOT NULL
          OR cp.descricao ILIKE 'Comissão:%'
          OR cp.obra_id IS NOT NULL
        )
        AND EXTRACT(MONTH FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_ano
    ), 0),
    (
      SELECT COUNT(*)
      FROM movelaria_obras o
      WHERE o.status_kanban = 'concluida'
        AND o.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    ),
    (
      SELECT COUNT(DISTINCT o.id)
      FROM movelaria_obras o
      JOIN movelaria_obra_comissao_itens ci ON ci.obra_id = o.id
      WHERE o.status_kanban NOT IN ('concluida', 'cancelada')
        AND o.finalizado_em IS NULL
        AND o.comissao_habilitada = true
        AND ci.valor > 0
        AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
    ),
    p_mes,
    p_ano;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) TO authenticated;

-- total_comissoes por tipo: soma itens de obras concluídas no mês + contas do mês sem obra
DROP FUNCTION IF EXISTS movelaria_metricas_obras(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION movelaria_metricas_obras(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  tipo_obra_id               UUID,
  tipo_obra_nome             TEXT,
  total_obras                BIGINT,
  obras_concluidas           BIGINT,
  tempo_medio_real_horas     NUMERIC,
  tempo_total_real_horas     NUMERIC,
  tempo_maximo_horas_default NUMERIC,
  obras_em_atraso            BIGINT,
  total_comissoes            NUMERIC
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.nome,
    COUNT(o.id) FILTER (
      WHERE EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
    ),
    COUNT(o.id) FILTER (
      WHERE o.status_kanban = 'concluida'
        AND o.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    ),
    ROUND(
      AVG(COALESCE(o.duracao_real_horas, EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0))
      FILTER (
        WHERE o.finalizado_em IS NOT NULL
          AND o.iniciado_em IS NOT NULL
          AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
          AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
      ),
      2
    ),
    ROUND(
      COALESCE(
        SUM(COALESCE(o.duracao_real_horas, EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0))
        FILTER (
          WHERE o.finalizado_em IS NOT NULL
            AND o.iniciado_em IS NOT NULL
            AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
            AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
        ),
        0
      ),
      2
    ),
    t.tempo_maximo_horas_default,
    COUNT(o.id) FILTER (
      WHERE o.concluido_em_atraso = true
        AND o.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    ),
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      JOIN movelaria_obras ox ON ox.id = ci.obra_id
      WHERE ox.tipo_obra_id = t.id
        AND ox.comissao_habilitada = true
        AND ci.valor > 0
        AND (
          (
            ox.status_kanban = 'concluida'
            AND ox.finalizado_em IS NOT NULL
            AND EXTRACT(MONTH FROM ox.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
            AND EXTRACT(YEAR  FROM ox.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
          )
          OR EXISTS (
            SELECT 1 FROM movelaria_contas_pagar cp
            WHERE cp.obra_id = ox.id
              AND EXTRACT(MONTH FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_mes
              AND EXTRACT(YEAR  FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_ano
          )
        )
    ), 0)
  FROM movelaria_tipos_obra t
  LEFT JOIN movelaria_obras o ON o.tipo_obra_id = t.id
  WHERE t.ativo = true
  GROUP BY t.id, t.nome, t.tempo_maximo_horas_default
  ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras(INTEGER, INTEGER) TO authenticated;
