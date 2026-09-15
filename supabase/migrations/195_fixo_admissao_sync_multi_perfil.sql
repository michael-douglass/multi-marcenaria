-- ============================================================
-- GARBO Movelaria — Fixo/admissão sincronizados + Meu Financeiro multi-perfil
-- Migration 195
-- ============================================================

-- 0) Repara o cadastro duplicado do Ernane (fixo na pasta inativa)
DO $$
DECLARE
  v_ativa   UUID := 'dc4a2d43-8ce4-46ac-bb4a-b4a0327ad2ed';
  v_inativa UUID := '7c4c5953-bea9-47c4-9a39-7f01315a87cd';
  v_uid     UUID := '6f7b0bc0-63a3-410b-8efb-ade61a6aa877';
  v_valor   NUMERIC(12, 2);
  v_venc    DATE;
  v_rec     UUID;
  v_dados   JSONB;
BEGIN
  SELECT valor_fixo_mensal, fixo_primeiro_vencimento, fixo_recorrencia_id, admissao_dados
  INTO v_valor, v_venc, v_rec, v_dados
  FROM movelaria_funcionarios
  WHERE id = v_inativa;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Move o fixo e a recorrência para a pasta ativa vinculada ao login
  UPDATE movelaria_funcionarios
  SET categoria = 'montador',
      valor_fixo_mensal = GREATEST(COALESCE(v_valor, 0), COALESCE(valor_fixo_mensal, 0)),
      fixo_primeiro_vencimento = COALESCE(v_venc, fixo_primeiro_vencimento),
      fixo_recorrencia_id = COALESCE(v_rec, fixo_recorrencia_id),
      admissao_dados = COALESCE(admissao_dados, '{}'::jsonb)
        || jsonb_build_object(
          'salario', COALESCE(
            NULLIF(TRIM(admissao_dados ->> 'salario'), ''),
            NULLIF(TRIM(v_dados ->> 'salario'), ''),
            CASE WHEN COALESCE(v_valor, 0) > 0 THEN TRIM(to_char(v_valor, 'FM999999990.00')) ELSE NULL END
          ),
          'funcao', COALESCE(
            NULLIF(TRIM(admissao_dados ->> 'funcao'), ''),
            NULLIF(TRIM(v_dados ->> 'funcao'), ''),
            'Montador'
          ),
          'data_admissao', COALESCE(
            NULLIF(TRIM(admissao_dados ->> 'data_admissao'), ''),
            NULLIF(TRIM(v_dados ->> 'data_admissao'), '')
          ),
          'telefone_empresa', COALESCE(
            NULLIF(TRIM(admissao_dados ->> 'telefone_empresa'), ''),
            NULLIF(TRIM(v_dados ->> 'telefone_empresa'), ''),
            NULLIF(TRIM(v_dados ->> 'telefone'), '')
          ),
          'escolaridade', COALESCE(
            NULLIF(TRIM(admissao_dados ->> 'escolaridade'), ''),
            NULLIF(TRIM(v_dados ->> 'escolaridade'), '')
          )
        ),
      telefone = COALESCE(NULLIF(TRIM(telefone), ''), NULLIF(TRIM((SELECT telefone FROM movelaria_funcionarios WHERE id = v_inativa)), '')),
      atualizado_em = NOW()
  WHERE id = v_ativa;

  -- Espelha o fixo no usuário (mesmo com perfil principal marceneiro)
  UPDATE movelaria_usuarios
  SET valor_fixo_mensal = GREATEST(COALESCE(v_valor, 0), COALESCE(valor_fixo_mensal, 0)),
      fixo_primeiro_vencimento = COALESCE(v_venc, fixo_primeiro_vencimento),
      fixo_recorrencia_id = COALESCE(v_rec, fixo_recorrencia_id),
      atualizado_em = NOW()
  WHERE id = v_uid;

  -- Religa as cobranças ao login do montador
  IF v_rec IS NOT NULL THEN
    UPDATE movelaria_contas_pagar
    SET prestador_id = COALESCE(prestador_id, v_uid),
        atualizado_em = NOW()
    WHERE recorrencia_id = v_rec
      AND status = 'pendente';
  END IF;

  -- Zera o fixo da pasta fantasma para não duplicar
  UPDATE movelaria_funcionarios
  SET valor_fixo_mensal = 0,
      fixo_recorrencia_id = NULL,
      fixo_primeiro_vencimento = NULL,
      ativo = false,
      atualizado_em = NOW()
  WHERE id = v_inativa;
END;
$$;

-- 1) Helper: usuário tem perfil montador (principal ou extra)
CREATE OR REPLACE FUNCTION movelaria_usuario_eh_montador(p_usuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = p_usuario_id
      AND u.ativo = true
      AND (
        u.perfil IN ('montador', 'montador_admin')
        OR COALESCE(u.perfis_extras, '{}'::TEXT[]) && ARRAY['montador', 'montador_admin']::TEXT[]
      )
  );
$$;

REVOKE ALL ON FUNCTION movelaria_usuario_eh_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_eh_montador(UUID) TO authenticated;

-- 2) Espelha valor do fixo no JSON da admissão
CREATE OR REPLACE FUNCTION movelaria_sync_admissao_salario_fixo(
  p_funcionario_id UUID,
  p_valor NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txt TEXT;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    UPDATE movelaria_funcionarios
    SET admissao_dados = CASE
          WHEN admissao_dados ? 'salario' THEN admissao_dados - 'salario'
          ELSE COALESCE(admissao_dados, '{}'::jsonb)
        END,
        atualizado_em = NOW()
    WHERE id = p_funcionario_id;
    RETURN;
  END IF;

  v_txt := TRIM(to_char(ROUND(p_valor::NUMERIC, 2), 'FM999999990.00'));

  UPDATE movelaria_funcionarios
  SET admissao_dados = jsonb_set(
        COALESCE(admissao_dados, '{}'::jsonb),
        '{salario}',
        to_jsonb(v_txt),
        true
      ),
      atualizado_em = NOW()
  WHERE id = p_funcionario_id;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_sync_admissao_salario_fixo(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sync_admissao_salario_fixo(UUID, NUMERIC) TO authenticated;

-- 3) Atualizar fixo: espelha no usuário multi-perfil + admissão
CREATE OR REPLACE FUNCTION movelaria_atualizar_fixo_funcionario(
  p_funcionario_id       UUID,
  p_valor                NUMERIC,
  p_primeiro_vencimento  DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil          TEXT := movelaria_meu_perfil();
  v_recorrencia_id  UUID;
  v_nome            TEXT;
  v_categoria       TEXT;
  v_usuario_id      UUID;
  v_valor           NUMERIC(12, 2);
  v_valor_anterior  NUMERIC(12, 2);
  v_data_anterior   DATE;
  v_vencimento      DATE;
  v_valor_mudou     BOOLEAN;
  v_data_mudou      BOOLEAN;
  v_descricao       TEXT;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar o fixo.';
  END IF;

  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Valor fixo inválido';
  END IF;

  IF p_primeiro_vencimento IS NOT NULL AND p_primeiro_vencimento < CURRENT_DATE - INTERVAL '5 years' THEN
    RAISE EXCEPTION 'Data de pagamento inválida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM movelaria_funcionarios f
    WHERE f.id = p_funcionario_id
      AND f.ativo = true
      AND COALESCE(f.tipo, '') <> 'marceneiro'
  ) THEN
    RAISE EXCEPTION 'Funcionário não encontrado';
  END IF;

  v_valor := ROUND(p_valor::NUMERIC, 2);
  v_vencimento := p_primeiro_vencimento;

  SELECT f.fixo_recorrencia_id,
         COALESCE(NULLIF(TRIM(f.nome), ''), 'Funcionário'),
         COALESCE(f.categoria, 'outro'),
         f.usuario_id,
         f.valor_fixo_mensal,
         f.fixo_primeiro_vencimento
  INTO v_recorrencia_id, v_nome, v_categoria, v_usuario_id, v_valor_anterior, v_data_anterior
  FROM movelaria_funcionarios f
  WHERE f.id = p_funcionario_id;

  -- Pasta de montador deve ficar como categoria montador (métricas / Meu Financeiro)
  IF v_categoria IS DISTINCT FROM 'montador'
     AND EXISTS (
       SELECT 1 FROM movelaria_funcionarios f
       WHERE f.id = p_funcionario_id
         AND f.tipo IN ('montador', 'montador_admin')
     ) THEN
    UPDATE movelaria_funcionarios
    SET categoria = 'montador', atualizado_em = NOW()
    WHERE id = p_funcionario_id;
    v_categoria := 'montador';
  END IF;

  v_descricao := movelaria_fixo_descricao(v_categoria, v_nome);

  IF v_valor <= 0 THEN
    IF v_recorrencia_id IS NOT NULL THEN
      DELETE FROM movelaria_caixa_movimentacoes cm
      WHERE cm.conta_pagar_id IN (
        SELECT cp.id
        FROM movelaria_contas_pagar cp
        WHERE cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
      );

      UPDATE movelaria_contas_pagar
      SET recorrencia_encerramento = CURRENT_DATE,
          atualizado_em = NOW()
      WHERE recorrencia_id = v_recorrencia_id
        AND status = 'pendente';
    END IF;

    UPDATE movelaria_funcionarios
    SET valor_fixo_mensal = 0,
        fixo_recorrencia_id = NULL,
        fixo_primeiro_vencimento = NULL,
        atualizado_em = NOW()
    WHERE id = p_funcionario_id;

    PERFORM movelaria_sync_admissao_salario_fixo(p_funcionario_id, 0);

    IF v_usuario_id IS NOT NULL AND movelaria_usuario_eh_montador(v_usuario_id) THEN
      UPDATE movelaria_usuarios
      SET valor_fixo_mensal = 0,
          fixo_recorrencia_id = NULL,
          fixo_primeiro_vencimento = NULL,
          atualizado_em = NOW()
      WHERE id = v_usuario_id;
    END IF;

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

  v_valor_mudou := v_valor IS DISTINCT FROM COALESCE(v_valor_anterior, 0);
  v_data_mudou := v_vencimento IS NOT NULL
    AND v_vencimento IS DISTINCT FROM v_data_anterior;

  UPDATE movelaria_funcionarios
  SET valor_fixo_mensal = v_valor,
      fixo_primeiro_vencimento = COALESCE(v_vencimento, fixo_primeiro_vencimento),
      atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  PERFORM movelaria_sync_admissao_salario_fixo(p_funcionario_id, v_valor);

  IF v_usuario_id IS NOT NULL AND movelaria_usuario_eh_montador(v_usuario_id) THEN
    UPDATE movelaria_usuarios
    SET valor_fixo_mensal = v_valor,
        fixo_primeiro_vencimento = COALESCE(v_vencimento, fixo_primeiro_vencimento),
        atualizado_em = NOW()
    WHERE id = v_usuario_id;
  END IF;

  IF v_recorrencia_id IS NOT NULL THEN
    IF v_data_mudou THEN
      DELETE FROM movelaria_caixa_movimentacoes cm
      WHERE cm.conta_pagar_id IN (
        SELECT cp.id
        FROM movelaria_contas_pagar cp
        WHERE cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
      );

      DELETE FROM movelaria_contas_pagar cp
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.status = 'pendente';
    ELSE
      UPDATE movelaria_contas_pagar cp
      SET valor_parcela = v_valor,
          valor_total = v_valor,
          recorrencia_valor_base = v_valor,
          recorrencia_encerramento = NULL,
          fornecedor_nome = v_nome,
          descricao = v_descricao,
          prestador_id = COALESCE(cp.prestador_id, v_usuario_id),
          atualizado_em = NOW()
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.status = 'pendente';

      IF v_valor_mudou THEN
        UPDATE movelaria_caixa_movimentacoes cm
        SET valor = v_valor
        FROM movelaria_contas_pagar cp
        WHERE cm.conta_pagar_id = cp.id
          AND cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
          AND cm.tipo_movimentacao = 'reserva';
      END IF;
    END IF;
  END IF;

  PERFORM movelaria_expandir_fixo_funcionario(p_funcionario_id);
END;
$$;

-- 4) Expandir fixo: multi-perfil montador
CREATE OR REPLACE FUNCTION movelaria_expandir_fixo_funcionario(p_funcionario_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func_id               UUID := p_funcionario_id;
  v_usuario_id            UUID;
  v_valor                 NUMERIC(12, 2);
  v_recorrencia_id        UUID;
  v_nome                  TEXT;
  v_categoria             TEXT;
  v_primeiro_vencimento   DATE;
  v_horizonte             DATE;
  v_encerramento          DATE;
  v_cursor                DATE;
  v_prox                  DATE;
  v_ano                   INTEGER;
  v_mes                   INTEGER;
  v_descricao             TEXT;
BEGIN
  SELECT f.id,
         f.usuario_id,
         f.valor_fixo_mensal,
         f.fixo_recorrencia_id,
         f.fixo_primeiro_vencimento,
         COALESCE(NULLIF(TRIM(f.nome), ''), 'Funcionário'),
         COALESCE(f.categoria, 'outro')
  INTO v_func_id, v_usuario_id, v_valor, v_recorrencia_id, v_primeiro_vencimento, v_nome, v_categoria
  FROM movelaria_funcionarios f
  WHERE f.id = v_func_id
    AND f.ativo = true
    AND COALESCE(f.tipo, '') <> 'marceneiro';

  IF NOT FOUND OR COALESCE(v_valor, 0) <= 0 OR v_primeiro_vencimento IS NULL THEN
    RETURN;
  END IF;

  IF v_usuario_id IS NOT NULL AND movelaria_usuario_eh_montador(v_usuario_id) THEN
    UPDATE movelaria_usuarios u
    SET valor_fixo_mensal = v_valor,
        fixo_primeiro_vencimento = COALESCE(v_primeiro_vencimento, u.fixo_primeiro_vencimento),
        fixo_recorrencia_id = COALESCE(u.fixo_recorrencia_id, v_recorrencia_id),
        atualizado_em = NOW()
    WHERE u.id = v_usuario_id
      AND u.ativo = true;

    PERFORM movelaria_expandir_fixo_montador(v_usuario_id);

    SELECT u.fixo_recorrencia_id
    INTO v_recorrencia_id
    FROM movelaria_usuarios u
    WHERE u.id = v_usuario_id;

    IF v_recorrencia_id IS NOT NULL THEN
      UPDATE movelaria_funcionarios
      SET fixo_recorrencia_id = v_recorrencia_id,
          categoria = CASE
            WHEN tipo IN ('montador', 'montador_admin') THEN 'montador'
            ELSE categoria
          END,
          atualizado_em = NOW()
      WHERE id = v_func_id;

      UPDATE movelaria_contas_pagar
      SET prestador_id = COALESCE(prestador_id, v_usuario_id),
          atualizado_em = NOW()
      WHERE recorrencia_id = v_recorrencia_id
        AND status = 'pendente'
        AND prestador_id IS NULL;
    END IF;

    RETURN;
  END IF;

  v_descricao := movelaria_fixo_descricao(v_categoria, v_nome);
  v_horizonte := (CURRENT_DATE + INTERVAL '12 months')::DATE;
  v_encerramento := NULL;

  IF v_recorrencia_id IS NULL THEN
    SELECT cp.recorrencia_id
    INTO v_recorrencia_id
    FROM movelaria_contas_pagar cp
    WHERE cp.recorrencia_id IS NOT NULL
      AND (
        (v_usuario_id IS NOT NULL AND cp.prestador_id = v_usuario_id)
        OR (
          cp.prestador_id IS NULL
          AND LOWER(TRIM(COALESCE(cp.fornecedor_nome, ''))) = LOWER(TRIM(v_nome))
        )
      )
      AND (
        COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        OR COALESCE(cp.descricao, '') LIKE 'Fixo:%'
      )
    ORDER BY cp.criado_em DESC
    LIMIT 1;

    IF v_recorrencia_id IS NULL THEN
      v_recorrencia_id := gen_random_uuid();
    END IF;

    UPDATE movelaria_funcionarios
    SET fixo_recorrencia_id = v_recorrencia_id,
        atualizado_em = NOW()
    WHERE id = v_func_id;
  END IF;

  SELECT MIN(cp.recorrencia_encerramento)
  INTO v_encerramento
  FROM movelaria_contas_pagar cp
  WHERE cp.recorrencia_id = v_recorrencia_id
    AND cp.recorrencia_encerramento IS NOT NULL;

  v_cursor := v_primeiro_vencimento;
  WHILE v_cursor <= v_horizonte LOOP
    v_ano := EXTRACT(YEAR FROM v_cursor)::INTEGER;
    v_mes := EXTRACT(MONTH FROM v_cursor)::INTEGER;

    IF v_encerramento IS NOT NULL AND v_cursor > v_encerramento THEN
      EXIT;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
        AND EXTRACT(YEAR FROM cp.data_vencimento) = v_ano
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
        v_usuario_id,
        v_nome,
        v_descricao,
        v_valor,
        1,
        1,
        v_valor,
        v_cursor,
        'pendente',
        true,
        v_recorrencia_id,
        v_valor
      );
    END IF;

    v_prox := (v_cursor + INTERVAL '1 month')::DATE;
    v_cursor := make_date(
      EXTRACT(YEAR FROM v_prox)::INTEGER,
      EXTRACT(MONTH FROM v_prox)::INTEGER,
      LEAST(
        EXTRACT(DAY FROM v_primeiro_vencimento)::INTEGER,
        EXTRACT(DAY FROM (date_trunc('month', v_prox) + INTERVAL '1 month - 1 day'))::INTEGER
      )
    );
  END LOOP;

  UPDATE movelaria_contas_pagar cp
  SET prestador_id = COALESCE(cp.prestador_id, v_usuario_id),
      fornecedor_nome = v_nome,
      descricao = v_descricao,
      valor_parcela = v_valor,
      valor_total = v_valor,
      recorrencia_valor_base = v_valor,
      atualizado_em = NOW()
  WHERE cp.recorrencia_id = v_recorrencia_id
    AND cp.status = 'pendente';
END;
$$;

-- 5) Meu Financeiro: aceita montador em perfis_extras + lê fixo da pasta
CREATE OR REPLACE FUNCTION movelaria_prestador_financeiro(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  tipo             TEXT,
  obra_id          UUID,
  conta_pagar_id   UUID,
  cliente_nome     TEXT,
  descricao        TEXT,
  valor            NUMERIC,
  status           TEXT,
  data_referencia  DATE,
  categoria        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_valor_fixo            NUMERIC(12, 2);
  v_nome                  TEXT;
  v_primeiro_vencimento   DATE;
  v_recorrencia_id        UUID;
  v_tem_fixo_cp           BOOLEAN;
  v_vencimento_mes        DATE;
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['montador', 'montador_admin', 'administrador', 'financeiro', 'administrador_obras']
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(NULLIF(u.valor_fixo_mensal, 0), f.valor_fixo_mensal, 0),
         COALESCE(NULLIF(TRIM(u.nome), ''), NULLIF(TRIM(f.nome), ''), split_part(u.email, '@', 1)),
         COALESCE(u.fixo_primeiro_vencimento, f.fixo_primeiro_vencimento),
         COALESCE(u.fixo_recorrencia_id, f.fixo_recorrencia_id)
  INTO v_valor_fixo, v_nome, v_primeiro_vencimento, v_recorrencia_id
  FROM movelaria_usuarios u
  LEFT JOIN LATERAL (
    SELECT ff.valor_fixo_mensal, ff.fixo_primeiro_vencimento, ff.fixo_recorrencia_id, ff.nome
    FROM movelaria_funcionarios ff
    WHERE ff.ativo = true
      AND (
        ff.usuario_id = u.id
        OR (ff.email IS NOT NULL AND lower(ff.email) = lower(u.email))
      )
    ORDER BY
      CASE WHEN COALESCE(ff.valor_fixo_mensal, 0) > 0 THEN 0 ELSE 1 END,
      ff.atualizado_em DESC NULLS LAST
    LIMIT 1
  ) f ON true
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
        AND (
          COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
          OR COALESCE(cp.descricao, '') LIKE 'Fixo:%'
        )
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
    ) INTO v_tem_fixo_cp;

    IF NOT v_tem_fixo_cp
       AND (v_primeiro_vencimento IS NULL OR v_vencimento_mes >= v_primeiro_vencimento) THEN
      IF v_recorrencia_id IS NULL THEN
        v_recorrencia_id := gen_random_uuid();

        UPDATE movelaria_usuarios
        SET fixo_recorrencia_id = v_recorrencia_id,
            valor_fixo_mensal = v_valor_fixo,
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
      WHEN COALESCE(cp.descricao, '') LIKE 'Fixo:%' THEN 'fixo'::TEXT
      ELSE 'comissao'::TEXT
    END
  FROM movelaria_contas_pagar cp
  WHERE cp.prestador_id = v_uid
    AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
    AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
    AND (
      COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
      OR COALESCE(cp.descricao, '') LIKE 'Fixo:%'
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
$$;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;

-- 6) Após reparo, expande cobranças da pasta ativa
SELECT movelaria_expandir_fixo_funcionario('dc4a2d43-8ce4-46ac-bb4a-b4a0327ad2ed');
