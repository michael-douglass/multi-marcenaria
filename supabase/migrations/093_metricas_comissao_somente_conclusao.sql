-- ============================================================
-- GARBO Movelaria — Comissão de montador só na conclusão da obra
-- Migration 093
-- Recebimento/comissão entra no mês em que a obra é concluída
-- (finalizado_em), não pela data prevista de entrega.
-- ============================================================

-- ── Contas a pagar: vencimento = data de conclusão da obra ───
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra_interno(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_habilitada      BOOLEAN;
  v_gerada          BOOLEAN;
  v_cliente_nome    TEXT;
  v_finalizado_em   TIMESTAMPTZ;
  v_data_vencimento DATE;
  v_qtd_itens       INTEGER;
  r                 RECORD;
BEGIN
  SELECT comissao_habilitada, comissao_gerada, cliente_nome, finalizado_em
  INTO v_habilitada, v_gerada, v_cliente_nome, v_finalizado_em
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND OR NOT v_habilitada OR v_gerada THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_qtd_itens
  FROM movelaria_obra_comissao_itens
  WHERE obra_id = p_obra_id AND valor > 0;

  IF v_qtd_itens = 0 THEN
    RETURN false;
  END IF;

  v_data_vencimento := COALESCE(
    (v_finalizado_em AT TIME ZONE 'America/Sao_Paulo')::DATE,
    CURRENT_DATE
  );

  FOR r IN
    SELECT ci.prestador_id, ci.valor, u.nome, u.email
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios u ON u.id = ci.prestador_id
    WHERE ci.obra_id = p_obra_id AND ci.valor > 0
  LOOP
    INSERT INTO movelaria_contas_pagar (
      prestador_id,
      obra_id,
      fornecedor_nome,
      descricao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status
    ) VALUES (
      r.prestador_id,
      p_obra_id,
      COALESCE(NULLIF(TRIM(r.nome), ''), split_part(r.email, '@', 1)),
      'Comissão: ' || v_cliente_nome,
      r.valor,
      1,
      1,
      r.valor,
      v_data_vencimento,
      'pendente'
    );
  END LOOP;

  UPDATE movelaria_obras
  SET comissao_gerada = true,
      atualizado_em = NOW()
  WHERE id = p_obra_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) TO authenticated;

-- ── Resumo: remove comissão em aberto por data prevista ──────
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
    0::NUMERIC,
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
    0::BIGINT,
    p_mes,
    p_ano;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_resumo(INTEGER, INTEGER) TO authenticated;

-- ── Comissão por montador: só obras concluídas no mês ────────
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
    0::NUMERIC,
    COALESCE(g.valor, 0),
    COALESCE(c.qtd, 0),
    0::BIGINT
  FROM montadores m
  LEFT JOIN concluida c ON c.prestador_id = m.id
  LEFT JOIN gerada g ON g.prestador_id = m.id
  WHERE COALESCE(c.valor, 0) > 0
     OR COALESCE(g.valor, 0) > 0
  ORDER BY (COALESCE(c.valor, 0) + COALESCE(g.valor, 0)) DESC, m.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) TO authenticated;

-- ── Obras de comissão por montador (detalhe) ─────────────────
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

  ORDER BY 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) TO authenticated;

-- ── Financeiro do prestador: sem previsão por data prevista ──
CREATE OR REPLACE FUNCTION movelaria_prestador_financeiro(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  tipo              TEXT,
  obra_id           UUID,
  conta_pagar_id    UUID,
  cliente_nome      TEXT,
  descricao         TEXT,
  valor             NUMERIC,
  status            TEXT,
  data_referencia   DATE,
  categoria         TEXT
) AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_perfil                TEXT := movelaria_meu_perfil();
  v_valor_fixo            NUMERIC(12, 2);
  v_nome                  TEXT;
  v_primeiro_vencimento   DATE;
  v_recorrencia_id        UUID;
  v_tem_fixo_cp           BOOLEAN;
  v_vencimento_mes        DATE;
BEGIN
  IF v_perfil NOT IN ('montador', 'montador_admin', 'administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT u.valor_fixo_mensal,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
         u.fixo_primeiro_vencimento,
         u.fixo_recorrencia_id
  INTO v_valor_fixo, v_nome, v_primeiro_vencimento, v_recorrencia_id
  FROM movelaria_usuarios u
  WHERE u.id = v_uid;

  IF COALESCE(v_valor_fixo, 0) > 0 THEN
    PERFORM movelaria_expandir_fixo_montador(v_uid);

    v_vencimento_mes := movelaria_fixo_vencimento_mes(
      COALESCE(v_primeiro_vencimento, CURRENT_DATE),
      p_ano,
      p_mes
    );

    SELECT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = v_uid
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
    ) INTO v_tem_fixo_cp;

    IF NOT v_tem_fixo_cp
       AND (v_primeiro_vencimento IS NULL OR v_vencimento_mes >= v_primeiro_vencimento) THEN
      IF v_recorrencia_id IS NULL THEN
        v_recorrencia_id := gen_random_uuid();

        UPDATE movelaria_usuarios
        SET fixo_recorrencia_id = v_recorrencia_id,
            fixo_primeiro_vencimento = COALESCE(fixo_primeiro_vencimento, v_vencimento_mes),
            atualizado_em = NOW()
        WHERE id = v_uid;
      END IF;

      INSERT INTO movelaria_contas_pagar (
        prestador_id,
        fornecedor_nome,
        descricao,
        valor_total,
        numero_parcela,
        total_parcelas,
        valor_parcela,
        data_vencimento,
        status,
        recorrente,
        recorrencia_id,
        recorrencia_valor_base
      ) VALUES (
        v_uid,
        v_nome,
        'Fixo montador: ' || v_nome,
        v_valor_fixo,
        1,
        1,
        v_valor_fixo,
        v_vencimento_mes,
        'pendente',
        true,
        v_recorrencia_id,
        v_valor_fixo
      );

      v_tem_fixo_cp := true;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    'pagamento'::TEXT,
    cp.obra_id,
    cp.id,
    COALESCE(
      (SELECT o2.cliente_nome FROM movelaria_obras o2 WHERE o2.id = cp.obra_id),
      split_part(cp.descricao, ': ', 2),
      cp.fornecedor_nome
    ),
    cp.descricao,
    cp.valor_parcela,
    cp.status,
    COALESCE(cp.data_pagamento, cp.data_vencimento),
    CASE
      WHEN COALESCE(cp.descricao, '') LIKE 'Fixo montador:%' THEN 'fixo'::TEXT
      ELSE 'comissao'::TEXT
    END
  FROM movelaria_contas_pagar cp
  WHERE cp.prestador_id = v_uid
    AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
    AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
    AND (
      COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
      OR NOT EXISTS (
        SELECT 1
        FROM movelaria_obra_comissao_itens ci
        WHERE ci.obra_id = cp.obra_id
          AND ci.prestador_id = cp.prestador_id
          AND COALESCE(ci.oculto_prestador, false)
      )
    )

  UNION ALL

  SELECT
    'pagamento'::TEXT,
    NULL::UUID,
    NULL::UUID,
    v_nome,
    'Recebimento fixo mensal',
    v_valor_fixo,
    'pendente'::TEXT,
    movelaria_fixo_vencimento_mes(
      COALESCE(v_primeiro_vencimento, CURRENT_DATE),
      p_ano,
      p_mes
    ),
    'fixo'::TEXT
  WHERE COALESCE(v_valor_fixo, 0) > 0
    AND NOT COALESCE(v_tem_fixo_cp, false)

  ORDER BY 8, 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;
