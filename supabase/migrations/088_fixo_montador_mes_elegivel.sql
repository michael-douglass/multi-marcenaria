-- ============================================================
-- GARBO Movelaria — Corrigir fixo duplicado e mês indevido
-- Migration 088
-- - Fixo só a partir do primeiro vencimento cadastrado
-- - Remove inserção paralela que gerava duplicatas
-- - Deduplica contas a pagar de fixo já criadas indevidamente
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_fixo_mes_elegivel(
  p_primeiro_vencimento DATE,
  p_mes                 INTEGER,
  p_ano                 INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_primeiro_vencimento IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN make_date(p_ano, p_mes, 1)
    >= date_trunc('month', p_primeiro_vencimento)::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION movelaria_expandir_fixo_montador(p_montador_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_montador_id           UUID := COALESCE(p_montador_id, auth.uid());
  v_valor                 NUMERIC(12, 2);
  v_recorrencia_id        UUID;
  v_nome                  TEXT;
  v_primeiro_vencimento   DATE;
  v_horizonte             DATE;
  v_ultimo                DATE;
  v_prox                  DATE;
  v_encerramento          DATE;
  v_prox_ano              INTEGER;
  v_prox_mes              INTEGER;
BEGIN
  SELECT u.valor_fixo_mensal,
         u.fixo_recorrencia_id,
         u.fixo_primeiro_vencimento,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_valor, v_recorrencia_id, v_primeiro_vencimento, v_nome
  FROM movelaria_usuarios u
  WHERE u.id = v_montador_id
    AND u.perfil IN ('montador', 'montador_admin')
    AND u.ativo = true;

  IF NOT FOUND OR COALESCE(v_valor, 0) <= 0 OR v_primeiro_vencimento IS NULL THEN
    RETURN;
  END IF;

  v_horizonte := (CURRENT_DATE + INTERVAL '12 months')::DATE;
  v_encerramento := NULL;

  IF v_recorrencia_id IS NULL THEN
    v_recorrencia_id := gen_random_uuid();

    v_prox := movelaria_fixo_vencimento_mes(
      v_primeiro_vencimento,
      EXTRACT(YEAR  FROM v_primeiro_vencimento)::INTEGER,
      EXTRACT(MONTH FROM v_primeiro_vencimento)::INTEGER
    );

    IF v_prox < v_primeiro_vencimento THEN
      v_prox := v_primeiro_vencimento;
    END IF;

    IF movelaria_fixo_mes_elegivel(
      v_primeiro_vencimento,
      EXTRACT(MONTH FROM v_prox)::INTEGER,
      EXTRACT(YEAR  FROM v_prox)::INTEGER
    )
    AND NOT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = v_montador_id
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = EXTRACT(MONTH FROM v_prox)
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = EXTRACT(YEAR  FROM v_prox)
    ) THEN
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
        v_montador_id,
        v_nome,
        'Fixo montador: ' || v_nome,
        v_valor,
        1,
        1,
        v_valor,
        v_prox,
        'pendente',
        true,
        v_recorrencia_id,
        v_valor
      );
    END IF;

    UPDATE movelaria_usuarios
    SET fixo_recorrencia_id = v_recorrencia_id,
        fixo_primeiro_vencimento = COALESCE(fixo_primeiro_vencimento, v_prox),
        atualizado_em = NOW()
    WHERE id = v_montador_id;

    v_ultimo := v_prox;
  ELSE
    SELECT MAX(cp.data_vencimento)
    INTO v_ultimo
    FROM movelaria_contas_pagar cp
    WHERE cp.recorrencia_id = v_recorrencia_id;

    SELECT cp.recorrencia_encerramento
    INTO v_encerramento
    FROM movelaria_contas_pagar cp
    WHERE cp.recorrencia_id = v_recorrencia_id
    ORDER BY cp.data_vencimento ASC
    LIMIT 1;

    IF v_ultimo IS NULL THEN
      v_prox := movelaria_fixo_vencimento_mes(
        v_primeiro_vencimento,
        EXTRACT(YEAR  FROM v_primeiro_vencimento)::INTEGER,
        EXTRACT(MONTH FROM v_primeiro_vencimento)::INTEGER
      );

      IF v_prox < v_primeiro_vencimento THEN
        v_prox := v_primeiro_vencimento;
      END IF;

      IF movelaria_fixo_mes_elegivel(
        v_primeiro_vencimento,
        EXTRACT(MONTH FROM v_prox)::INTEGER,
        EXTRACT(YEAR  FROM v_prox)::INTEGER
      )
      AND NOT EXISTS (
        SELECT 1
        FROM movelaria_contas_pagar cp
        WHERE cp.prestador_id = v_montador_id
          AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
          AND EXTRACT(MONTH FROM cp.data_vencimento) = EXTRACT(MONTH FROM v_prox)
          AND EXTRACT(YEAR  FROM cp.data_vencimento) = EXTRACT(YEAR  FROM v_prox)
      ) THEN
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
          v_montador_id,
          v_nome,
          'Fixo montador: ' || v_nome,
          v_valor,
          1,
          1,
          v_valor,
          v_prox,
          'pendente',
          true,
          v_recorrencia_id,
          v_valor
        );
      END IF;

      v_ultimo := v_prox;
    END IF;
  END IF;

  IF v_encerramento IS NOT NULL AND v_encerramento < v_horizonte THEN
    v_horizonte := v_encerramento;
  END IF;

  IF v_ultimo IS NULL THEN
    RETURN;
  END IF;

  v_prox_ano := EXTRACT(YEAR  FROM (v_ultimo + INTERVAL '1 month'))::INTEGER;
  v_prox_mes := EXTRACT(MONTH FROM (v_ultimo + INTERVAL '1 month'))::INTEGER;
  v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_prox_ano, v_prox_mes);

  WHILE v_prox <= v_horizonte LOOP
    IF movelaria_fixo_mes_elegivel(
      v_primeiro_vencimento,
      EXTRACT(MONTH FROM v_prox)::INTEGER,
      EXTRACT(YEAR  FROM v_prox)::INTEGER
    )
    AND NOT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = v_montador_id
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = EXTRACT(MONTH FROM v_prox)
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = EXTRACT(YEAR  FROM v_prox)
    ) THEN
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
        recorrencia_valor_base,
        recorrencia_encerramento
      ) VALUES (
        v_montador_id,
        v_nome,
        'Fixo montador: ' || v_nome,
        v_valor,
        1,
        1,
        v_valor,
        v_prox,
        'pendente',
        true,
        v_recorrencia_id,
        v_valor,
        v_encerramento
      );
    END IF;

    v_prox_ano := EXTRACT(YEAR  FROM (v_prox + INTERVAL '1 month'))::INTEGER;
    v_prox_mes := EXTRACT(MONTH FROM (v_prox + INTERVAL '1 month'))::INTEGER;
    v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_prox_ano, v_prox_mes);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  v_primeiro_vencimento   DATE;
BEGIN
  IF v_perfil NOT IN ('montador', 'montador_admin', 'administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT u.valor_fixo_mensal,
         u.fixo_primeiro_vencimento
  INTO v_valor_fixo, v_primeiro_vencimento
  FROM movelaria_usuarios u
  WHERE u.id = v_uid;

  IF COALESCE(v_valor_fixo, 0) > 0
    AND movelaria_fixo_mes_elegivel(v_primeiro_vencimento, p_mes, p_ano) THEN
    PERFORM movelaria_expandir_fixo_montador(v_uid);
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
      COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
      OR movelaria_fixo_mes_elegivel(v_primeiro_vencimento, p_mes, p_ano)
    )

  ORDER BY 8, 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_listar_fixo_montadores(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  montador_id             UUID,
  montador_nome           TEXT,
  valor_fixo_mensal       NUMERIC,
  primeiro_vencimento     DATE,
  status_mes              TEXT,
  conta_pagar_id          UUID
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  r        RECORD;
  v_cp_id  UUID;
  v_status TEXT;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR r IN
    SELECT u.id,
           COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)) AS nome,
           u.valor_fixo_mensal,
           u.fixo_primeiro_vencimento
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
    ORDER BY u.nome NULLS LAST, u.email
  LOOP
    v_cp_id := NULL;
    v_status := 'sem_fixo';

    IF COALESCE(r.valor_fixo_mensal, 0) > 0
      AND movelaria_fixo_mes_elegivel(r.fixo_primeiro_vencimento, p_mes, p_ano) THEN
      PERFORM movelaria_expandir_fixo_montador(r.id);

      SELECT cp.id, cp.status
      INTO v_cp_id, v_status
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = r.id
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
      ORDER BY cp.criado_em ASC, cp.id ASC
      LIMIT 1;

      IF v_cp_id IS NULL THEN
        v_status := 'pendente';
      ELSIF v_status = 'pago' THEN
        v_status := 'pago';
      ELSE
        v_status := 'pendente';
      END IF;
    END IF;

    montador_id         := r.id;
    montador_nome       := r.nome;
    valor_fixo_mensal   := COALESCE(r.valor_fixo_mensal, 0);
    primeiro_vencimento := r.fixo_primeiro_vencimento;
    status_mes          := v_status;
    conta_pagar_id      := v_cp_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Remove fixo pendente criado antes do primeiro vencimento cadastrado
DELETE FROM movelaria_caixa_movimentacoes cm
WHERE cm.conta_pagar_id IN (
  SELECT cp.id
  FROM movelaria_contas_pagar cp
  JOIN movelaria_usuarios u ON u.id = cp.prestador_id
  WHERE COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
    AND cp.status = 'pendente'
    AND u.fixo_primeiro_vencimento IS NOT NULL
    AND NOT movelaria_fixo_mes_elegivel(
      u.fixo_primeiro_vencimento,
      EXTRACT(MONTH FROM cp.data_vencimento)::INTEGER,
      EXTRACT(YEAR  FROM cp.data_vencimento)::INTEGER
    )
);

DELETE FROM movelaria_contas_pagar cp
USING movelaria_usuarios u
WHERE cp.prestador_id = u.id
  AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
  AND cp.status = 'pendente'
  AND u.fixo_primeiro_vencimento IS NOT NULL
  AND NOT movelaria_fixo_mes_elegivel(
    u.fixo_primeiro_vencimento,
    EXTRACT(MONTH FROM cp.data_vencimento)::INTEGER,
    EXTRACT(YEAR  FROM cp.data_vencimento)::INTEGER
  );

-- Deduplica fixo pendente no mesmo mês (mantém o mais antigo ou pago)
WITH ranked AS (
  SELECT
    cp.id,
    ROW_NUMBER() OVER (
      PARTITION BY cp.prestador_id,
        EXTRACT(YEAR  FROM cp.data_vencimento),
        EXTRACT(MONTH FROM cp.data_vencimento)
      ORDER BY
        CASE cp.status WHEN 'pago' THEN 0 ELSE 1 END,
        cp.criado_em ASC,
        cp.id ASC
    ) AS rn
  FROM movelaria_contas_pagar cp
  WHERE COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
)
DELETE FROM movelaria_caixa_movimentacoes cm
WHERE cm.conta_pagar_id IN (
  SELECT id FROM ranked WHERE rn > 1
);

WITH ranked AS (
  SELECT
    cp.id,
    ROW_NUMBER() OVER (
      PARTITION BY cp.prestador_id,
        EXTRACT(YEAR  FROM cp.data_vencimento),
        EXTRACT(MONTH FROM cp.data_vencimento)
      ORDER BY
        CASE cp.status WHEN 'pago' THEN 0 ELSE 1 END,
        cp.criado_em ASC,
        cp.id ASC
    ) AS rn
  FROM movelaria_contas_pagar cp
  WHERE COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
)
DELETE FROM movelaria_contas_pagar cp
USING ranked r
WHERE cp.id = r.id
  AND r.rn > 1;

REVOKE ALL ON FUNCTION movelaria_fixo_mes_elegivel(DATE, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_fixo_mes_elegivel(DATE, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_montador(UUID) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
