-- ============================================================
-- GARBO Movelaria — Valor fixo mensal por montador
-- Migration 082
-- ============================================================

-- ── 1. Campos em movelaria_usuarios ───────────────────────────
ALTER TABLE movelaria_usuarios
  ADD COLUMN IF NOT EXISTS valor_fixo_mensal  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor_fixo_mensal >= 0),
  ADD COLUMN IF NOT EXISTS fixo_recorrencia_id UUID;

-- ── 2. Helper: vencimento dia 10 de um mês/ano ───────────────
CREATE OR REPLACE FUNCTION movelaria_fixo_vencimento(p_mes INTEGER, p_ano INTEGER)
RETURNS DATE AS $$
  SELECT make_date(p_ano, p_mes, 10);
$$ LANGUAGE sql IMMUTABLE;

-- ── 3. Expandir lançamentos recorrentes do fixo montador ─────
CREATE OR REPLACE FUNCTION movelaria_expandir_fixo_montador(p_montador_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_montador_id    UUID := COALESCE(p_montador_id, auth.uid());
  v_valor          NUMERIC(12, 2);
  v_recorrencia_id UUID;
  v_nome           TEXT;
  v_horizonte      DATE;
  v_ultimo         DATE;
  v_prox           DATE;
  v_encerramento   DATE;
BEGIN
  SELECT u.valor_fixo_mensal, u.fixo_recorrencia_id,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_valor, v_recorrencia_id, v_nome
  FROM movelaria_usuarios u
  WHERE u.id = v_montador_id
    AND u.perfil IN ('montador', 'montador_admin')
    AND u.ativo = true;

  IF NOT FOUND OR COALESCE(v_valor, 0) <= 0 THEN
    RETURN;
  END IF;

  v_horizonte := (CURRENT_DATE + INTERVAL '3 months')::DATE;
  v_encerramento := NULL;

  IF v_recorrencia_id IS NULL THEN
    v_recorrencia_id := gen_random_uuid();

    v_prox := movelaria_fixo_vencimento(
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
      EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER
    );
    IF v_prox < CURRENT_DATE THEN
      v_prox := (v_prox + INTERVAL '1 month')::DATE;
      v_prox := movelaria_fixo_vencimento(
        EXTRACT(MONTH FROM v_prox)::INTEGER,
        EXTRACT(YEAR  FROM v_prox)::INTEGER
      );
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

  v_prox := (v_ultimo + INTERVAL '1 month')::DATE;
  v_prox := movelaria_fixo_vencimento(
    EXTRACT(MONTH FROM v_prox)::INTEGER,
    EXTRACT(YEAR  FROM v_prox)::INTEGER
  );

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

    v_prox := (v_prox + INTERVAL '1 month')::DATE;
    v_prox := movelaria_fixo_vencimento(
      EXTRACT(MONTH FROM v_prox)::INTEGER,
      EXTRACT(YEAR  FROM v_prox)::INTEGER
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_montador(UUID) TO authenticated;

-- ── 4. Listar fixos dos montadores (admin) ────────────────────
CREATE OR REPLACE FUNCTION movelaria_listar_fixo_montadores(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  montador_id       UUID,
  montador_nome     TEXT,
  valor_fixo_mensal NUMERIC,
  status_mes        TEXT,
  conta_pagar_id    UUID
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
           u.valor_fixo_mensal
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

    montador_id       := r.id;
    montador_nome     := r.nome;
    valor_fixo_mensal := COALESCE(r.valor_fixo_mensal, 0);
    status_mes        := v_status;
    conta_pagar_id    := v_cp_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) TO authenticated;

-- ── 5. Atualizar fixo de um montador ──────────────────────────
CREATE OR REPLACE FUNCTION movelaria_atualizar_fixo_montador(
  p_montador_id UUID,
  p_valor       NUMERIC
)
RETURNS void AS $$
DECLARE
  v_perfil         TEXT := movelaria_meu_perfil();
  v_recorrencia_id UUID;
  v_nome           TEXT;
  v_valor          NUMERIC(12, 2);
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar o fixo do montador';
  END IF;

  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Valor fixo inválido';
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
        atualizado_em = NOW()
    WHERE id = p_montador_id;

    RETURN;
  END IF;

  UPDATE movelaria_usuarios
  SET valor_fixo_mensal = v_valor,
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
  END IF;

  PERFORM movelaria_expandir_fixo_montador(p_montador_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC) TO authenticated;

-- ── 6. Atualizar trigger de caixa para fixo montador ──────────
CREATE OR REPLACE FUNCTION movelaria_sync_comissao_gerada_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id UUID;
  v_mes INTEGER;
  v_ano INTEGER;
  v_desc_reserva TEXT;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.obra_id IS NULL
     AND COALESCE(NEW.descricao, '') NOT LIKE 'Comissão:%'
     AND COALESCE(NEW.descricao, '') NOT LIKE 'Fixo montador:%' THEN
    RETURN NEW;
  END IF;

  v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
    NEW.fornecedor_nome,
    NEW.prestador_id
  );

  IF v_destinatario_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_mes := EXTRACT(MONTH FROM NEW.data_vencimento)::INTEGER;
  v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento)::INTEGER;

  v_desc_reserva := CASE
    WHEN COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
      THEN 'Reserva fixo montador: ' || COALESCE(NEW.descricao, 'Sem descrição')
    ELSE 'Reserva comissão obra: ' || COALESCE(NEW.descricao, 'Sem descrição')
  END;

  INSERT INTO movelaria_caixa_movimentacoes (
    destinatario_id,
    tipo_movimentacao,
    valor,
    data_movimentacao,
    data_vencimento,
    mes_referencia,
    ano_referencia,
    descricao,
    conta_pagar_id
  ) VALUES (
    v_destinatario_id,
    'reserva',
    NEW.valor_parcela,
    CURRENT_DATE,
    NEW.data_vencimento,
    v_mes,
    v_ano,
    v_desc_reserva,
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Financeiro do prestador com categoria fixo/comissão ───
DROP FUNCTION IF EXISTS movelaria_prestador_financeiro(INTEGER, INTEGER);

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
  v_uid         UUID := auth.uid();
  v_perfil      TEXT := movelaria_meu_perfil();
  v_valor_fixo  NUMERIC(12, 2);
  v_nome        TEXT;
  v_tem_fixo_cp BOOLEAN;
BEGIN
  IF v_perfil NOT IN ('montador', 'montador_admin', 'administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil IN ('montador', 'montador_admin') THEN
    PERFORM movelaria_expandir_fixo_montador(v_uid);
  END IF;

  SELECT u.valor_fixo_mensal,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_valor_fixo, v_nome
  FROM movelaria_usuarios u
  WHERE u.id = v_uid;

  SELECT EXISTS (
    SELECT 1
    FROM movelaria_contas_pagar cp
    WHERE cp.prestador_id = v_uid
      AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
      AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
      AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
  ) INTO v_tem_fixo_cp;

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

  -- Pagamentos gerados (contas a pagar)
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

  UNION ALL

  -- Fixo previsto: mês sem conta gerada ainda
  SELECT
    'previsto'::TEXT,
    NULL::UUID,
    NULL::UUID,
    v_nome,
    'Recebimento fixo mensal',
    v_valor_fixo,
    'previsto'::TEXT,
    movelaria_fixo_vencimento(p_mes, p_ano),
    'fixo'::TEXT
  WHERE COALESCE(v_valor_fixo, 0) > 0
    AND NOT v_tem_fixo_cp

  ORDER BY 8, 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;
