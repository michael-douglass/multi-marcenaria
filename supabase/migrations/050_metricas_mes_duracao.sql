-- ============================================================
-- GARBO Movelaria — Métricas: filtro por mês + duração registrada
-- Migration 050
-- ============================================================

ALTER TABLE movelaria_obras
  ADD COLUMN IF NOT EXISTS duracao_real_horas NUMERIC(10, 4);

-- Retroativo: obras já concluídas
UPDATE movelaria_obras
SET duracao_real_horas = ROUND(
  EXTRACT(EPOCH FROM (finalizado_em - iniciado_em)) / 3600.0, 4
)
WHERE finalizado_em IS NOT NULL
  AND iniciado_em IS NOT NULL
  AND duracao_real_horas IS NULL;

-- Data de referência da obra para filtros de mês (previsão ou criação)
CREATE OR REPLACE FUNCTION movelaria_obra_data_referencia(
  p_data_fim DATE,
  p_data_inicio DATE,
  p_criado_em TIMESTAMPTZ
)
RETURNS DATE AS $$
  SELECT COALESCE(p_data_fim, p_data_inicio, p_criado_em::DATE);
$$ LANGUAGE sql IMMUTABLE;

-- ── Concluir obra: grava duração em horas ────────────────────
CREATE OR REPLACE FUNCTION movelaria_concluir_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_inicio TIMESTAMPTZ;
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  SELECT iniciado_em INTO v_inicio FROM movelaria_obras WHERE id = p_obra_id;

  UPDATE movelaria_obras
  SET iniciado_em        = COALESCE(v_inicio, NOW()),
      finalizado_em      = NOW(),
      status_kanban      = 'concluida',
      duracao_real_horas = ROUND(
        EXTRACT(EPOCH FROM (NOW() - COALESCE(v_inicio, NOW()))) / 3600.0, 4
      ),
      atualizado_em      = NOW()
  WHERE id = p_obra_id
    AND finalizado_em IS NULL;

  PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Métricas por tipo (filtradas por mês) ────────────────────
DROP FUNCTION IF EXISTS movelaria_metricas_obras();
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
    COALESCE(SUM(o.comissao_total) FILTER (
      WHERE o.comissao_habilitada = true
        AND o.comissao_gerada = true
        AND o.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
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

-- ── Resumo comissões (comissão em aberto por mês de referência) ─
DROP FUNCTION IF EXISTS movelaria_metricas_obras_resumo(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_resumo(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  comissao_a_pagar_mes   NUMERIC,
  comissao_em_aberto     NUMERIC,
  obras_concluidas_mes   BIGINT,
  obras_abertas_comissao BIGINT,
  mes_referencia         INTEGER,
  ano_referencia         INTEGER
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
        AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
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

-- ── Histórico por obra (filtrado + duração registrada) ───────
DROP FUNCTION IF EXISTS movelaria_metricas_obras_por_obra();
DROP FUNCTION IF EXISTS movelaria_metricas_obras_por_obra(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_por_obra(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  obra_id             UUID,
  cliente_nome        TEXT,
  tipo_obra_nome      TEXT,
  status_kanban       TEXT,
  iniciado_em         TIMESTAMPTZ,
  finalizado_em       TIMESTAMPTZ,
  duracao_horas       NUMERIC,
  duracao_em_andamento BOOLEAN,
  mes_referencia      DATE,
  comissao_habilitada BOOLEAN,
  comissao_valor      NUMERIC
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
      WHEN o.finalizado_em IS NOT NULL AND o.duracao_real_horas IS NOT NULL
        THEN o.duracao_real_horas
      WHEN o.finalizado_em IS NOT NULL AND o.iniciado_em IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0, 4)
      WHEN o.iniciado_em IS NOT NULL AND o.finalizado_em IS NULL
        THEN ROUND(EXTRACT(EPOCH FROM (NOW() - o.iniciado_em)) / 3600.0, 4)
      ELSE NULL
    END,
    (o.iniciado_em IS NOT NULL AND o.finalizado_em IS NULL),
    movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em),
    o.comissao_habilitada,
    COALESCE((
      SELECT SUM(ci.valor)
      FROM movelaria_obra_comissao_itens ci
      WHERE ci.obra_id = o.id AND ci.valor > 0
    ), 0)
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE o.status_kanban != 'cancelada'
    AND (
      (
        EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
      )
      OR (
        o.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
      )
      OR (
        o.iniciado_em IS NOT NULL
        AND EXTRACT(MONTH FROM o.iniciado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM o.iniciado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
      )
    )
  ORDER BY o.finalizado_em DESC NULLS LAST, o.iniciado_em DESC NULLS LAST, o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) TO authenticated;
