-- ============================================================
-- GARBO Movelaria — Padrão fixo × comissão separados
-- Migration 131
--
-- Regras:
-- 1) Fixo do prestador → Contas a Pagar "Fixo montador: Nome"
--    e destinatário no Caixa = Nome do prestador
-- 2) Comissão → Contas a Pagar título "Comissão: Nome"
--    (descrição = cliente/obra) e destinatário no Caixa =
--    "Comissão: Nome" — NÃO mistura reserva no fixo
-- 3) Comissão só entra no Caixa como reserva ao adiantar/pagar;
--    na geração fica só em Contas a Pagar (pendente)
-- ============================================================

-- ── Helper: nome do destinatário no caixa ─────────────────────
CREATE OR REPLACE FUNCTION movelaria_nome_destinatario_prestador(
  p_prestador_id UUID,
  p_is_comissao BOOLEAN DEFAULT false
)
RETURNS TEXT AS $$
DECLARE
  v_nome TEXT;
BEGIN
  IF p_prestador_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_nome
  FROM movelaria_usuarios u
  WHERE u.id = p_prestador_id;

  IF NULLIF(TRIM(v_nome), '') IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_is_comissao THEN
    RETURN 'Comissão: ' || v_nome;
  END IF;

  RETURN v_nome;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Resolver destinatário (fixo = nome; comissão = Comissão: nome)
CREATE OR REPLACE FUNCTION movelaria_resolver_caixa_destinatario_prestador(
  p_nome TEXT,
  p_prestador_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id   UUID;
  v_nome TEXT := NULLIF(TRIM(p_nome), '');
BEGIN
  -- Se o nome já veio no padrão "Comissão: …", usa como está
  IF v_nome IS NULL AND p_prestador_id IS NOT NULL THEN
    v_nome := movelaria_nome_destinatario_prestador(p_prestador_id, false);
  END IF;

  IF v_nome IS NULL THEN
    RETURN NULL;
  END IF;

  -- Nunca criar destinatário com título de obra antiga "Comissão: Cliente"
  -- sem prestador: isso misturava várias pessoas.
  IF v_nome ~* '^Comissão:\s*' AND p_prestador_id IS NOT NULL THEN
    -- Se não for "Comissão: NomeDoPrestador", força o padrão correto
    IF LOWER(TRIM(v_nome)) IS DISTINCT FROM LOWER(TRIM(movelaria_nome_destinatario_prestador(p_prestador_id, true)))
       AND EXISTS (
         SELECT 1 FROM movelaria_usuarios u
         WHERE u.id = p_prestador_id
           AND LOWER(TRIM(v_nome)) NOT LIKE LOWER('Comissão: ' || COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)))
       )
    THEN
      v_nome := movelaria_nome_destinatario_prestador(p_prestador_id, true);
    END IF;
  END IF;

  SELECT id INTO v_id
  FROM movelaria_caixa_destinatarios
  WHERE LOWER(TRIM(nome)) = LOWER(v_nome)
    AND ativo = true
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO movelaria_caixa_destinatarios (nome, tipo, observacoes)
    VALUES (
      v_nome,
      'marceneiro',
      CASE WHEN p_prestador_id IS NOT NULL
        THEN 'Prestador obra — ' || p_prestador_id::TEXT
        ELSE 'Prestador obra'
      END
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Geração de comissão: título = Comissão: prestador ────────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra_interno(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_habilitada      BOOLEAN;
  v_gerada          BOOLEAN;
  v_cliente_nome    TEXT;
  v_finalizado_em   TIMESTAMPTZ;
  v_data_vencimento DATE;
  v_qtd_itens       INTEGER;
  v_montador_nome   TEXT;
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

  -- Só gera Contas a Pagar na conclusão (padrão 093)
  IF v_finalizado_em IS NULL OR COALESCE(
    (SELECT status_kanban FROM movelaria_obras WHERE id = p_obra_id),
    ''
  ) IS DISTINCT FROM 'concluida' THEN
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
    v_montador_nome := COALESCE(NULLIF(TRIM(r.nome), ''), split_part(r.email, '@', 1));

    -- Evita duplicar se já existir conta desta obra+prestador
    IF EXISTS (
      SELECT 1 FROM movelaria_contas_pagar cp
      WHERE cp.obra_id = p_obra_id
        AND cp.prestador_id = r.prestador_id
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO movelaria_contas_pagar (
      prestador_id,
      obra_id,
      fornecedor_nome,
      descricao,
      observacao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status
    ) VALUES (
      r.prestador_id,
      p_obra_id,
      'Comissão: ' || v_montador_nome,
      COALESCE(NULLIF(TRIM(v_cliente_nome), ''), 'Obra'),
      NULL,
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

-- ── Pagamento/adiantamento: comissão e fixo em destinatários distintos
CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id   UUID;
  v_mes               INTEGER;
  v_ano               INTEGER;
  v_descricao_reserva TEXT;
  v_descricao_old     TEXT;
  v_tipo_dest         TEXT;
  v_is_fixo           BOOLEAN;
  v_is_comissao       BOOLEAN;
  v_is_prestador_flow BOOLEAN;
  v_dest_nome         TEXT;
BEGIN
  v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
  v_descricao_old     := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

  v_is_fixo :=
    COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
    OR COALESCE(NEW.fornecedor_nome, '') LIKE 'Fixo montador:%';

  v_is_comissao :=
    NEW.prestador_id IS NOT NULL
    AND NOT v_is_fixo
    AND (
      NEW.obra_id IS NOT NULL
      OR COALESCE(NEW.fornecedor_nome, '') LIKE 'Comissão:%'
      OR COALESCE(NEW.descricao, '') LIKE 'Comissão:%'
    );

  -- ── 1. Reversão para pendente ────────────────────────────────
  IF (NEW.status = 'pendente' AND OLD.status IN ('pago', 'parcialmente_pago')) THEN
    DELETE FROM movelaria_caixa_movimentacoes
    WHERE tipo_movimentacao IN ('reserva', 'pagamento')
      AND (
        conta_pagar_id = OLD.id
        OR (
          conta_pagar_id IS NULL
          AND valor = OLD.valor_parcela
          AND descricao = v_descricao_old
          AND mes_referencia = EXTRACT(MONTH FROM OLD.data_vencimento)::INTEGER
          AND ano_referencia = EXTRACT(YEAR  FROM OLD.data_vencimento)::INTEGER
          AND destinatario_id IN (
            SELECT id FROM movelaria_caixa_destinatarios
            WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(OLD.fornecedor_nome, '')))
              AND ativo = true
          )
        )
      );
    RETURN NEW;
  END IF;

  -- ── 2. Pagamento parcial ────────────────────────────────────
  IF (NEW.status = 'parcialmente_pago' AND COALESCE(NEW.valor_pago, 0) > 0) THEN
    IF v_is_comissao THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, true);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(v_dest_nome, NEW.prestador_id);
    ELSIF v_is_fixo THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(v_dest_nome, NEW.prestador_id);
    ELSE
      SELECT id INTO v_destinatario_id
      FROM movelaria_caixa_destinatarios
      WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
        AND ativo = true
      LIMIT 1;

      IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
        INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
        VALUES (TRIM(NEW.fornecedor_nome), 'fornecedor')
        RETURNING id INTO v_destinatario_id;
      END IF;
    END IF;

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id
        AND tipo_movimentacao = 'reserva';

      INSERT INTO movelaria_caixa_movimentacoes (
        destinatario_id, tipo_movimentacao, valor,
        data_movimentacao, mes_referencia, ano_referencia,
        descricao, conta_pagar_id
      ) VALUES (
        v_destinatario_id, 'reserva', NEW.valor_pago,
        CURRENT_DATE, v_mes, v_ano,
        v_descricao_reserva, NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  -- ── 3. Pagamento completo (adiantar / reservar) ─────────────
  IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
    v_is_prestador_flow :=
      NEW.prestador_id IS NOT NULL
      AND (
        v_is_fixo
        OR v_is_comissao
        OR EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        )
      );

    IF v_is_prestador_flow THEN
      IF v_is_comissao THEN
        v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, true);
      ELSE
        v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      END IF;

      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        v_dest_nome,
        NEW.prestador_id
      );

      IF v_destinatario_id IS NOT NULL THEN
        v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
        v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

        IF NOT EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        ) THEN
          INSERT INTO movelaria_caixa_movimentacoes (
            destinatario_id, tipo_movimentacao, valor,
            data_movimentacao, data_vencimento, mes_referencia, ano_referencia,
            descricao, conta_pagar_id
          ) VALUES (
            v_destinatario_id, 'reserva', NEW.valor_parcela,
            COALESCE(NEW.data_pagamento, CURRENT_DATE), NEW.data_vencimento, v_mes, v_ano,
            CASE
              WHEN v_is_fixo
                THEN 'Reserva fixo montador: ' || COALESCE(NEW.descricao, NEW.fornecedor_nome, 'Sem descrição')
              ELSE 'Reserva comissão: ' || COALESCE(NEW.fornecedor_nome, NEW.descricao, 'Sem descrição')
            END,
            NEW.id
          );
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    v_tipo_dest := CASE WHEN NEW.prestador_id IS NOT NULL THEN 'marceneiro' ELSE 'fornecedor' END;

    SELECT id INTO v_destinatario_id
    FROM movelaria_caixa_destinatarios
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
      AND ativo = true
    LIMIT 1;

    IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
      INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
      VALUES (TRIM(NEW.fornecedor_nome), v_tipo_dest)
      RETURNING id INTO v_destinatario_id;
    END IF;

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id
        AND tipo_movimentacao = 'reserva';

      INSERT INTO movelaria_caixa_movimentacoes (
        destinatario_id, tipo_movimentacao, valor,
        data_movimentacao, mes_referencia, ano_referencia,
        descricao, conta_pagar_id
      ) VALUES (
        v_destinatario_id, 'reserva', NEW.valor_parcela,
        COALESCE(NEW.data_pagamento, CURRENT_DATE), v_mes, v_ano,
        v_descricao_reserva, NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Backfill Contas a Pagar: título Comissão: prestador ───────
UPDATE movelaria_contas_pagar cp
SET
  fornecedor_nome = 'Comissão: ' || COALESCE(
    NULLIF(TRIM(u.nome), ''),
    split_part(u.email, '@', 1),
    'Prestador'
  ),
  descricao = COALESCE(
    (SELECT NULLIF(TRIM(o.cliente_nome), '') FROM movelaria_obras o WHERE o.id = cp.obra_id),
    NULLIF(TRIM(regexp_replace(COALESCE(cp.fornecedor_nome, ''), '^[Cc]omissão:\s*', '')), ''),
    NULLIF(TRIM(cp.descricao), ''),
    'Obra'
  ),
  observacao = CASE
    WHEN cp.observacao ILIKE 'Montador:%' THEN NULL
    ELSE cp.observacao
  END,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE u.id = cp.prestador_id
  AND cp.prestador_id IS NOT NULL
  AND COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
  AND COALESCE(cp.fornecedor_nome, '') NOT LIKE 'Fixo montador:%'
  AND (
    cp.obra_id IS NOT NULL
    OR cp.fornecedor_nome ILIKE 'Comissão:%'
    OR cp.descricao ILIKE 'Comissão:%'
  );

-- ── Remapear movimentações de comissão para destinatário separado
DO $$
DECLARE
  r RECORD;
  v_old UUID;
  v_new UUID;
  v_nome TEXT;
  v_mes INTEGER;
  v_ano INTEGER;
BEGIN
  FOR r IN
    SELECT
      m.id AS mov_id,
      m.destinatario_id AS old_dest,
      m.mes_referencia,
      m.ano_referencia,
      m.tipo_movimentacao,
      m.descricao AS mov_desc,
      cp.prestador_id,
      cp.fornecedor_nome,
      cp.descricao AS cp_desc
    FROM movelaria_caixa_movimentacoes m
    JOIN movelaria_contas_pagar cp ON cp.id = m.conta_pagar_id
    WHERE cp.prestador_id IS NOT NULL
      AND COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
      AND COALESCE(cp.fornecedor_nome, '') NOT LIKE 'Fixo montador:%'
      AND (
        cp.obra_id IS NOT NULL
        OR cp.fornecedor_nome ILIKE 'Comissão:%'
        OR m.descricao ILIKE '%comiss%'
      )
  LOOP
    v_nome := movelaria_nome_destinatario_prestador(r.prestador_id, true);
    v_new := movelaria_resolver_caixa_destinatario_prestador(v_nome, r.prestador_id);
    v_old := r.old_dest;
    v_mes := r.mes_referencia;
    v_ano := r.ano_referencia;

    IF v_new IS NULL OR v_new = v_old THEN
      -- Ainda assim alinha descrição
      UPDATE movelaria_caixa_movimentacoes
      SET descricao = CASE
        WHEN tipo_movimentacao = 'pagamento' THEN
          'Pagamento comissão: ' || COALESCE(r.fornecedor_nome, r.mov_desc)
        WHEN tipo_movimentacao = 'reserva' THEN
          'Reserva comissão: ' || COALESCE(r.fornecedor_nome, r.mov_desc)
        ELSE descricao
      END
      WHERE id = r.mov_id;
      CONTINUE;
    END IF;

    UPDATE movelaria_caixa_movimentacoes
    SET
      destinatario_id = v_new,
      descricao = CASE
        WHEN tipo_movimentacao = 'pagamento' THEN
          'Pagamento comissão: ' || COALESCE(r.fornecedor_nome, r.mov_desc)
        WHEN tipo_movimentacao = 'reserva' THEN
          'Reserva comissão: ' || COALESCE(r.fornecedor_nome, r.mov_desc)
        ELSE descricao
      END
    WHERE id = r.mov_id;

    -- Recalcula saldo do destinatário ANTIGO (o trigger só atualiza o novo)
    IF EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes
      WHERE destinatario_id = v_old
        AND mes_referencia = v_mes
        AND ano_referencia = v_ano
    ) THEN
      INSERT INTO movelaria_caixa_saldo_acumulado (destinatario_id, mes_referencia, ano_referencia, total_reservado, total_pago, saldo)
      SELECT
        v_old, v_mes, v_ano,
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'pagamento' THEN valor ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE -valor END), 0)
      FROM movelaria_caixa_movimentacoes
      WHERE destinatario_id = v_old
        AND mes_referencia = v_mes
        AND ano_referencia = v_ano
      ON CONFLICT (destinatario_id, mes_referencia, ano_referencia) DO UPDATE SET
        total_reservado = EXCLUDED.total_reservado,
        total_pago = EXCLUDED.total_pago,
        saldo = EXCLUDED.saldo;
    ELSE
      UPDATE movelaria_caixa_saldo_acumulado
      SET total_reservado = 0, total_pago = 0, saldo = 0
      WHERE destinatario_id = v_old
        AND mes_referencia = v_mes
        AND ano_referencia = v_ano;
    END IF;
  END LOOP;

  -- Zera saldos órfãos de prestadores sem movimentação no mês
  UPDATE movelaria_caixa_saldo_acumulado s
  SET total_reservado = 0, total_pago = 0, saldo = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes m
    WHERE m.destinatario_id = s.destinatario_id
      AND m.mes_referencia = s.mes_referencia
      AND m.ano_referencia = s.ano_referencia
  )
  AND (s.total_reservado <> 0 OR s.total_pago <> 0 OR s.saldo <> 0);
END $$;

-- Garante fixo expandido para quem tem valor_fixo cadastrado
-- (reabre encerramento indevido e preenche meses faltantes)
UPDATE movelaria_contas_pagar cp
SET recorrencia_encerramento = NULL,
    atualizado_em = NOW()
WHERE cp.descricao ILIKE 'Fixo montador:%'
  AND cp.recorrencia_encerramento IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = cp.prestador_id
      AND u.ativo = true
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
  );

DO $$
DECLARE
  r RECORD;
  v_nome TEXT;
  v_valor NUMERIC(12,2);
  v_primeiro DATE;
  v_rec UUID;
  v_mes INT;
  v_ano INT;
  v_prox DATE;
  v_horizonte DATE := (CURRENT_DATE + INTERVAL '12 months')::DATE;
  d DATE;
BEGIN
  FOR r IN
    SELECT id, nome, valor_fixo_mensal, fixo_primeiro_vencimento, fixo_recorrencia_id
    FROM movelaria_usuarios
    WHERE ativo AND COALESCE(valor_fixo_mensal,0) > 0
      AND perfil IN ('montador', 'montador_admin')
      AND fixo_primeiro_vencimento IS NOT NULL
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_montador(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo de %: %', r.id, SQLERRM;
    END;

    v_nome := COALESCE(NULLIF(TRIM(r.nome), ''), 'Prestador');
    v_valor := r.valor_fixo_mensal;
    v_primeiro := r.fixo_primeiro_vencimento;
    v_rec := COALESCE(r.fixo_recorrencia_id, gen_random_uuid());

    IF r.fixo_recorrencia_id IS NULL THEN
      UPDATE movelaria_usuarios SET fixo_recorrencia_id = v_rec WHERE id = r.id;
    END IF;

    d := date_trunc('month', v_primeiro)::DATE;
    WHILE d <= date_trunc('month', v_horizonte)::DATE LOOP
      v_ano := EXTRACT(YEAR FROM d)::INT;
      v_mes := EXTRACT(MONTH FROM d)::INT;
      v_prox := movelaria_fixo_vencimento_mes(v_primeiro, v_ano, v_mes);

      IF v_prox >= v_primeiro
         AND movelaria_fixo_mes_elegivel(v_primeiro, v_mes, v_ano)
         AND NOT EXISTS (
           SELECT 1 FROM movelaria_contas_pagar cp
           WHERE cp.prestador_id = r.id
             AND COALESCE(cp.descricao,'') LIKE 'Fixo montador:%'
             AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
             AND EXTRACT(YEAR FROM cp.data_vencimento) = v_ano
         )
      THEN
        INSERT INTO movelaria_contas_pagar (
          prestador_id, fornecedor_nome, descricao,
          valor_total, numero_parcela, total_parcelas, valor_parcela,
          data_vencimento, status, recorrente, recorrencia_id, recorrencia_valor_base
        ) VALUES (
          r.id, v_nome, 'Fixo montador: ' || v_nome,
          v_valor, 1, 1, v_valor,
          v_prox, 'pendente', true, v_rec, v_valor
        );
      END IF;

      d := (d + INTERVAL '1 month')::DATE;
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
