-- ============================================================
-- GARBO Movelaria — Ocultar comissão do prestador
-- Migration 092
-- Admin pode marcar comissão como oculta; montador não vê nos RPCs.
-- ============================================================

ALTER TABLE movelaria_obra_comissao_itens
  ADD COLUMN IF NOT EXISTS oculto_prestador BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_obra_comissao_oculto
  ON movelaria_obra_comissao_itens(prestador_id, oculto_prestador)
  WHERE oculto_prestador = true;

-- ── Toggle ocultar/restaurar comissão ────────────────────────
CREATE OR REPLACE FUNCTION movelaria_toggle_comissao_oculta_prestador(
  p_obra_id       UUID,
  p_prestador_id  UUID,
  p_oculto        BOOLEAN
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem ocultar comissões';
  END IF;

  UPDATE movelaria_obra_comissao_itens ci
  SET oculto_prestador = COALESCE(p_oculto, false),
      atualizado_em = NOW()
  WHERE ci.obra_id = p_obra_id
    AND ci.prestador_id = p_prestador_id
    AND ci.valor > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada para esta obra e prestador';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_toggle_comissao_oculta_prestador(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_toggle_comissao_oculta_prestador(UUID, UUID, BOOLEAN) TO authenticated;

-- ── Sincronizar comissão preservando flag oculto ───────────────
DROP FUNCTION IF EXISTS movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[]);

CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_comissao(
  p_obra_id        UUID,
  p_habilitada     BOOLEAN,
  p_prestador_ids  UUID[],
  p_valores        NUMERIC[],
  p_ocultos        BOOLEAN[] DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_gerada BOOLEAN;
  v_concluida BOOLEAN;
  i        INTEGER;
  v_oculto BOOLEAN;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem configurar comissões';
  END IF;

  SELECT comissao_gerada,
         (status_kanban = 'concluida' OR finalizado_em IS NOT NULL)
  INTO v_gerada, v_concluida
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;
  IF v_gerada THEN
    RAISE EXCEPTION 'Comissão já foi gerada para esta obra e não pode ser alterada';
  END IF;

  IF p_prestador_ids IS NULL OR p_valores IS NULL THEN
    RAISE EXCEPTION 'Listas de prestadores e valores são obrigatórias';
  END IF;

  IF array_length(p_prestador_ids, 1) IS DISTINCT FROM array_length(p_valores, 1) THEN
    RAISE EXCEPTION 'Quantidade de prestadores e valores deve ser igual';
  END IF;

  IF p_ocultos IS NOT NULL
     AND array_length(p_ocultos, 1) IS DISTINCT FROM array_length(p_prestador_ids, 1) THEN
    RAISE EXCEPTION 'Quantidade de flags ocultos deve ser igual à de prestadores';
  END IF;

  DELETE FROM movelaria_obra_comissao_itens ci
  WHERE ci.obra_id = p_obra_id
    AND NOT (ci.prestador_id = ANY(p_prestador_ids));

  IF p_habilitada AND array_length(p_prestador_ids, 1) > 0 THEN
    FOR i IN 1..array_length(p_prestador_ids, 1) LOOP
      IF COALESCE(p_valores[i], 0) > 0 THEN
        v_oculto := CASE
          WHEN p_ocultos IS NULL THEN false
          ELSE COALESCE(p_ocultos[i], false)
        END;

        INSERT INTO movelaria_obra_comissao_itens (obra_id, prestador_id, valor, oculto_prestador)
        VALUES (p_obra_id, p_prestador_ids[i], ROUND(p_valores[i], 2), v_oculto)
        ON CONFLICT (obra_id, prestador_id) DO UPDATE
          SET valor = EXCLUDED.valor,
              oculto_prestador = CASE
                WHEN p_ocultos IS NULL THEN movelaria_obra_comissao_itens.oculto_prestador
                ELSE EXCLUDED.oculto_prestador
              END,
              atualizado_em = NOW();
      ELSE
        DELETE FROM movelaria_obra_comissao_itens ci
        WHERE ci.obra_id = p_obra_id
          AND ci.prestador_id = p_prestador_ids[i];
      END IF;
    END LOOP;
  ELSE
    DELETE FROM movelaria_obra_comissao_itens WHERE obra_id = p_obra_id;
  END IF;

  UPDATE movelaria_obras
  SET comissao_habilitada = p_habilitada,
      comissao_total = COALESCE((
        SELECT SUM(ci.valor) FROM movelaria_obra_comissao_itens ci WHERE ci.obra_id = p_obra_id
      ), 0),
      atualizado_em = NOW()
  WHERE id = p_obra_id;

  IF v_concluida AND p_habilitada THEN
    PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) TO authenticated;

-- ── Financeiro do prestador (filtra ocultas) ───────────────────
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
    'previsto'::TEXT,
    o.id,
    NULL::UUID,
    o.cliente_nome,
    'Comissão prevista — ' || o.cliente_nome,
    ci.valor,
    'previsto'::TEXT,
    COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em::DATE),
    'comissao'::TEXT
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  WHERE ci.prestador_id = v_uid
    AND NOT COALESCE(ci.oculto_prestador, false)
    AND o.comissao_habilitada = true
    AND o.comissao_gerada = false
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
    AND EXTRACT(YEAR  FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano

  UNION ALL

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

-- ── Obras de comissão por montador (admin vê ocultas; montador não) ──
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

-- ── Listar obras: oculta comissão do próprio montador quando marcada ──
DROP FUNCTION IF EXISTS movelaria_listar_obras();

CREATE OR REPLACE FUNCTION movelaria_listar_obras()
RETURNS TABLE (
  id                      UUID,
  origem_orcamento_id     UUID,
  origem_lead_id          TEXT,
  cliente_id              UUID,
  cliente_nome            TEXT,
  lousa                   TEXT,
  descricao               TEXT,
  endereco_obra           TEXT,
  tipo_obra_id            UUID,
  tipo_obra_nome          TEXT,
  grupo_obra_id           UUID,
  grupo_obra_nome         TEXT,
  montador_admin_id       UUID,
  montador_admin_nome     TEXT,
  montador_id             UUID,
  montador_nome           TEXT,
  montador_ids            UUID[],
  montador_nomes          TEXT[],
  data_prevista_inicio    DATE,
  data_prevista_fim       DATE,
  tempo_maximo_horas      NUMERIC,
  status_kanban           TEXT,
  iniciado_em             TIMESTAMPTZ,
  finalizado_em           TIMESTAMPTZ,
  concluido_em_atraso     BOOLEAN,
  pedido_material_feito   BOOLEAN,
  data_entrega_pedido     DATE,
  numero_pedido_cort_claud TEXT,
  criado_em               TIMESTAMPTZ,
  atualizado_em           TIMESTAMPTZ,
  comissao_habilitada     BOOLEAN,
  comissao_total          NUMERIC,
  comissao_gerada         BOOLEAN,
  dias_trabalho           INTEGER[],
  horario_inicio          TEXT,
  horario_fim             TEXT,
  comissao_prestador_ids  UUID[],
  comissao_prestador_nomes TEXT[],
  comissao_valores        NUMERIC[],
  comissao_ocultos        BOOLEAN[],
  montadores_execucao     JSONB
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    o.id, o.origem_orcamento_id, o.origem_lead_id, o.cliente_id,
    o.cliente_nome, o.lousa, o.descricao, o.endereco_obra,
    o.tipo_obra_id, t.nome,
    o.grupo_obra_id, g.nome,
    o.montador_admin_id,
    CASE
      WHEN uma.id IS NULL THEN NULL
      ELSE COALESCE(NULLIF(TRIM(uma.nome), ''), split_part(uma.email, '@', 1))
    END,
    o.montador_id,
    CASE
      WHEN um.id IS NULL THEN NULL
      ELSE COALESCE(NULLIF(TRIM(um.nome), ''), split_part(um.email, '@', 1))
    END,
    COALESCE(resp.ids,   ARRAY[]::UUID[]),
    COALESCE(resp.nomes, ARRAY[]::TEXT[]),
    o.data_prevista_inicio, o.data_prevista_fim, o.tempo_maximo_horas,
    o.status_kanban, o.iniciado_em, o.finalizado_em, o.concluido_em_atraso,
    COALESCE(o.pedido_material_feito, false),
    o.data_entrega_pedido,
    o.numero_pedido_cort_claud,
    o.criado_em, o.atualizado_em,
    o.comissao_habilitada, o.comissao_total, o.comissao_gerada,
    o.dias_trabalho, o.horario_inicio, o.horario_fim,
    COALESCE(com.ids,   ARRAY[]::UUID[]),
    COALESCE(com.nomes, ARRAY[]::TEXT[]),
    COALESCE(com.valores, ARRAY[]::NUMERIC[]),
    COALESCE(com.ocultos, ARRAY[]::BOOLEAN[]),
    COALESCE(exec.data, '[]'::jsonb)
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t  ON t.id = o.tipo_obra_id
  LEFT JOIN movelaria_grupos_obra g ON g.id = o.grupo_obra_id
  LEFT JOIN movelaria_usuarios um   ON um.id = o.montador_id
  LEFT JOIN movelaria_usuarios uma  ON uma.id = o.montador_admin_id
  LEFT JOIN LATERAL (
    SELECT
      array_agg(r.montador_id ORDER BY r.criado_em) AS ids,
      array_agg(
        COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
        ORDER BY r.criado_em
      ) AS nomes
    FROM movelaria_obra_responsaveis r
    JOIN movelaria_usuarios u ON u.id = r.montador_id
    WHERE r.obra_id = o.id
  ) resp ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'montador_id', r.montador_id,
        'iniciado_em', r.iniciado_em,
        'finalizado_em', r.finalizado_em
      ) ORDER BY r.criado_em
    ) AS data
    FROM movelaria_obra_responsaveis r
    WHERE r.obra_id = o.id
  ) exec ON true
  LEFT JOIN LATERAL (
    SELECT
      array_agg(ci.prestador_id ORDER BY ci.criado_em) AS ids,
      array_agg(
        COALESCE(NULLIF(TRIM(pu.nome), ''), split_part(pu.email, '@', 1))
        ORDER BY ci.criado_em
      ) AS nomes,
      array_agg(ci.valor ORDER BY ci.criado_em) AS valores,
      array_agg(COALESCE(ci.oculto_prestador, false) ORDER BY ci.criado_em) AS ocultos
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios pu ON pu.id = ci.prestador_id
    WHERE ci.obra_id = o.id
      AND ci.valor > 0
      AND (
        v_perfil IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador')
        OR NOT (COALESCE(ci.oculto_prestador, false) AND ci.prestador_id = v_uid)
      )
  ) com ON true
  WHERE (
    v_perfil IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador')
    OR (v_perfil = 'montador_admin' AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
    OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

NOTIFY pgrst, 'reload schema';
