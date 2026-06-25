-- ============================================================
-- GARBO Movelaria — Fixo montador: data de pagamento configurável
-- Migration 083
-- ============================================================

ALTER TABLE movelaria_usuarios
  ADD COLUMN IF NOT EXISTS fixo_primeiro_vencimento DATE;

-- Vencimento no mês/ano usando o dia da data de referência
CREATE OR REPLACE FUNCTION movelaria_fixo_vencimento_mes(
  p_referencia DATE,
  p_ano        INTEGER,
  p_mes        INTEGER
)
RETURNS DATE AS $$
DECLARE
  v_dia INTEGER;
  v_max INTEGER;
BEGIN
  IF p_referencia IS NULL THEN
    RETURN make_date(p_ano, p_mes, 10);
  END IF;

  v_dia := EXTRACT(DAY FROM p_referencia)::INTEGER;
  v_max := EXTRACT(DAY FROM (
    date_trunc('month', make_date(p_ano, p_mes, 1)) + INTERVAL '1 month - 1 day'
  ))::INTEGER;

  RETURN make_date(p_ano, p_mes, LEAST(v_dia, v_max));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP FUNCTION IF EXISTS movelaria_atualizar_fixo_montador(UUID, NUMERIC);

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
  v_horizonte := (CURRENT_DATE + INTERVAL '3 months')::DATE;
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

DROP FUNCTION IF EXISTS movelaria_listar_fixo_montadores(INTEGER, INTEGER);

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

    IF COALESCE(r.valor_fixo_mensal, 0) > 0 THEN
      PERFORM movelaria_expandir_fixo_montador(r.id);

      SELECT cp.id, cp.status
      INTO v_cp_id, v_status
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = r.id
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
      ORDER BY cp.data_vencimento DESC
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

CREATE OR REPLACE FUNCTION movelaria_atualizar_fixo_montador(
  p_montador_id          UUID,
  p_valor                NUMERIC,
  p_primeiro_vencimento  DATE DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_perfil         TEXT := movelaria_meu_perfil();
  v_recorrencia_id UUID;
  v_nome           TEXT;
  v_valor          NUMERIC(12, 2);
  v_vencimento     DATE;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar o fixo do montador';
  END IF;

  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Valor fixo inválido';
  END IF;

  IF p_primeiro_vencimento IS NOT NULL AND p_primeiro_vencimento < CURRENT_DATE - INTERVAL '5 years' THEN
    RAISE EXCEPTION 'Data de pagamento inválida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = p_montador_id
      AND u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Montador não encontrado';
  END IF;

  v_valor := ROUND(p_valor::NUMERIC, 2);
  v_vencimento := p_primeiro_vencimento;

  SELECT u.fixo_recorrencia_id,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_recorrencia_id, v_nome
  FROM movelaria_usuarios u
  WHERE u.id = p_montador_id;

  IF v_valor <= 0 THEN
    IF v_recorrencia_id IS NOT NULL THEN
      UPDATE movelaria_contas_pagar
      SET recorrencia_encerramento = CURRENT_DATE,
          atualizado_em = NOW()
      WHERE recorrencia_id = v_recorrencia_id
        AND status = 'pendente';
    END IF;

    UPDATE movelaria_usuarios
    SET valor_fixo_mensal = 0,
        fixo_recorrencia_id = NULL,
        fixo_primeiro_vencimento = NULL,
        atualizado_em = NOW()
    WHERE id = p_montador_id;

    RETURN;
  END IF;

  IF v_vencimento IS NULL AND v_recorrencia_id IS NULL THEN
  v_vencimento := movelaria_fixo_vencimento_mes(
      CURRENT_DATE,
      EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
    );
    IF v_vencimento < CURRENT_DATE THEN
      v_vencimento := movelaria_fixo_vencimento_mes(
        CURRENT_DATE,
        EXTRACT(YEAR  FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER
      );
    END IF;
  END IF;

  UPDATE movelaria_usuarios
  SET valor_fixo_mensal = v_valor,
      fixo_primeiro_vencimento = COALESCE(v_vencimento, fixo_primeiro_vencimento),
      atualizado_em = NOW()
  WHERE id = p_montador_id;

  IF v_recorrencia_id IS NOT NULL THEN
    UPDATE movelaria_contas_pagar
    SET valor_parcela = v_valor,
        valor_total = v_valor,
        recorrencia_valor_base = v_valor,
        recorrencia_encerramento = NULL,
        atualizado_em = NOW()
    WHERE recorrencia_id = v_recorrencia_id
      AND status = 'pendente';

    IF v_vencimento IS NOT NULL THEN
      UPDATE movelaria_contas_pagar
      SET data_vencimento = v_vencimento,
          atualizado_em = NOW()
      WHERE recorrencia_id = v_recorrencia_id
        AND status = 'pendente'
        AND data_vencimento = (
          SELECT MIN(cp2.data_vencimento)
          FROM movelaria_contas_pagar cp2
          WHERE cp2.recorrencia_id = v_recorrencia_id
            AND cp2.status = 'pendente'
        );
    END IF;
  END IF;

  PERFORM movelaria_expandir_fixo_montador(p_montador_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Financeiro também pode listar montadores (para métricas)
DROP FUNCTION IF EXISTS movelaria_listar_montadores();
CREATE OR REPLACE FUNCTION movelaria_listar_montadores()
RETURNS TABLE (id UUID, email TEXT, nome TEXT, perfil TEXT, ativo BOOLEAN) AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador','montador_admin','administrador_obras','financeiro') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.ativo
    FROM   movelaria_usuarios u
    WHERE  u.perfil IN ('montador','montador_admin') AND u.ativo = true
    ORDER  BY u.nome NULLS LAST, u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_montador(UUID) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_listar_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_montadores() TO authenticated;

NOTIFY pgrst, 'reload schema';
