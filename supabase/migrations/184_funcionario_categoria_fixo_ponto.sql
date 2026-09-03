-- ============================================================
-- GARBO Movelaria — Categoria + fixo + ponto para todos os
-- funcionários (migration 184)
--
-- 1) Categoria de cargo (Design, Projetista, etc.)
-- 2) Folha de ponto (jornada) ao cadastrar qualquer funcionário
-- 3) Fixo mensal em Métricas a partir da pasta de RH, gerando
--    cobranças em Contas a Pagar
-- ============================================================

-- ── 1. Colunas em funcionários ───────────────────────────────
ALTER TABLE movelaria_funcionarios
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS valor_fixo_mensal NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (valor_fixo_mensal >= 0),
  ADD COLUMN IF NOT EXISTS fixo_primeiro_vencimento DATE,
  ADD COLUMN IF NOT EXISTS fixo_recorrencia_id UUID;

UPDATE movelaria_funcionarios
SET categoria = CASE tipo
  WHEN 'montador' THEN 'montador'
  WHEN 'montador_admin' THEN 'montador'
  WHEN 'administrador_obras' THEN 'administrativo'
  WHEN 'financeiro' THEN 'financeiro'
  WHEN 'marceneiro' THEN 'outro'
  ELSE COALESCE(NULLIF(TRIM(categoria), ''), 'outro')
END
WHERE categoria IS NULL OR TRIM(categoria) = '';

ALTER TABLE movelaria_funcionarios
  ALTER COLUMN categoria SET DEFAULT 'montador';

ALTER TABLE movelaria_funcionarios
  DROP CONSTRAINT IF EXISTS movelaria_funcionarios_categoria_check;

ALTER TABLE movelaria_funcionarios
  ADD CONSTRAINT movelaria_funcionarios_categoria_check
  CHECK (categoria IN (
    'design',
    'projetista',
    'montador',
    'financeiro',
    'administrativo',
    'outro'
  ));

-- Espelha o fixo já cadastrado nos usuários montadores
UPDATE movelaria_funcionarios f
SET
  valor_fixo_mensal = COALESCE(u.valor_fixo_mensal, 0),
  fixo_primeiro_vencimento = u.fixo_primeiro_vencimento,
  fixo_recorrencia_id = u.fixo_recorrencia_id,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE f.usuario_id = u.id
  AND COALESCE(u.valor_fixo_mensal, 0) > 0
  AND COALESCE(f.valor_fixo_mensal, 0) = 0;

-- ── 2. Jornada padrão (folha de ponto) ───────────────────────
CREATE OR REPLACE FUNCTION movelaria_funcionario_garantir_jornada(p_funcionario_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_funcionario_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id,
    hora_entrada,
    hora_saida_intervalo,
    hora_retorno_intervalo,
    hora_saida,
    tolerancia_minutos,
    dias_uteis,
    ativo
  )
  VALUES (
    p_funcionario_id,
    '07:00',
    '12:00',
    '13:00',
    '17:00',
    5,
    ARRAY[1, 2, 3, 4, 5],
    true
  )
  ON CONFLICT (funcionario_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION movelaria_trg_funcionario_garantir_ponto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo IS TRUE AND COALESCE(NEW.tipo, '') <> 'marceneiro' THEN
    PERFORM movelaria_funcionario_garantir_jornada(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_funcionario_garantir_ponto ON movelaria_funcionarios;
CREATE TRIGGER trg_funcionario_garantir_ponto
  AFTER INSERT OR UPDATE OF ativo, tipo ON movelaria_funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_trg_funcionario_garantir_ponto();

-- Backfill: qualquer ativo sem jornada ganha folha de ponto
INSERT INTO movelaria_funcionario_jornada (
  funcionario_id,
  hora_entrada,
  hora_saida_intervalo,
  hora_retorno_intervalo,
  hora_saida,
  tolerancia_minutos,
  dias_uteis,
  ativo
)
SELECT
  f.id,
  '07:00',
  '12:00',
  '13:00',
  '17:00',
  5,
  ARRAY[1, 2, 3, 4, 5],
  true
FROM movelaria_funcionarios f
WHERE f.ativo = true
  AND COALESCE(f.tipo, '') <> 'marceneiro'
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionario_jornada j WHERE j.funcionario_id = f.id
  );

-- Sync usuário → pasta também garante jornada para todos (não só campo)
CREATE OR REPLACE FUNCTION movelaria_sync_funcionario_de_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT;
  v_nome TEXT;
  v_existing UUID;
  v_func_id UUID;
  v_categoria TEXT;
BEGIN
  v_tipo := CASE NEW.perfil
    WHEN 'marceneiro' THEN 'marceneiro'
    WHEN 'financeiro' THEN 'financeiro'
    WHEN 'montador' THEN 'montador'
    WHEN 'montador_admin' THEN 'montador_admin'
    WHEN 'administrador_obras' THEN 'administrador_obras'
    ELSE NULL
  END;

  v_categoria := CASE NEW.perfil
    WHEN 'montador' THEN 'montador'
    WHEN 'montador_admin' THEN 'montador'
    WHEN 'administrador_obras' THEN 'administrativo'
    WHEN 'financeiro' THEN 'financeiro'
    ELSE 'outro'
  END;

  v_nome := COALESCE(NULLIF(TRIM(NEW.nome), ''), split_part(NEW.email, '@', 1));

  IF v_tipo IS NULL OR NOT COALESCE(NEW.ativo, false) THEN
    UPDATE movelaria_funcionarios
    SET ativo = false, atualizado_em = NOW()
    WHERE usuario_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
  FROM movelaria_funcionarios
  WHERE usuario_id = NEW.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE movelaria_funcionarios
    SET
      nome = v_nome,
      email = NEW.email,
      tipo = v_tipo,
      categoria = COALESCE(NULLIF(TRIM(categoria), ''), v_categoria),
      ativo = true,
      atualizado_em = NOW()
    WHERE id = v_existing;
    v_func_id := v_existing;
  ELSE
    SELECT id INTO v_existing
    FROM movelaria_funcionarios
    WHERE usuario_id IS NULL
      AND email IS NOT NULL
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE movelaria_funcionarios
      SET
        usuario_id = NEW.id,
        nome = v_nome,
        email = NEW.email,
        tipo = v_tipo,
        categoria = COALESCE(NULLIF(TRIM(categoria), ''), v_categoria),
        ativo = true,
        atualizado_em = NOW()
      WHERE id = v_existing;
      v_func_id := v_existing;
    ELSE
      INSERT INTO movelaria_funcionarios (
        nome, email, tipo, categoria, usuario_id, admissao_status, ativo
      )
      VALUES (v_nome, NEW.email, v_tipo, v_categoria, NEW.id, 'pendente', true)
      RETURNING id INTO v_func_id;
    END IF;
  END IF;

  PERFORM movelaria_funcionario_garantir_jornada(v_func_id);
  RETURN NEW;
END;
$$;

-- ── 3. Expandir fixo a partir do funcionário ─────────────────
CREATE OR REPLACE FUNCTION movelaria_fixo_descricao(p_categoria TEXT, p_nome TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN LOWER(COALESCE(p_categoria, '')) IN ('montador') THEN 'Fixo montador: ' || p_nome
    ELSE 'Fixo: ' || p_nome
  END;
$$;

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

  -- Montadores com usuário: mantém o motor antigo (séries já existentes)
  IF v_usuario_id IS NOT NULL AND v_categoria = 'montador' THEN
    UPDATE movelaria_usuarios u
    SET valor_fixo_mensal = v_valor,
        fixo_primeiro_vencimento = COALESCE(v_primeiro_vencimento, u.fixo_primeiro_vencimento),
        fixo_recorrencia_id = COALESCE(u.fixo_recorrencia_id, v_recorrencia_id),
        atualizado_em = NOW()
    WHERE u.id = v_usuario_id
      AND u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true;

    PERFORM movelaria_expandir_fixo_montador(v_usuario_id);

    SELECT u.fixo_recorrencia_id
    INTO v_recorrencia_id
    FROM movelaria_usuarios u
    WHERE u.id = v_usuario_id;

    IF v_recorrencia_id IS NOT NULL THEN
      UPDATE movelaria_funcionarios
      SET fixo_recorrencia_id = v_recorrencia_id,
          atualizado_em = NOW()
      WHERE id = v_func_id;
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
        COALESCE(cp.descricao, '') LIKE 'Fixo:%'
        OR COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
      )
      AND (
        (v_usuario_id IS NOT NULL AND cp.prestador_id = v_usuario_id)
        OR (
          cp.prestador_id IS NULL
          AND (
            LOWER(TRIM(COALESCE(cp.fornecedor_nome, ''))) = LOWER(TRIM(v_nome))
            OR LOWER(TRIM(COALESCE(cp.descricao, ''))) = LOWER(v_descricao)
          )
        )
      )
    ORDER BY cp.data_vencimento ASC
    LIMIT 1;

    IF v_recorrencia_id IS NULL THEN
      v_recorrencia_id := gen_random_uuid();
    END IF;

    UPDATE movelaria_funcionarios
    SET fixo_recorrencia_id = v_recorrencia_id,
        fixo_primeiro_vencimento = COALESCE(fixo_primeiro_vencimento, v_primeiro_vencimento),
        atualizado_em = NOW()
    WHERE id = v_func_id;
  END IF;

  UPDATE movelaria_contas_pagar cp
  SET prestador_id = COALESCE(cp.prestador_id, v_usuario_id),
      fornecedor_nome = COALESCE(NULLIF(TRIM(cp.fornecedor_nome), ''), v_nome),
      descricao = CASE
        WHEN COALESCE(cp.descricao, '') LIKE 'Fixo:%' THEN cp.descricao
        WHEN COALESCE(cp.descricao, '') LIKE 'Fixo montador:%' THEN cp.descricao
        ELSE v_descricao
      END,
      valor_parcela = CASE WHEN cp.status = 'pendente' THEN v_valor ELSE cp.valor_parcela END,
      valor_total = CASE WHEN cp.status = 'pendente' THEN v_valor ELSE cp.valor_total END,
      recorrencia_valor_base = v_valor,
      recorrencia_encerramento = NULL,
      atualizado_em = NOW()
  WHERE cp.recorrencia_id = v_recorrencia_id
    AND (cp.prestador_id IS NULL OR v_usuario_id IS NULL OR cp.prestador_id = v_usuario_id);

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
         SELECT 1
         FROM movelaria_contas_pagar cp
         WHERE cp.recorrencia_id = v_recorrencia_id
           AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
           AND EXTRACT(YEAR  FROM cp.data_vencimento) = v_ano
       )
       AND NOT EXISTS (
         SELECT 1
         FROM movelaria_contas_pagar cp
         WHERE (
             (v_usuario_id IS NOT NULL AND cp.prestador_id = v_usuario_id)
             OR (
               v_usuario_id IS NULL
               AND LOWER(TRIM(COALESCE(cp.fornecedor_nome, ''))) = LOWER(TRIM(v_nome))
             )
           )
           AND (
             COALESCE(cp.descricao, '') LIKE 'Fixo:%'
             OR COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
           )
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
        v_usuario_id,
        v_nome,
        v_descricao,
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
$$;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_funcionario(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_funcionario(UUID) TO authenticated;

-- ── 4. Atualizar fixo do funcionário ─────────────────────────
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

    IF v_usuario_id IS NOT NULL THEN
      UPDATE movelaria_usuarios
      SET valor_fixo_mensal = 0,
          fixo_recorrencia_id = NULL,
          fixo_primeiro_vencimento = NULL,
          atualizado_em = NOW()
      WHERE id = v_usuario_id
        AND perfil IN ('montador', 'montador_admin');
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

  IF v_usuario_id IS NOT NULL AND v_categoria = 'montador' THEN
    UPDATE movelaria_usuarios
    SET valor_fixo_mensal = v_valor,
        fixo_primeiro_vencimento = COALESCE(v_vencimento, fixo_primeiro_vencimento),
        atualizado_em = NOW()
    WHERE id = v_usuario_id
      AND perfil IN ('montador', 'montador_admin');
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

REVOKE ALL ON FUNCTION movelaria_atualizar_fixo_funcionario(UUID, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_atualizar_fixo_funcionario(UUID, NUMERIC, DATE) TO authenticated;

-- ── 5. Listar fixos (todos os funcionários ativos) ───────────
-- DROP necessário: assinatura/retorno mudou (novas colunas).
DROP FUNCTION IF EXISTS movelaria_listar_fixo_montadores(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION movelaria_listar_fixo_montadores(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  funcionario_id          UUID,
  montador_id             UUID,
  montador_nome           TEXT,
  categoria               TEXT,
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
  v_valor  NUMERIC(12, 2);
  v_venc   DATE;
  v_uid    UUID;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR r IN
    SELECT f.id,
           f.usuario_id,
           COALESCE(NULLIF(TRIM(f.nome), ''), 'Funcionário') AS nome,
           COALESCE(f.categoria, 'outro') AS categoria,
           f.valor_fixo_mensal AS valor_func,
           f.fixo_primeiro_vencimento AS venc_func,
           u.valor_fixo_mensal AS valor_user,
           u.fixo_primeiro_vencimento AS venc_user
    FROM movelaria_funcionarios f
    LEFT JOIN movelaria_usuarios u ON u.id = f.usuario_id
    WHERE f.ativo = true
      AND COALESCE(f.tipo, '') <> 'marceneiro'
    ORDER BY f.nome NULLS LAST, f.criado_em
  LOOP
    v_uid := r.usuario_id;
    -- Preferência: valor no funcionário; se zerado e há usuário montador, usa o do usuário
    v_valor := COALESCE(NULLIF(r.valor_func, 0), r.valor_user, 0);
    v_venc := COALESCE(r.venc_func, r.venc_user);

    v_cp_id := NULL;
    v_status := 'sem_fixo';

    IF COALESCE(v_valor, 0) > 0
      AND movelaria_fixo_mes_elegivel(v_venc, p_mes, p_ano) THEN
      SELECT cp.id, cp.status
      INTO v_cp_id, v_status
      FROM movelaria_contas_pagar cp
      WHERE (
          COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
          OR COALESCE(cp.descricao, '') LIKE 'Fixo:%'
        )
        AND (
          (v_uid IS NOT NULL AND cp.prestador_id = v_uid)
          OR (
            v_uid IS NULL
            AND LOWER(TRIM(COALESCE(cp.fornecedor_nome, ''))) = LOWER(TRIM(r.nome))
          )
        )
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

    funcionario_id      := r.id;
    montador_id         := v_uid; -- usuario_id (comissão / compat)
    montador_nome       := r.nome;
    categoria           := r.categoria;
    valor_fixo_mensal   := COALESCE(v_valor, 0);
    primeiro_vencimento := v_venc;
    status_mes          := v_status;
    conta_pagar_id      := v_cp_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) TO authenticated;

-- Expandir todos: montadores + demais funcionários com fixo
-- Mantém RETURNS integer + trava de sessão (assinatura já usada pelo app).
CREATE OR REPLACE FUNCTION movelaria_expandir_todos_fixo_montadores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('movelaria_expandir_todos_fixo_montadores')) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT f.id
    FROM movelaria_funcionarios f
    WHERE f.ativo = true
      AND COALESCE(f.tipo, '') <> 'marceneiro'
      AND COALESCE(f.valor_fixo_mensal, 0) > 0
      AND f.fixo_primeiro_vencimento IS NOT NULL
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_funcionario(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo do funcionário %: %', r.id, SQLERRM;
    END;
  END LOOP;

  FOR r IN
    SELECT u.id
    FROM movelaria_usuarios u
    WHERE u.ativo
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
      AND u.perfil IN ('montador', 'montador_admin')
      AND u.fixo_primeiro_vencimento IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionarios f
        WHERE f.usuario_id = u.id
          AND COALESCE(f.valor_fixo_mensal, 0) > 0
      )
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_montador(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo do usuário %: %', r.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_expandir_todos_fixo_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_todos_fixo_montadores() TO authenticated;

-- Compat: atualizar fixo pelo usuario_id ainda funciona (montadores)
CREATE OR REPLACE FUNCTION movelaria_atualizar_fixo_montador(
  p_montador_id          UUID,
  p_valor                NUMERIC,
  p_primeiro_vencimento  DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func_id UUID;
BEGIN
  SELECT f.id INTO v_func_id
  FROM movelaria_funcionarios f
  WHERE f.usuario_id = p_montador_id
    AND f.ativo = true
  ORDER BY f.criado_em
  LIMIT 1;

  IF v_func_id IS NOT NULL THEN
    PERFORM movelaria_atualizar_fixo_funcionario(v_func_id, p_valor, p_primeiro_vencimento);
    RETURN;
  END IF;

  -- Fallback legado se ainda não houver pasta RH
  IF NOT EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = p_montador_id
      AND u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Montador não encontrado';
  END IF;

  UPDATE movelaria_usuarios
  SET valor_fixo_mensal = ROUND(GREATEST(COALESCE(p_valor, 0), 0)::NUMERIC, 2),
      fixo_primeiro_vencimento = CASE
        WHEN COALESCE(p_valor, 0) <= 0 THEN NULL
        ELSE COALESCE(p_primeiro_vencimento, fixo_primeiro_vencimento)
      END,
      fixo_recorrencia_id = CASE
        WHEN COALESCE(p_valor, 0) <= 0 THEN NULL
        ELSE fixo_recorrencia_id
      END,
      atualizado_em = NOW()
  WHERE id = p_montador_id;

  IF COALESCE(p_valor, 0) > 0 THEN
    PERFORM movelaria_expandir_fixo_montador(p_montador_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
