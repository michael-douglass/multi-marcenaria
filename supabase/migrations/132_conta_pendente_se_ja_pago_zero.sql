-- ============================================================
-- GARBO Movelaria — Contas a Pagar Pendente se Já Pago = 0
-- Migration 132
--
-- Regra:
-- - "Já pago" no Caixa = pagamento real
-- - Se a conta só tem reserva (adiantar) e Já Pago = 0,
--   Contas a Pagar deve ficar PENDENTE (visível na lista)
-- - Marcar pago em Contas a Pagar só cria/garante RESERVA;
--   status volta/permanece pendente até existir pagamento no Caixa
-- ============================================================

-- Flag de sessão: permite voltar para pendente sem apagar reserva
CREATE OR REPLACE FUNCTION movelaria_caixa_skip_cleanup()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('movelaria.skip_caixa_cleanup', true), '') = '1';
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

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
    -- Se estamos só alinhando status (Já Pago = 0), mantém a reserva
    IF movelaria_caixa_skip_cleanup() THEN
      RETURN NEW;
    END IF;

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
    ELSIF v_is_fixo OR NEW.prestador_id IS NOT NULL THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        COALESCE(v_dest_nome, NEW.fornecedor_nome),
        NEW.prestador_id
      );
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
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva';

      INSERT INTO movelaria_caixa_movimentacoes (
        destinatario_id, tipo_movimentacao, valor,
        data_movimentacao, mes_referencia, ano_referencia,
        descricao, conta_pagar_id
      ) VALUES (
        v_destinatario_id, 'reserva', NEW.valor_pago,
        CURRENT_DATE, v_mes, v_ano, v_descricao_reserva, NEW.id
      );
    END IF;

    -- Parcial sem pagamento real no caixa: volta para pendente na lista
    -- (mantém a reserva). Quem pagou de verdade no Caixa sincroniza depois.
    IF NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'pagamento'
    ) THEN
      PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);
      UPDATE movelaria_contas_pagar
      SET status = 'pendente',
          valor_pago = 0,
          data_pagamento = NULL,
          atualizado_em = NOW()
      WHERE id = NEW.id;
      PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
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

    -- Destinatário
    IF v_is_comissao THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, true);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(v_dest_nome, NEW.prestador_id);
    ELSIF v_is_fixo OR v_is_prestador_flow THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        COALESCE(v_dest_nome, NEW.fornecedor_nome),
        NEW.prestador_id
      );
    ELSE
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
    END IF;

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      -- Garante reserva
      IF NOT EXISTS (
        SELECT 1 FROM movelaria_caixa_movimentacoes
        WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
      ) THEN
        IF v_is_prestador_flow OR v_is_fixo OR v_is_comissao THEN
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
              WHEN v_is_comissao
                THEN 'Reserva comissão: ' || COALESCE(NEW.fornecedor_nome, NEW.descricao, 'Sem descrição')
              ELSE v_descricao_reserva
            END,
            NEW.id
          );
        ELSE
          DELETE FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva';

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
    END IF;

    -- Sem pagamento real no Caixa → Contas a Pagar permanece PENDENTE
    IF NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'pagamento'
    ) THEN
      PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);
      UPDATE movelaria_contas_pagar
      SET status = 'pendente',
          valor_pago = 0,
          data_pagamento = NULL,
          atualizado_em = NOW()
      WHERE id = NEW.id;
      PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quando nasce pagamento real no Caixa, marca a Conta a Pagar como paga
CREATE OR REPLACE FUNCTION movelaria_sync_caixa_pagamento_para_conta()
RETURNS TRIGGER AS $$
DECLARE
  v_cp RECORD;
  v_pago NUMERIC(12,2);
  v_reserva NUMERIC(12,2);
BEGIN
  IF NEW.tipo_movimentacao IS DISTINCT FROM 'pagamento' THEN
    RETURN NEW;
  END IF;

  -- 1) Pagamento ligado à conta
  IF NEW.conta_pagar_id IS NOT NULL THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_pago
    FROM movelaria_caixa_movimentacoes
    WHERE conta_pagar_id = NEW.conta_pagar_id
      AND tipo_movimentacao = 'pagamento';

    SELECT * INTO v_cp FROM movelaria_contas_pagar WHERE id = NEW.conta_pagar_id;
    IF FOUND THEN
      IF v_pago >= v_cp.valor_parcela THEN
        UPDATE movelaria_contas_pagar
        SET status = 'pago',
            valor_pago = v_cp.valor_parcela,
            data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
            atualizado_em = NOW()
        WHERE id = v_cp.id;
      ELSIF v_pago > 0 THEN
        UPDATE movelaria_contas_pagar
        SET status = 'parcialmente_pago',
            valor_pago = v_pago,
            data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
            atualizado_em = NOW()
        WHERE id = v_cp.id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- 2) Pagamento consolidado do destinatário no mês:
  --    se Já Pago cobre o total das contas do mês, marca-as como pagas
  IF NEW.destinatario_id IS NOT NULL AND NEW.mes_referencia IS NOT NULL AND NEW.ano_referencia IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN tipo_movimentacao = 'pagamento' THEN valor ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE 0 END), 0)
    INTO v_pago, v_reserva
    FROM movelaria_caixa_movimentacoes
    WHERE destinatario_id = NEW.destinatario_id
      AND mes_referencia = NEW.mes_referencia
      AND ano_referencia = NEW.ano_referencia;

    -- Se há pagamento no mês do destinatário, marca contas vinculadas (reserva) desse mês
    IF v_pago > 0 THEN
      UPDATE movelaria_contas_pagar cp
      SET status = 'pago',
          valor_pago = cp.valor_parcela,
          data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
          atualizado_em = NOW()
      WHERE cp.id IN (
        SELECT m.conta_pagar_id
        FROM movelaria_caixa_movimentacoes m
        WHERE m.destinatario_id = NEW.destinatario_id
          AND m.mes_referencia = NEW.mes_referencia
          AND m.ano_referencia = NEW.ano_referencia
          AND m.tipo_movimentacao = 'reserva'
          AND m.conta_pagar_id IS NOT NULL
      )
      AND cp.status IN ('pendente', 'parcialmente_pago', 'pago')
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_caixa_movimentacoes p
        WHERE p.conta_pagar_id = cp.id
          AND p.tipo_movimentacao = 'pagamento'
      )
      -- Só marca se o total pago do destinatário no mês cobre as reservas
      AND v_pago >= (
        SELECT COALESCE(SUM(m2.valor), 0)
        FROM movelaria_caixa_movimentacoes m2
        WHERE m2.destinatario_id = NEW.destinatario_id
          AND m2.mes_referencia = NEW.mes_referencia
          AND m2.ano_referencia = NEW.ano_referencia
          AND m2.tipo_movimentacao = 'reserva'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_movelaria_sync_caixa_pagamento_para_conta ON movelaria_caixa_movimentacoes;
CREATE TRIGGER trg_movelaria_sync_caixa_pagamento_para_conta
AFTER INSERT ON movelaria_caixa_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION movelaria_sync_caixa_pagamento_para_conta();

-- ── Backfill: Já Pago (no Caixa) = 0 → Pendente ──────────────────────
-- Só reabre contas que JÁ TÊM reserva no Caixa e o destinatário/mês
-- ainda não tem pagamento real. Contas históricas só "marcadas pagas"
-- sem reserva NÃO devem voltar para a lista de Contas a Pagar.
DO $$
BEGIN
  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  WITH alvos AS (
    SELECT cp.id
    FROM movelaria_contas_pagar cp
    INNER JOIN LATERAL (
      SELECT destinatario_id
      FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = cp.id AND tipo_movimentacao = 'reserva'
      LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(CASE WHEN tipo_movimentacao = 'pagamento' THEN valor ELSE 0 END), 0) AS ja_pago_mes
      FROM movelaria_caixa_movimentacoes x
      WHERE x.destinatario_id = m.destinatario_id
        AND x.mes_referencia = EXTRACT(MONTH FROM cp.data_vencimento)::INTEGER
        AND x.ano_referencia = EXTRACT(YEAR FROM cp.data_vencimento)::INTEGER
    ) g ON true
    WHERE cp.status IN ('pago', 'parcialmente_pago')
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_caixa_movimentacoes p
        WHERE p.conta_pagar_id = cp.id AND p.tipo_movimentacao = 'pagamento'
      )
      AND COALESCE(g.ja_pago_mes, 0) = 0
  )
  UPDATE movelaria_contas_pagar cp
  SET
    status = 'pendente',
    valor_pago = 0,
    data_pagamento = NULL,
    atualizado_em = NOW()
  FROM alvos a
  WHERE cp.id = a.id;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
END $$;

NOTIFY pgrst, 'reload schema';
