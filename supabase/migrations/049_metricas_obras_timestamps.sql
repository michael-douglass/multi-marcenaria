-- ============================================================
-- GARBO Movelaria — Métricas: timestamps, duração e comissões
-- Migration 049
-- ============================================================

-- ── 1. Métricas por tipo (tempo total + médio) ───────────────
DROP FUNCTION IF EXISTS movelaria_metricas_obras();
CREATE OR REPLACE FUNCTION movelaria_metricas_obras()
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
    COUNT(o.id),
    COUNT(o.id) FILTER (WHERE o.status_kanban = 'concluida'),
    ROUND(
      AVG(EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0)
      FILTER (WHERE o.finalizado_em IS NOT NULL AND o.iniciado_em IS NOT NULL),
      2
    ),
    ROUND(
      COALESCE(
        SUM(EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0)
        FILTER (WHERE o.finalizado_em IS NOT NULL AND o.iniciado_em IS NOT NULL),
        0
      ),
      2
    ),
    t.tempo_maximo_horas_default,
    COUNT(o.id) FILTER (WHERE o.concluido_em_atraso = true),
    COALESCE(SUM(o.comissao_total) FILTER (WHERE o.comissao_habilitada = true AND o.comissao_gerada = true), 0)
  FROM movelaria_tipos_obra t
  LEFT JOIN movelaria_obras o ON o.tipo_obra_id = t.id
  WHERE t.ativo = true
  GROUP BY t.id, t.nome, t.tempo_maximo_horas_default
  ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras() TO authenticated;

-- ── 2. Resumo de comissões do mês ────────────────────────────
DROP FUNCTION IF EXISTS movelaria_metricas_obras_resumo(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_resumo(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  comissao_a_pagar_mes  NUMERIC,
  comissao_em_aberto    NUMERIC,
  obras_concluidas_mes  BIGINT,
  obras_abertas_comissao BIGINT
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
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
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      JOIN movelaria_obras o ON o.id = ci.obra_id
      WHERE o.status_kanban NOT IN ('concluida', 'cancelada')
        AND o.finalizado_em IS NULL
        AND o.comissao_habilitada = true
        AND ci.valor > 0
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
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) TO authenticated;

-- ── 3. Detalhe por obra (timestamps + duração) ───────────────
DROP FUNCTION IF EXISTS movelaria_metricas_obras_por_obra();
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_por_obra()
RETURNS TABLE (
  obra_id            UUID,
  cliente_nome       TEXT,
  tipo_obra_nome     TEXT,
  status_kanban      TEXT,
  iniciado_em        TIMESTAMPTZ,
  finalizado_em      TIMESTAMPTZ,
  duracao_horas      NUMERIC,
  comissao_habilitada BOOLEAN,
  comissao_valor     NUMERIC
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    o.iniciado_em,
    o.finalizado_em,
    CASE
      WHEN o.iniciado_em IS NOT NULL AND o.finalizado_em IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0, 2)
      ELSE NULL
    END,
    o.comissao_habilitada,
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      WHERE ci.obra_id = o.id AND ci.valor > 0
    ), 0)
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE o.status_kanban != 'cancelada'
  ORDER BY o.finalizado_em DESC NULLS LAST, o.iniciado_em DESC NULLS LAST, o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_obra() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_obra() TO authenticated;
