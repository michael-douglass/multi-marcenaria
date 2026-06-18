-- ============================================================
-- GARBO Movelaria — Painel: total/conclusão por mês de entrega
-- Migration 072
-- Alinha com Agenda: mês definido pela data prevista de fim (entrega).
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_obra_mes_entrega(
  p_data_fim DATE,
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS BOOLEAN AS $$
  SELECT p_data_fim IS NOT NULL
    AND EXTRACT(MONTH FROM p_data_fim) = p_mes
    AND EXTRACT(YEAR FROM p_data_fim) = p_ano;
$$ LANGUAGE sql IMMUTABLE;

REVOKE ALL ON FUNCTION movelaria_obra_mes_entrega(DATE, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_obra_mes_entrega(DATE, INTEGER, INTEGER) TO authenticated;

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
      WHERE o.status_kanban != 'cancelada'
        AND movelaria_obra_mes_entrega(o.data_prevista_fim, p_mes, p_ano)
    ),
    COUNT(o.id) FILTER (
      WHERE o.status_kanban = 'concluida'
        AND movelaria_obra_mes_entrega(o.data_prevista_fim, p_mes, p_ano)
    ),
    ROUND(
      AVG(COALESCE(o.duracao_real_horas, EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0))
      FILTER (
        WHERE o.status_kanban = 'concluida'
          AND o.finalizado_em IS NOT NULL
          AND o.iniciado_em IS NOT NULL
          AND movelaria_obra_mes_entrega(o.data_prevista_fim, p_mes, p_ano)
      ),
      2
    ),
    ROUND(
      COALESCE(
        SUM(COALESCE(o.duracao_real_horas, EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0))
        FILTER (
          WHERE o.status_kanban = 'concluida'
            AND o.finalizado_em IS NOT NULL
            AND o.iniciado_em IS NOT NULL
            AND movelaria_obra_mes_entrega(o.data_prevista_fim, p_mes, p_ano)
        ),
        0
      ),
      2
    ),
    t.tempo_maximo_horas_default,
    COUNT(o.id) FILTER (
      WHERE o.status_kanban = 'concluida'
        AND o.concluido_em_atraso = true
        AND movelaria_obra_mes_entrega(o.data_prevista_fim, p_mes, p_ano)
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
