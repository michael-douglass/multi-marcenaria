-- ============================================================
-- GARBO Movelaria — Fixo montador: religar cobranças órfãs
-- Migration 150
--
-- Cobranças "Fixo montador" ficaram com prestador_id NULL
-- (ainda ligadas à recorrência). O expand antigo só olhava
-- prestador_id → tentava recriar → batia no UNIQUE
-- (recorrencia_id, data_vencimento) e parava no meio.
--
-- Ao salvar o fixo: religa órfãs, preenche meses faltantes
-- e sincroniza valor nas pendentes.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_expandir_fixo_montador(p_montador_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_montador_id           UUID := COALESCE(p_montador_id, auth.uid());
  v_valor                 NUMERIC(12, 2);
  v_recorrencia_id        UUID;
  v_nome                  TEXT;
  v_primeiro_vencimento   DATE;
  v_horizonte             DATE;
  v_encerramento          DATE;
  v_cursor                DATE;
  v_prox                  DATE;
  v_ano                   INTEGER;
  v_mes                   INTEGER;
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
    -- Tenta reaproveitar recorrência órfã pelo nome/descrição
    SELECT cp.recorrencia_id
    INTO v_recorrencia_id
    FROM movelaria_contas_pagar cp
    WHERE cp.recorrencia_id IS NOT NULL
      AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
      AND (
        cp.prestador_id = v_montador_id
        OR (
          cp.prestador_id IS NULL
          AND (
            LOWER(TRIM(COALESCE(cp.fornecedor_nome, ''))) = LOWER(TRIM(v_nome))
            OR LOWER(TRIM(COALESCE(cp.descricao, ''))) = LOWER('Fixo montador: ' || v_nome)
          )
        )
      )
    ORDER BY cp.data_vencimento ASC
    LIMIT 1;

    IF v_recorrencia_id IS NULL THEN
      v_recorrencia_id := gen_random_uuid();
    END IF;

    UPDATE movelaria_usuarios
    SET fixo_recorrencia_id = v_recorrencia_id,
        fixo_primeiro_vencimento = COALESCE(fixo_primeiro_vencimento, v_primeiro_vencimento),
        atualizado_em = NOW()
    WHERE id = v_montador_id;
  END IF;

  -- Religa cobranças da série que perderam o prestador_id
  UPDATE movelaria_contas_pagar cp
  SET prestador_id = v_montador_id,
      fornecedor_nome = COALESCE(NULLIF(TRIM(cp.fornecedor_nome), ''), v_nome),
      descricao = CASE
        WHEN COALESCE(cp.descricao, '') LIKE 'Fixo montador:%' THEN cp.descricao
        ELSE 'Fixo montador: ' || v_nome
      END,
      valor_parcela = CASE WHEN cp.status = 'pendente' THEN v_valor ELSE cp.valor_parcela END,
      valor_total = CASE WHEN cp.status = 'pendente' THEN v_valor ELSE cp.valor_total END,
      recorrencia_valor_base = v_valor,
      recorrencia_encerramento = NULL,
      atualizado_em = NOW()
  WHERE cp.recorrencia_id = v_recorrencia_id
    AND (cp.prestador_id IS NULL OR cp.prestador_id = v_montador_id);

  SELECT cp.recorrencia_encerramento
  INTO v_encerramento
  FROM movelaria_contas_pagar cp
  WHERE cp.recorrencia_id = v_recorrencia_id
  ORDER BY cp.data_vencimento ASC
  LIMIT 1;

  IF v_encerramento IS NOT NULL AND v_encerramento < v_horizonte THEN
    v_horizonte := v_encerramento;
  END IF;

  v_cursor := date_trunc('month', v_primeiro_vencimento)::DATE;

  WHILE v_cursor <= date_trunc('month', v_horizonte)::DATE LOOP
    v_ano := EXTRACT(YEAR FROM v_cursor)::INTEGER;
    v_mes := EXTRACT(MONTH FROM v_cursor)::INTEGER;
    v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_ano, v_mes);

    IF v_prox >= v_primeiro_vencimento
       AND v_prox <= v_horizonte
       AND movelaria_fixo_mes_elegivel(v_primeiro_vencimento, v_mes, v_ano)
       AND NOT EXISTS (
         -- Já existe na série (mesmo com prestador_id nulo)
         SELECT 1
         FROM movelaria_contas_pagar cp
         WHERE cp.recorrencia_id = v_recorrencia_id
           AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
           AND EXTRACT(YEAR  FROM cp.data_vencimento) = v_ano
       )
       AND NOT EXISTS (
         -- Já existe outra cobrança de fixo do mesmo montador no mês
         SELECT 1
         FROM movelaria_contas_pagar cp
         WHERE cp.prestador_id = v_montador_id
           AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
           AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
           AND EXTRACT(YEAR  FROM cp.data_vencimento) = v_ano
       )
    THEN
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

    v_cursor := (v_cursor + INTERVAL '1 month')::DATE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_montador(UUID) TO authenticated;

-- Religa órfãs conhecidas via fixo_recorrencia_id do usuário
UPDATE movelaria_contas_pagar cp
SET prestador_id = u.id,
    fornecedor_nome = COALESCE(
      NULLIF(TRIM(cp.fornecedor_nome), ''),
      COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
    ),
    atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE cp.prestador_id IS NULL
  AND cp.recorrencia_id IS NOT NULL
  AND u.fixo_recorrencia_id = cp.recorrencia_id
  AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%';

-- Preenche / sincroniza todos os fixos ativos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM movelaria_usuarios
    WHERE ativo
      AND COALESCE(valor_fixo_mensal, 0) > 0
      AND perfil IN ('montador', 'montador_admin')
      AND fixo_primeiro_vencimento IS NOT NULL
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_montador(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo de %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
