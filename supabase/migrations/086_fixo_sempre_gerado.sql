-- ============================================================
-- GARBO Movelaria — Fixo montador sempre como recebimento gerado
-- Migration 086
-- Garante conta em Contas a Pagar e remove fallback "previsto".
-- ============================================================

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

    SELECT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = v_uid
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
    ) INTO v_tem_fixo_cp;

    IF NOT v_tem_fixo_cp THEN
      v_vencimento_mes := movelaria_fixo_vencimento_mes(
        COALESCE(v_primeiro_vencimento, CURRENT_DATE),
        p_ano,
        p_mes
      );

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
    END IF;
  END IF;

  -- Previsto: comissões configuradas mas ainda não geradas
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
    AND o.comissao_habilitada = true
    AND o.comissao_gerada = false
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
    AND EXTRACT(YEAR  FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano

  UNION ALL

  -- Pagamentos gerados (contas a pagar), incluindo fixo mensal
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

  ORDER BY 8, 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
