-- ============================================================
-- GARBO Movelaria — Garantir geração do fixo em Contas a Pagar
-- Migration 085
-- Expande todos os fixos cadastrados (12 meses à frente).
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

  IF NOT FOUND OR COALESCE(v_valor, 0) <= 0 THEN
    RETURN;
  END IF;

  v_primeiro_vencimento := COALESCE(v_primeiro_vencimento, CURRENT_DATE);
  v_horizonte := (CURRENT_DATE + INTERVAL '12 months')::DATE;
  v_encerramento := NULL;

  IF v_recorrencia_id IS NULL THEN
    v_recorrencia_id := gen_random_uuid();

    v_prox := movelaria_fixo_vencimento_mes(
      v_primeiro_vencimento,
      EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
    );

    IF v_prox < CURRENT_DATE THEN
      v_prox_ano := EXTRACT(YEAR  FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER;
      v_prox_mes := EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER;
      v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_prox_ano, v_prox_mes);
    END IF;

    IF v_prox < v_primeiro_vencimento THEN
      v_prox := v_primeiro_vencimento;
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

    -- Recorrência sem parcelas: recria a série
    IF v_ultimo IS NULL THEN
      v_prox := movelaria_fixo_vencimento_mes(
        v_primeiro_vencimento,
        EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
        EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
      );

      IF v_prox < CURRENT_DATE THEN
        v_prox_ano := EXTRACT(YEAR  FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER;
        v_prox_mes := EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER;
        v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_prox_ano, v_prox_mes);
      END IF;

      IF v_prox < v_primeiro_vencimento THEN
        v_prox := v_primeiro_vencimento;
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
    IF NOT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.data_vencimento = v_prox
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

CREATE OR REPLACE FUNCTION movelaria_expandir_todos_fixo_montadores()
RETURNS INTEGER AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  r        RECORD;
  v_count  INTEGER := 0;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR r IN
    SELECT u.id
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
  LOOP
    PERFORM movelaria_expandir_fixo_montador(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_expandir_todos_fixo_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_todos_fixo_montadores() TO authenticated;

-- Gera parcelas faltantes para todos os fixos já cadastrados
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
  LOOP
    PERFORM movelaria_expandir_fixo_montador(r.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
